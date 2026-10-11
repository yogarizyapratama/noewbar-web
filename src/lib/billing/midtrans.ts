import crypto from "crypto";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { env } from "@/lib/env";

/**
 * Midtrans billing engine (chapter 7).
 *
 * Two invariants are enforced here:
 *   - Signature: SHA512(order_id + status_code + gross_amount + ServerKey).
 *     A mismatch is rejected outright, never "logged and continued".
 *   - Fair grace-period arithmetic: a renewal paid during the grace period extends
 *     from the PREVIOUS expires_at (not the payment date), so the monthly billing
 *     cycle never drifts (chapter 14.4).
 */

export const GRACE_PERIOD_DAYS = 3;

export const PRICING_PLANS = {
  PRO_MONTHLY: {
    id: "PRO_MONTHLY" as const,
    name: "Noewbar CS Pro Bulanan",
    price: 199000,
    durationDays: 30,
  },
  PRO_ANNUAL: {
    id: "PRO_ANNUAL" as const,
    name: "Noewbar CS Pro Tahunan",
    price: 1490000,
    durationDays: 365,
  },
};

export type PlanTier = keyof typeof PRICING_PLANS;

export function planPrice(tier: PlanTier): number {
  return PRICING_PLANS[tier].price;
}

export function planDurationDays(tier: PlanTier): number {
  return PRICING_PLANS[tier].durationDays;
}

/** SHA-512 signature verification. Constant-time comparison. */
export function verifyMidtransSignature(params: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  serverKey: string;
  signatureKey: string;
}): boolean {
  const payload = `${params.orderId}${params.statusCode}${params.grossAmount}${params.serverKey}`;
  const computed = crypto.createHash("sha512").update(payload).digest("hex");

  const a = Buffer.from(computed.toLowerCase());
  const b = Buffer.from((params.signatureKey ?? "").toLowerCase());
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Builds the signature for tests and local simulation. */
export function buildMidtransSignature(params: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  serverKey: string;
}): string {
  return crypto
    .createHash("sha512")
    .update(`${params.orderId}${params.statusCode}${params.grossAmount}${params.serverKey}`)
    .digest("hex");
}

export function midtransSnapBaseUrl(): string {
  return env.MIDTRANS_IS_PRODUCTION
    ? "https://app.midtrans.com/snap/v1"
    : "https://app.sandbox.midtrans.com/snap/v1";
}

export type MidtransNotification = {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  payment_type?: string;
  transaction_id?: string;
  fraud_status?: string;
  transaction_time?: string;
};

export type ProcessResult =
  | { status: "SUCCESS"; tenantId: string; newExpiresAt: string; addedDays: number }
  | { status: "IGNORED"; reason: string }
  | { status: "DUPLICATE"; reason: string }
  | { status: "REJECTED"; reason: string };

/**
 * Idempotent notification processor.
 *
 * Idempotency is keyed on (order_id + transaction_status) stored in
 * `webhook_events.event_key` under a unique constraint, so a duplicate delivery
 * from Midtrans can never extend the subscription twice (chapter 16).
 */
