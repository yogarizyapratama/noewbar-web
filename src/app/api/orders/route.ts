import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { requireTenant } from "@/lib/auth";
import { getTenantSubscriptionInfo } from "@/lib/billing/subscription-guard";
import {
  toSummary,
  verifyPayment,
  submitPaymentProof,
  markUnderReview,
  releaseReservation,
  expireStaleReservations,
  shipOrder,
} from "@/lib/orders/orders";
import { escalateToOwner } from "@/lib/alerts/dispatcher";
import { ORDER_LABEL, PAYMENT_LABEL, type OrderState, type PaymentState } from "@/lib/orders/state";
import { notifyTenant } from "@/lib/realtime/event-bus";

/**
 * Store-owner order operations (chapter 8.C, chapter 10.B "Galeri Struk Pembeli").
 *
 * The decisive rule lives in `verifyPayment`: only the owner can move a payment to
 * VERIFIED, and only that transition unlocks PROCESSING. AI can never reach this
 * state, which is what protects the store from edited transfer screenshots.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("verify"),
    order_id: z.string().uuid(),
    approve: z.boolean().optional().default(true),
    note: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("review"),
    order_id: z.string().uuid(),
  }),
  z.object({
    action: z.literal("submit_proof"),
    order_id: z.string().uuid(),
    media_url: z.string().min(4),
    ocr: z.record(z.unknown()).optional(),
  }),
  z.object({
    action: z.literal("release"),
    order_id: z.string().uuid(),
  }),
  z.object({
    action: z.literal("ship"),
    order_id: z.string().uuid(),
    tracking_number: z.string().min(3).max(100),
    courier: z.string().max(50).optional(),
  }),
  z.object({
    action: z.literal("sweep_expired"),
  }),
]);

export async function POST(req: NextRequest) {
  const session = await requireTenant();
  if (!session) return fail("Unauthorized", 401);

  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return fail("Aksi tidak valid", 422, parsed.error.issues);

  const body = parsed.data;

  const subInfo = await getTenantSubscriptionInfo(session.sub);
  if (subInfo.isExpired) {
    return fail("Langganan Anda telah berakhir. Perbarui paket untuk menggunakan fitur ini.", 403);
  }

  if (body.action === "sweep_expired") {
    const res = await expireStaleReservations(session.sub);
    return ok({ action: "sweep_expired", ...res });
  }

  if (body.action === "release") {
    // Tenant isolation: confirm ownership before touching the order.
    const owned = await prisma.order.findFirst({
      where: { id: body.order_id, tenant_id: session.sub },
      select: { id: true },
    });
    if (!owned) return fail("Order not found", 404);

    const released = await releaseReservation(body.order_id);
    return ok({ action: "release", order_id: body.order_id, released });
  }

  if (body.action === "submit_proof") {
    const owned = await prisma.order.findFirst({
      where: { id: body.order_id, tenant_id: session.sub },
      select: { id: true, buyer_jid: true, buyer_name: true, conversation_id: true, total_amount: true },
    });
    if (!owned) return fail("Order not found", 404);

    const res = await submitPaymentProof({
      orderId: body.order_id,
      mediaUrl: body.media_url,
      ocr: body.ocr ?? {},
    });

    if (!res.ok) return fail(res.error, 409);

    // Chapter 8.C.4 step 6: alert the owner on both channels.
    const dispatch = await escalateToOwner({
      tenantId: session.sub,
      conversationId: owned.conversation_id,
      buyerJid: owned.buyer_jid,
      buyerName: owned.buyer_name,
      reason: "proof_of_payment",
      summary: `Bukti transfer Rp ${Number(owned.total_amount).toLocaleString("id-ID")} menunggu verifikasi manual.`,
      detailLines: [
        `Analisis OCR AI: informasi pendukung saja, bukan bukti dana masuk.`,
        "Cek mutasi rekening riil lalu klik Verifikasi di dashboard.",
      ],
      title: "BUKTI TRANSFER MASUK",
    });

    // SSE: a new proof arrived -> dashboard refreshes the proof gallery.
    notifyTenant(session.sub, { type: "proof" });

    return ok({
      action: "submit_proof",
      payment_status: res.paymentStatus,
      alert_whatsapp: dispatch.whatsapp.delivered,
      alert_telegram: dispatch.telegram.delivered,
    });
  }

  const order = await prisma.order.findFirst({
    where: { id: body.order_id, tenant_id: session.sub },
  });
  if (!order) return fail("Order not found", 404);

  if (body.action === "review") {
    try {
      await markUnderReview(body.order_id);
    } catch (err) {
      return fail(err instanceof Error ? err.message : "Transition failed", 409);
    }
    return ok({ action: "review", payment_status: "UNDER_REVIEW" });
  }

  if (body.action === "ship") {
    const res = await shipOrder({
      orderId: body.order_id,
      tenantId: session.sub,
      trackingNumber: body.tracking_number,
      courierOverride: body.courier,
    });
    if (!res.ok) return fail(res.error, 409);

    notifyTenant(session.sub, { type: "order" });
    return ok({ action: "ship", order_status: res.orderStatus });
  }

  // action === "verify"
  const res = await verifyPayment({
    orderId: body.order_id,
    verifiedBy: session.email,
    approve: body.approve,
  });

  if (!res.ok) return fail(res.error, 409);

  notifyTenant(session.sub, { type: "verified" });

  return ok({
    action: "verify",
    order_id: body.order_id,
    payment_status: res.paymentStatus,
    order_status: res.orderStatus,
    note: body.note ?? null,
  });
}

/**
 * Order board for the dashboard. Tenant-scoped (chapter 16: cross-tenant leakage).
 */
export async function GET(req: NextRequest) {
  const session = await requireTenant();
  if (!session) return fail("Unauthorized", 401);

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("payment_status");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 200);

  const orders = await prisma.order.findMany({
    where: {
      tenant_id: session.sub,
      ...(statusFilter && statusFilter !== "ALL"
        ? { payment_status: statusFilter as PaymentState }
        : {}),
    },
    orderBy: { created_at: "desc" },
    take: limit,
  });

  const counts = await prisma.order.groupBy({
    by: ["payment_status"],
    where: { tenant_id: session.sub },
    _count: { _all: true },
  });

  return ok({
    orders: orders.map(toSummary).map((o) => ({
      ...o,
      order_status_label: ORDER_LABEL[o.order_status as OrderState] ?? o.order_status,
      payment_status_label: PAYMENT_LABEL[o.payment_status as PaymentState] ?? o.payment_status,
    })),
    counts: counts.reduce<Record<string, number>>((acc, c) => {
      acc[c.payment_status] = c._count._all;
      return acc;
    }, {}),
  });
}
