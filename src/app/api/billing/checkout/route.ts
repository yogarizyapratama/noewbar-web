import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/http";
import { requireTenant } from "@/lib/auth";
import { createSubscriptionOrder, PRICING_PLANS, subscriptionSnapshot, planPrice } from "@/lib/billing/midtrans";
import prisma from "@/lib/prisma";
import { env } from "@/lib/env";

/**
 * Billing checkout (chapter 7 + chapter 10.A.7).
 *
 * Creates the subscription row Midtrans will settle against, then requests a Snap
 * token. When Midtrans credentials are absent (or the sandbox is unreachable) the
 * route reports that honestly and returns the order id so the operator can still
 * exercise the webhook path with a signed payload.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const checkoutSchema = z.object({
  plan: z.enum(["PRO_MONTHLY", "PRO_ANNUAL"]),
});

export async function POST(req: NextRequest) {
  const session = await requireTenant();
  if (!session) return fail("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) return fail("Plan tidak valid", 422, parsed.error.issues);

  const plan = parsed.data.plan;
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.sub },
    select: { id: true, business_name: true, owner_name: true, email: true },
  });
  if (!tenant) return fail("Tenant not found", 404);

  const order = await createSubscriptionOrder({ tenantId: tenant.id, planTier: plan });

  // Attempt a real Snap token when the server key is configured.
  if (!env.MIDTRANS_SERVER_KEY) {
    return ok({
      mode: "unconfigured",
      order_id: order.orderId,
      reused: order.reused,
      subscription_id: order.subscriptionId,
      plan_name: order.planName,
      amount: order.amount,
      note: "MIDTRANS_SERVER_KEY belum diatur. Data langganan sudah dibuat; isi kredensial Midtrans lalu ulangi untuk mendapat Snap token.",
      snap_token: null,
      redirect_url: null,
    });
  }

  const isAnimating = plan === "PRO_ANNUAL";

  const snapPayload = {
    transaction_details: {
      order_id: order.orderId,
      gross_amount: planPrice(plan),
    },
    item_details: [
      {
        id: plan,
        price: planPrice(plan),
        quantity: 1,
        name: isAnimating
          ? PRICING_PLANS.PRO_ANNUAL.name
          : PRICING_PLANS.PRO_MONTHLY.name,
      },
    ],
    customer_details: {
      first_name: tenant.owner_name,
      email: tenant.email,
    },
    callbacks: {
      finish: `${env.NEXT_PUBLIC_APP_URL}/dashboard?billing=finish`,
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(`${order.snapBaseUrl}/transactions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${env.MIDTRANS_SERVER_KEY}:`).toString("base64")}`,
      },
      body: JSON.stringify(snapPayload),
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as
      | { token?: string; redirect_url?: string; error_messages?: string[] }
      | null;

    if (!res.ok || !json?.token) {
      return ok({
        mode: "snap_failed",
        order_id: order.orderId,
        reused: order.reused,
        subscription_id: order.subscriptionId,
        plan_name: order.planName,
        amount: order.amount,
        error: json?.error_messages?.join("; ") ?? `Midtrans responded HTTP ${res.status}`,
        snap_token: null,
        redirect_url: null,
      });
    }

    const pageBase = env.MIDTRANS_IS_PRODUCTION
      ? "https://app.midtrans.com/snap/v2/vtweb"
      : "https://app.sandbox.midtrans.com/snap/v2/vtweb";

    return ok({
      mode: "snap",
      order_id: order.orderId,
      reused: order.reused,
      subscription_id: order.subscriptionId,
      plan_name: order.planName,
      amount: order.amount,
      client_key: order.clientKey,
      snap_token: json.token,
      redirect_url: json.redirect_url ?? `${pageBase}/${json.token}`,
    });
  } catch (err) {
    return ok({
      mode: "snap_unreachable",
      order_id: order.orderId,
      reused: order.reused,
      subscription_id: order.subscriptionId,
      plan_name: order.planName,
      amount: order.amount,
      error: err instanceof Error ? err.message : "Midtrans unreachable",
      snap_token: null,
      redirect_url: null,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Current subscription snapshot + plan catalogue for the billing card. */
export async function GET() {
  const session = await requireTenant();
  if (!session) return fail("Unauthorized", 401);

  const snapshot = await subscriptionSnapshot(session.sub);

  return ok({
    subscription: snapshot,
    plans: [
      {
        id: PRICING_PLANS.PRO_MONTHLY.id,
        name: PRICING_PLANS.PRO_MONTHLY.name,
        price: PRICING_PLANS.PRO_MONTHLY.price,
        duration_days: PRICING_PLANS.PRO_MONTHLY.durationDays,
        per_day: Math.round(PRICING_PLANS.PRO_MONTHLY.price / 30),
      },
      {
        id: PRICING_PLANS.PRO_ANNUAL.id,
        name: PRICING_PLANS.PRO_ANNUAL.name,
        price: PRICING_PLANS.PRO_ANNUAL.price,
        duration_days: PRICING_PLANS.PRO_ANNUAL.durationDays,
        per_month: Math.round(PRICING_PLANS.PRO_ANNUAL.price / 12),
        savings: PRICING_PLANS.PRO_MONTHLY.price * 12 - PRICING_PLANS.PRO_ANNUAL.price,
      },
    ],
  });
}