export async function processMidtransNotification(
  payload: MidtransNotification
): Promise<ProcessResult> {
  const serverKey = env.MIDTRANS_SERVER_KEY;

  // 1. Signature gate.
  const valid = verifyMidtransSignature({
    orderId: payload.order_id,
    statusCode: payload.status_code,
    grossAmount: payload.gross_amount,
    serverKey,
    signatureKey: payload.signature_key,
  });

  if (!valid) {
    return { status: "REJECTED", reason: "Invalid SHA-512 signature" };
  }

  // 2. Idempotency gate.
  const eventKey = `midtrans:${payload.order_id}:${payload.transaction_status}`;
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: "MIDTRANS",
        event_key: eventKey,
        event_type: payload.transaction_status,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { status: "DUPLICATE", reason: `Event ${eventKey} already processed` };
    }
    throw err;
  }

  // 3. Locate the subscription.
  const subscription = await prisma.subscription.findUnique({
    where: { midtrans_order_id: payload.order_id },
  });

  if (!subscription) {
    return { status: "IGNORED", reason: `No subscription for order ${payload.order_id}` };
  }

  const settled =
    payload.transaction_status === "settlement" ||
    (payload.transaction_status === "capture" && payload.fraud_status !== "deny");

  if (!settled) {
    if (payload.transaction_status === "expire" || payload.transaction_status === "cancel") {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "EXPIRED" },
      });
    } else if (payload.transaction_status === "deny") {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "EXPIRED" },
      });
    }
    return { status: "IGNORED", reason: payload.transaction_status };
  }

  // 4. Fair grace-period arithmetic (chapter 14.4).
  // The new term always extends from the PREVIOUS expires_at, never from the
  // payment date. A renewal paid during the 3-day grace period therefore keeps the
  // monthly billing cycle aligned instead of drifting forward each time.
  const previousExpiry = subscription.expires_at;
  const addedDays = subscription.plan_name === "PRO_ANNUAL" ? 365 : 30;
  const newExpiresAt = new Date(previousExpiry.getTime() + addedDays * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "ACTIVE",
        payment_type: payload.payment_type ?? "qris",
        midtrans_transaction_id: payload.transaction_id ?? null,
        expires_at: newExpiresAt,
      },
    }),
    prisma.tenant.update({
      where: { id: subscription.tenant_id },
      data: { status: "ACTIVE" },
    }),
    prisma.webhookEvent.update({
      where: { event_key: eventKey },
      data: { processed: true },
    }),
  ]);

  return {
    status: "SUCCESS",
    tenantId: subscription.tenant_id,
    newExpiresAt: newExpiresAt.toISOString(),
    addedDays,
  };
}

/**
 * Creates the order row that Midtrans will reference. The subscription starts in
 * PENDING (TRIAL status is reserved for the 7-day trial), and the webhook flips it
 * to ACTIVE on settlement.
 */
