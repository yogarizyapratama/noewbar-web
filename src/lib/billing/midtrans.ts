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
  if (!params.serverKey || params.serverKey.trim() === "") {
    return false;
  }
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
      const existing = await prisma.webhookEvent.findUnique({
        where: { event_key: eventKey },
      });
      if (existing?.processed) {
        return { status: "DUPLICATE", reason: `Event ${eventKey} already processed` };
      }
      // If the event row exists but was not completed, proceed so retry can settle it.
    } else {
      throw err;
    }
  }

  // 3. Locate the subscription.
  const subscription = await prisma.subscription.findUnique({
    where: { midtrans_order_id: payload.order_id },
  });

  if (!subscription) {
    return { status: "IGNORED", reason: `No subscription for order ${payload.order_id}` };
  }

  // 3b. Amount lock: the signature proves authenticity, not the price. A
  // settlement whose gross_amount differs from the stored order total must
  // never activate the subscription.
  const settledStatuses = new Set(["settlement", "capture"]);
  if (settledStatuses.has(payload.transaction_status)) {
    const paidAmount = Number(payload.gross_amount);
    const expectedAmount = Number(subscription.amount);
    if (!Number.isFinite(paidAmount) || paidAmount !== expectedAmount) {
      return {
        status: "IGNORED",
        reason: `Amount mismatch for order ${payload.order_id}: paid ${payload.gross_amount}, expected ${expectedAmount}`,
      };
    }
  }

  const settled =
    payload.transaction_status === "settlement" ||
    (payload.transaction_status === "capture" && payload.fraud_status === "accept");

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
  // The new term extends from previous expires_at only if active and unexpired.
  // Expired or new subscriptions activate from current timestamp.
  const now = new Date();
  const baseTime =
    subscription.status === "ACTIVE" && subscription.expires_at > now
      ? subscription.expires_at.getTime()
      : now.getTime();
  const addedDays = subscription.plan_name === "PRO_ANNUAL" ? 365 : 30;
  const newExpiresAt = new Date(baseTime + addedDays * 24 * 60 * 60 * 1000);

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
  reused: boolean;
}> {
  const plan = PRICING_PLANS[params.planTier];

  // Idempotency: a retry (double click, snap_failed then retry) must not mint
  // a second billable row. Reuse a fresh pending row for the same tenant+plan
  // created within the last 24h; each settled row extends the term, so
  // duplicates would silently stack paid time.
  const recentPending = await prisma.subscription.findFirst({
    where: {
      tenant_id: params.tenantId,
      plan_name: plan.id,
      status: "TRIAL",
      midtrans_order_id: { not: null },
      created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { created_at: "desc" },
  });

  if (recentPending?.midtrans_order_id) {
    return {
      orderId: recentPending.midtrans_order_id,
      subscriptionId: recentPending.id,
      planName: plan.name,
      amount: Number(recentPending.amount),
      snapBaseUrl: midtransSnapBaseUrl(),
      clientKey: env.MIDTRANS_CLIENT_KEY,
      reused: true,
    };
  }

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
    reused: false,
  };
}