export async function createSubscriptionOrder(params: {
  tenantId: string;
  planTier: PlanTier;
}): Promise<{
  orderId: string;
  subscriptionId: string;
  planName: string;
  amount: number;
  snapBaseUrl: string;
  clientKey: string;
}> {
  const plan = PRICING_PLANS[params.planTier];
  const orderId = `NOEWBAR-${params.planTier === "PRO_ANNUAL" ? "A" : "M"}-${params.tenantId.slice(0, 8)}-${Date.now()}`;

  const startsAt = new Date();
  const expiresAt = new Date(startsAt.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

  const sub = await prisma.subscription.create({
    data: {
      tenant_id: params.tenantId,
      plan_name: plan.id,
      amount: new Prisma.Decimal(plan.price),
      status: "TRIAL",
      starts_at: startsAt,
      expires_at: expiresAt,
      payment_gateway: "MIDTRANS",
      midtrans_order_id: orderId,
      invoice_reference: `INV/${startsAt.getFullYear()}/${orderId}`,
    },
  });

  return {
    orderId,
    subscriptionId: sub.id,
    planName: plan.name,
    amount: plan.price,
    snapBaseUrl: midtransSnapBaseUrl(),
    clientKey: env.MIDTRANS_CLIENT_KEY,
  };
}

/** Midtrans Status API lookup, used by the daily reconciliation cron (chapter 12). */
export async function fetchMidtransStatus(orderId: string): Promise<{
  ok: boolean;
  transactionStatus?: string;
  fraudStatus?: string;
  error?: string;
}> {
  const auth = Buffer.from(`${env.MIDTRANS_SERVER_KEY}:`).toString("base64");
  const base = env.MIDTRANS_IS_PRODUCTION
    ? "https://api.midtrans.com/v2"
    : "https://api.sandbox.midtrans.com/v2";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${base}/${encodeURIComponent(orderId)}/status`, {
      signal: controller.signal,
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as {
      transaction_status?: string;
      fraud_status?: string;
      status_message?: string;
    } | null;

    if (!res.ok) {
      return { ok: false, error: json?.status_message ?? `HTTP ${res.status}` };
    }
    return {
      ok: true,
      transactionStatus: json?.transaction_status,
      fraudStatus: json?.fraud_status,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown error" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reconciles subscriptions whose webhook never arrived (chapter 12). Also flips
 * lapsed tenants into GRACE_PERIOD / SUSPENDED.
 */
export async function reconcileSubscriptions(): Promise<{
  checked: number;
  activated: number;
  grace: number;
  suspended: number;
  errors: string[];
}> {
  const now = new Date();
  const errors: string[] = [];

  // a) Local expiry state machine.
  const lapsed = await prisma.subscription.findMany({
    where: { status: { in: ["ACTIVE", "GRACE_PERIOD"] }, expires_at: { lte: now } },
    include: { tenant: true },
  });

  let grace = 0;
  let suspended = 0;

  for (const sub of lapsed) {
    const daysPast = Math.floor((now.getTime() - sub.expires_at.getTime()) / 86_400_000);

    if (daysPast < GRACE_PERIOD_DAYS) {
      if (sub.status !== "GRACE_PERIOD") {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "GRACE_PERIOD" },
        });
        await prisma.tenant.update({
          where: { id: sub.tenant_id },
          data: { status: "GRACE_PERIOD" },
        });
        grace += 1;
      }
    } else {
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "EXPIRED" } });
      await prisma.tenant.update({
        where: { id: sub.tenant_id },
        data: { status: "SUSPENDED" },
      });
      suspended += 1;
    }
  }

  // b) Pending Midtrans orders: ask the gateway directly.
  const pending = await prisma.subscription.findMany({
    where: {
      status: "TRIAL",
      midtrans_order_id: { not: null },
      created_at: { lte: new Date(now.getTime() - 5 * 60 * 1000) },
    },
    take: 50,
  });

  let activated = 0;

  for (const sub of pending) {
    if (!sub.midtrans_order_id) continue;
    const status = await fetchMidtransStatus(sub.midtrans_order_id);

    if (!status.ok) {
      errors.push(`${sub.midtrans_order_id}: ${status.error}`);
      continue;
    }

    if (status.transactionStatus === "settlement") {
      const previousExpiry = sub.expires_at;
      const addedDays = sub.plan_name === "PRO_ANNUAL" ? 365 : 30;
      const newExpiresAt = new Date(previousExpiry.getTime() + addedDays * 86_400_000);

      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "ACTIVE", expires_at: newExpiresAt },
        }),
        prisma.tenant.update({
          where: { id: sub.tenant_id },
          data: { status: "ACTIVE" },
        }),
      ]);
      activated += 1;
    } else if (status.transactionStatus === "expire" || status.transactionStatus === "cancel") {
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "EXPIRED" } });
    }
  }

  return { checked: lapsed.length + pending.length, activated, grace, suspended, errors };
}

/** Subscription snapshot for the dashboard billing card. */
export async function subscriptionSnapshot(tenantId: string): Promise<{
  planName: string | null;
  status: string;
  startsAt: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  amount: number | null;
  midtransOrderId: string | null;
  invoiceReference: string | null;
}> {
  const sub = await prisma.subscription.findFirst({
    where: { tenant_id: tenantId },
    orderBy: { created_at: "desc" },
  });

  if (!sub) {
    return {
      planName: null,
      status: "NONE",
      startsAt: null,
      expiresAt: null,
      daysRemaining: null,
      amount: null,
      midtransOrderId: null,
      invoiceReference: null,
    };
  }

  const msLeft = sub.expires_at.getTime() - Date.now();

  return {
    planName: sub.plan_name,
    status: sub.status,
    startsAt: sub.starts_at.toISOString(),
    expiresAt: sub.expires_at.toISOString(),
    daysRemaining: Math.ceil(msLeft / 86_400_000),
    amount: Number(sub.amount),
    midtransOrderId: sub.midtrans_order_id,
    invoiceReference: sub.invoice_reference,
  };
}