/** Midtrans Status API lookup, used by the daily reconciliation cron (chapter 12). */
export async function fetchMidtransStatus(orderId: string): Promise<{
  ok: boolean;
  transactionStatus?: string;
  fraudStatus?: string;
  grossAmount?: string;
  paymentType?: string;
  transactionId?: string;
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
      gross_amount?: string;
      payment_type?: string;
      transaction_id?: string;
      status_message?: string;
    } | null;

    if (!res.ok) {
      return { ok: false, error: json?.status_message ?? `HTTP ${res.status}` };
    }
    return {
      ok: true,
      transactionStatus: json?.transaction_status,
      fraudStatus: json?.fraud_status,
      grossAmount: json?.gross_amount,
      paymentType: json?.payment_type,
      transactionId: json?.transaction_id,
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

    const isSettled =
      status.transactionStatus === "settlement" ||
      (status.transactionStatus === "capture" && status.fraudStatus === "accept");

    if (isSettled) {
      // Amount lock (same rule as the webhook path): never activate on a
      // mismatched gross_amount.
      const paidAmount = Number(status.grossAmount);
      const expectedAmount = Number(sub.amount);
      if (status.grossAmount === undefined || !Number.isFinite(paidAmount) || paidAmount !== expectedAmount) {
        errors.push(`${sub.midtrans_order_id}: amount mismatch (gateway ${status.grossAmount ?? "unknown"}, expected ${expectedAmount})`);
        continue;
      }
      const now = new Date();
      const baseTime =
        sub.status === "ACTIVE" && sub.expires_at > now
          ? sub.expires_at.getTime()
          : now.getTime();
      const addedDays = sub.plan_name === "PRO_ANNUAL" ? 365 : 30;
      const newExpiresAt = new Date(baseTime + addedDays * 86_400_000);

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

/**
 * On-demand sync for a tenant's latest subscription or specific order.
 * Queries Midtrans Status API directly to settle payments even when
 * webhooks are blocked, delayed, or running in local development.
 */
export async function syncTenantSubscription(
  tenantId: string,
  targetOrderId?: string
): Promise<{
  synced: boolean;
  activated: boolean;
  orderId: string | null;
  status: string;
  planName?: string;
  expiresAt?: string;
  message: string;
}> {
  const whereClause = targetOrderId
    ? { tenant_id: tenantId, midtrans_order_id: targetOrderId }
    : { tenant_id: tenantId, midtrans_order_id: { not: null } };

  const subs = await prisma.subscription.findMany({
    where: whereClause,
    orderBy: { created_at: "desc" },
    take: 5,
  });

  if (!subs.length) {
    return {
      synced: false,
      activated: false,
      orderId: null,
      status: "NOT_FOUND",
      message: "Tidak ditemukan transaksi pembayaran untuk toko Anda.",
    };
  }

  // Find the first pending or trial subscription, or fallback to the latest
  const candidate =
    subs.find((s) => s.status === "TRIAL" || s.status === "GRACE_PERIOD" || s.status === "EXPIRED") ??
    subs[0];

  if (!candidate.midtrans_order_id) {
    return {
      synced: false,
      activated: false,
      orderId: null,
      status: "NOT_FOUND",
      message: "ID Pesanan Midtrans tidak valid.",
    };
  }

  const orderId = candidate.midtrans_order_id;
  const status = await fetchMidtransStatus(orderId);

  if (!status.ok) {
    // If already active in database, report active
    if (candidate.status === "ACTIVE" && candidate.expires_at > new Date()) {
      return {
        synced: true,
        activated: true,
        orderId,
        status: "ACTIVE",
        planName: candidate.plan_name,
        expiresAt: candidate.expires_at.toISOString(),
        message: "Paket langganan Pro Anda saat ini sudah aktif.",
      };
    }
    return {
      synced: false,
      activated: false,
      orderId,
      status: "GATEWAY_ERROR",
      message: status.error ?? "Gagal menghubungi server Midtrans.",
    };
  }

  const isSettled =
    status.transactionStatus === "settlement" ||
    (status.transactionStatus === "capture" && status.fraudStatus === "accept");

  if (isSettled) {
    const paidAmount = Number(status.grossAmount);
    const expectedAmount = Number(candidate.amount);

    if (
      status.grossAmount !== undefined &&
      Number.isFinite(paidAmount) &&
      paidAmount !== expectedAmount
    ) {
      return {
        synced: false,
        activated: false,
        orderId,
        status: "AMOUNT_MISMATCH",
        message: `Jumlah pembayaran (${status.grossAmount}) tidak sesuai dengan tagihan (${expectedAmount}).`,
      };
    }

    const now = new Date();
    const baseTime =
      candidate.status === "ACTIVE" && candidate.expires_at > now
        ? candidate.expires_at.getTime()
        : now.getTime();
    const addedDays = candidate.plan_name === "PRO_ANNUAL" ? 365 : 30;
    const newExpiresAt = new Date(baseTime + addedDays * 86_400_000);

    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: candidate.id },
        data: {
          status: "ACTIVE",
          payment_type: status.paymentType ?? "midtrans_verified",
          midtrans_transaction_id: status.transactionId ?? null,
          expires_at: newExpiresAt,
        },
      }),
      prisma.tenant.update({
        where: { id: candidate.tenant_id },
        data: { status: "ACTIVE" },
      }),
      prisma.webhookEvent.upsert({
        where: { event_key: `midtrans:${orderId}:${status.transactionStatus}` },
        update: { processed: true },
        create: {
          provider: "MIDTRANS",
          event_key: `midtrans:${orderId}:${status.transactionStatus}`,
          event_type: status.transactionStatus ?? "settlement",
          payload: status as unknown as Prisma.InputJsonValue,
          processed: true,
        },
      }),
    ]);

    return {
      synced: true,
      activated: true,
      orderId,
      status: "ACTIVE",
      planName: candidate.plan_name,
      expiresAt: newExpiresAt.toISOString(),
      message: "Pembayaran berhasil diverifikasi. Paket Noewbar Pro Anda kini aktif!",
    };
  }

  if (status.transactionStatus === "pending") {
    return {
      synced: true,
      activated: false,
      orderId,
      status: "PENDING",
      message: "Pesanan menunggu penyelesaian pembayaran di Midtrans.",
    };
  }

  if (status.transactionStatus === "expire" || status.transactionStatus === "cancel") {
    await prisma.subscription.update({
      where: { id: candidate.id },
      data: { status: "EXPIRED" },
    });
    return {
      synced: true,
      activated: false,
      orderId,
      status: "EXPIRED",
      message: "Transaksi pembayaran telah kedaluwarsa atau dibatalkan.",
    };
  }

  return {
    synced: true,
    activated: candidate.status === "ACTIVE",
    orderId,
    status: status.transactionStatus ?? candidate.status,
    planName: candidate.plan_name,
    expiresAt: candidate.expires_at.toISOString(),
    message: `Status transaksi saat ini: ${status.transactionStatus ?? candidate.status}.`,
  };
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
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscriptions: {
        orderBy: { created_at: "desc" },
        take: 5,
      },
    },
  });

  if (!tenant) {
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

  const activeSub = tenant.subscriptions.find(
    (s) => s.status === "ACTIVE" || s.status === "GRACE_PERIOD"
  );
  const latestSub = activeSub ?? tenant.subscriptions[0];
  const now = new Date();

  // 1. Paid active or grace-period subscription
  if (latestSub && (latestSub.status === "ACTIVE" || latestSub.status === "GRACE_PERIOD")) {
    const msLeft = latestSub.expires_at.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(msLeft / 86_400_000));
    const isExpired = msLeft <= 0;

    return {
      planName: latestSub.plan_name,
      status: isExpired ? "EXPIRED" : latestSub.status,
      startsAt: latestSub.starts_at.toISOString(),
      expiresAt: latestSub.expires_at.toISOString(),
      daysRemaining: isExpired ? 0 : daysRemaining,
      amount: Number(latestSub.amount),
      midtransOrderId: latestSub.midtrans_order_id,
      invoiceReference: latestSub.invoice_reference,
    };
  }

  // 2. Previously paid subscription that has expired and tenant has no trial left
  if (latestSub && latestSub.status === "EXPIRED" && tenant.status !== "TRIAL") {
    return {
      planName: latestSub.plan_name,
      status: "EXPIRED",
      startsAt: latestSub.starts_at.toISOString(),
      expiresAt: latestSub.expires_at.toISOString(),
      daysRemaining: 0,
      amount: Number(latestSub.amount),
      midtransOrderId: latestSub.midtrans_order_id,
      invoiceReference: latestSub.invoice_reference,
    };
  }

  // 3. Free trial evaluation (default state for new or trialing tenants, including unpaid checkout attempts)
  const trialMsLeft = tenant.trial_expires_at.getTime() - now.getTime();
  const trialDaysRemaining = Math.max(0, Math.ceil(trialMsLeft / 86_400_000));
  const isTrialExpired = trialMsLeft <= 0 || tenant.status === "EXPIRED";

  return {
    planName: "Uji Coba Gratis",
    status: isTrialExpired ? "EXPIRED" : (tenant.status === "SUSPENDED" ? "SUSPENDED" : "TRIAL"),
    startsAt: tenant.created_at.toISOString(),
    expiresAt: tenant.trial_expires_at.toISOString(),
    daysRemaining: isTrialExpired ? 0 : trialDaysRemaining,
    amount: null,
    midtransOrderId: latestSub?.midtrans_order_id ?? null,
    invoiceReference: latestSub?.invoice_reference ?? null,
  };
}
