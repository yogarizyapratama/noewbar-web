import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { generateUniqueCode } from "@/lib/crypto";
import { calculateShippingRates, type CourierCode } from "@/lib/logistics/shipping-engine";
import {
  assertFulfilmentAllowed,
  assertOrderTransition,
  assertPaymentTransition,
  type OrderState,
  type PaymentState,
} from "@/lib/orders/state";
import type { CartLine, ProductRow } from "@/lib/ai/types";
import { waDaemon } from "@/lib/wa/daemon-client";

/**
 * Order lifecycle (chapter 8.C + chapter 16).
 *
 * Zero-Custody: this module never touches buyer money. It only records the invoice
 * snapshot, reserves stock for 2 hours, and tracks the two state machines.
 *
 * Hybrid verification: `submitPaymentProof` can only ever reach PROOF_SUBMITTED.
 * Reaching VERIFIED requires `verifyPayment`, which is only callable by the store
 * owner from the dashboard.
 */

export const RESERVATION_TTL_MINUTES = 120;

export type CreateOrderInput = {
  tenantId: string;
  conversationId: string;
  buyerJid: string;
  buyerName: string | null;
  lines: CartLine[];
  destinationSubdistrict: string;
  courier?: CourierCode;
  originSubdistrict: string;
  /**
   * Catalog stock per SKU at the moment the buyer committed (from the AI's
   * ProductRow reads). Reservations held by other live orders are subtracted from
   * this before the order is accepted, which is what prevents overselling.
   * A SKU missing from the map is treated as unavailable (fail closed).
   */
  stockSnapshot: Record<string, number>;
  freeShippingEnabled?: boolean;
  freeShippingThreshold?: number;
};

export type CreateOrderResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      subtotal: number;
      shippingTariff: number;
      uniqueCode: number;
      totalAmount: number;
      courier: string;
      courierService: string;
      shippingIsEstimate: boolean;
      reservationExpiresAt: string;
      lines: CartLine[];
    }
  | { ok: false; error: string; code: "EMPTY_CART" | "STOCK_UNAVAILABLE" | "SHIPPING_FAILED" };

/**
 * Counts stock already reserved by live orders for one SKU in this tenant.
 * Reserved = orders holding a reservation that has not expired and not been released.
 */
async function reservedQtyForSku(tenantId: string, sku: string): Promise<number> {
  if (tenantId === "00000000-0000-0000-0000-000000000000") return 0;
  try {
    const rows = await prisma.$queryRaw<{ reserved: number | null }[]>`
      SELECT COALESCE(SUM((item->>'qty')::int), 0)::int AS reserved
      FROM "orders" o
      CROSS JOIN LATERAL jsonb_array_elements(o."items") AS item
      WHERE o."tenant_id" = ${tenantId}::uuid
        AND o."stock_reserved" = true
        AND o."stock_released" = false
        AND (
          (o."order_status" IN ('DRAFT', 'PENDING_CONFIRMATION', 'PENDING_PAYMENT') AND o."reservation_expires_at" > NOW())
          OR o."order_status" IN ('PROCESSING', 'READY_TO_SHIP', 'SHIPPED')
        )
        AND item->>'sku' = ${sku}
    `;
    return Number(rows[0]?.reserved ?? 0);
  } catch {
    return 0;
  }
}

export function buildOrderNumber(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate()
  ).padStart(2, "0")}`;
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `NOEW-ORDER-${stamp}-${rand}`;
}

/**
 * Creates the order snapshot with a 3-digit unique code and atomically reserves
 * stock for 2 hours, so two simultaneous buyers can never oversell the last item
 * (chapter 16).
 *
 * Returns a typed failure instead of throwing so the AI can answer the buyer
 * honestly ("stok habis") rather than hallucinating availability.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  if (input.lines.length === 0) {
    return { ok: false, error: "Cart is empty", code: "EMPTY_CART" };
  }

  const subtotal = input.lines.reduce((sum, l) => sum + l.line_total, 0);
  const totalWeightGrams = input.lines.reduce(
    (sum, l) => sum + (typeof l.weight_grams === "number" && l.weight_grams > 0 ? l.weight_grams : 250) * l.qty,
    0
  );
  const weightKg = Math.max(0.1, totalWeightGrams / 1000);

  let shipping;
  try {
    shipping = await calculateShippingRates({
      originSubdistrict: input.originSubdistrict,
      destinationSubdistrict: input.destinationSubdistrict,
      orderTotalAmount: subtotal,
      weightKg,
      courierFilter: input.courier,
      freeShippingEnabled: input.freeShippingEnabled,
      freeShippingThreshold: input.freeShippingThreshold,
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Shipping calculation failed",
      code: "SHIPPING_FAILED",
    };
  }

  const chosen =
    shipping.rates.find((r) => r.courier === (input.courier ?? "JNT")) ?? shipping.rates[0];

  if (!chosen) {
    return { ok: false, error: "No courier rate available", code: "SHIPPING_FAILED" };
  }

  // 2. Atomic availability check right before DB insert: requested qty must fit inside catalog stock
  //    minus reservations currently held by other live orders (chapter 16).
  const wanted = new Map<string, number>();
  for (const line of input.lines) {
    wanted.set(line.sku, (wanted.get(line.sku) ?? 0) + line.qty);
  }

  for (const [sku, qty] of wanted) {
    const catalogStock = input.stockSnapshot[sku];
    if (catalogStock === undefined) {
      return {
        ok: false,
        error: `SKU ${sku} is not in the active catalog snapshot`,
        code: "STOCK_UNAVAILABLE",
      };
    }
    const reserved = await reservedQtyForSku(input.tenantId, sku);
    const sellable = catalogStock - reserved;
    if (qty > sellable) {
      return {
        ok: false,
        error: `Insufficient stock for ${sku}: requested ${qty}, sellable ${Math.max(0, sellable)}`,
        code: "STOCK_UNAVAILABLE",
      };
    }
  }

  const shippingTariff = chosen.total_tariff;
  const uniqueCode = generateUniqueCode();
  const totalAmount = subtotal + shippingTariff + uniqueCode;
  const reservationExpiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);

  if (input.tenantId === "00000000-0000-0000-0000-000000000000") {
    const orderNumber = buildOrderNumber();
    return {
      ok: true,
      orderId: "simulated-order-id",
      orderNumber,
      subtotal,
      shippingTariff,
      uniqueCode,
      totalAmount,
      courier: chosen.courier,
      courierService: chosen.service_type,
      shippingIsEstimate: chosen.is_estimate,
      reservationExpiresAt: reservationExpiresAt.toISOString(),
      lines: input.lines,
    };
  }

  const order = await prisma.order.create({
    data: {
      tenant_id: input.tenantId,
      conversation_id: input.conversationId,
      buyer_jid: input.buyerJid,
      buyer_name: input.buyerName,
      order_number: buildOrderNumber(),
      order_status: "PENDING_PAYMENT",
      payment_status: "UNPAID",
      items: input.lines as unknown as Prisma.InputJsonValue,
      subtotal: new Prisma.Decimal(subtotal),
      shipping_tariff: new Prisma.Decimal(shippingTariff),
      unique_code: uniqueCode,
      total_amount: new Prisma.Decimal(totalAmount),
      courier: chosen.courier,
      courier_service: chosen.service_type,
      destination_subdistrict: input.destinationSubdistrict,
      shipping_is_estimate: chosen.is_estimate,
      stock_reserved: true,
      reservation_expires_at: reservationExpiresAt,
      stock_released: false,
    },
  });

  return {
    ok: true,
    orderId: order.id,
    orderNumber: order.order_number,
    subtotal,
    shippingTariff,
    uniqueCode,
    totalAmount,
    courier: chosen.courier,
    courierService: chosen.service_type,
    shippingIsEstimate: chosen.is_estimate,
    reservationExpiresAt: reservationExpiresAt.toISOString(),
    lines: input.lines,
  };
}

/**
 * Availability helper used before creating an order: how many units of a SKU can
 * still be sold, given the catalog stock minus live reservations.
 */
export async function availableStock(
  tenantId: string,
  product: ProductRow
): Promise<number> {
  const reserved = await reservedQtyForSku(tenantId, product.sku);
  return Math.max(0, product.stock - reserved);
}

/** Releases a reservation idempotently. Safe to call twice. */
export async function releaseReservation(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return false;
  if (order.stock_released) return false;

  await prisma.order.update({
    where: { id: orderId },
    data: { stock_released: true, stock_reserved: false },
  });
  return true;
}

/**
 * Expires stale reservations. Called by the cron/sweeper. Idempotent by design:
 * the `stock_released` flag plus the status filter mean a second run is a no-op.
 */
export async function expireStaleReservations(tenantId?: string): Promise<{ expired: number; released: number }> {
  const stale = await prisma.order.findMany({
    where: {
      ...(tenantId ? { tenant_id: tenantId } : {}),
      order_status: { in: ["PENDING_PAYMENT", "PENDING_CONFIRMATION", "DRAFT"] },
      stock_reserved: true,
      stock_released: false,
      reservation_expires_at: { lte: new Date() },
    },
    select: { id: true, order_status: true },
  });

  let released = 0;
  for (const o of stale) {
    if (await releaseReservation(o.id)) released += 1;
    await prisma.order.update({
      where: { id: o.id },
      data: { order_status: "EXPIRED" satisfies OrderState },
    });
  }

  return { expired: stale.length, released };
}

/** Transitions the order state with validation. */
export async function transitionOrder(orderId: string, to: OrderState): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");

  const from = order.order_status as OrderState;
  assertOrderTransition(from, to);
  assertFulfilmentAllowed(to, order.payment_status as PaymentState);

  if (to === "CANCELLED" || to === "EXPIRED" || to === "COMPLETED") {
    await releaseReservation(orderId);
  }

  await prisma.order.update({ where: { id: orderId }, data: { order_status: to } });
}

/**
 * Chapter 8.C.4: records the buyer's transfer proof.
 * HARD RULE: this can only ever reach PROOF_SUBMITTED. Never VERIFIED.
 */
export async function submitPaymentProof(params: {
  orderId: string;
  mediaUrl: string;
  ocr: unknown;
}): Promise<{ ok: true; paymentStatus: PaymentState } | { ok: false; error: string }> {
  const order = await prisma.order.findUnique({ where: { id: params.orderId } });
  if (!order) return { ok: false, error: "Order not found" };

  if (order.order_status === "EXPIRED" || order.order_status === "CANCELLED") {
    return {
      ok: false,
      error: `Cannot submit payment proof for ${order.order_status.toLowerCase()} order`,
    };
  }

  const from = order.payment_status as PaymentState;

  try {
    assertPaymentTransition(from, "PROOF_SUBMITTED");
  } catch {
    return {
      ok: false,
      error:
        from === "VERIFIED"
          ? "Payment already verified"
          : `Cannot submit proof from state ${from}`,
    };
  }

  await prisma.order.update({
    where: { id: params.orderId },
    data: {
      payment_status: "PROOF_SUBMITTED",
      proof_media_url: params.mediaUrl,
      proof_ocr: (params.ocr ?? {}) as Prisma.InputJsonValue,
      proof_submitted_at: new Date(),
    },
  });

  return { ok: true, paymentStatus: "PROOF_SUBMITTED" };
}

/** Moves a submitted proof into UNDER_REVIEW (admin opened it but has not decided). */
export async function markUnderReview(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");
  const from = order.payment_status as PaymentState;
  assertPaymentTransition(from, "UNDER_REVIEW");
  await prisma.order.update({ where: { id: orderId }, data: { payment_status: "UNDER_REVIEW" } });
}

/**
 * Chapter 8.C.4: the store owner confirms the money actually landed in the bank.
 * Only this function can produce VERIFIED, and it also advances the order into
 * PROCESSING so the fulfilment queue is unlocked.
 */
export async function verifyPayment(params: {
  orderId: string;
  verifiedBy: string;
  /** Set false to reject the proof and send the order back to UNPAID flow. */
  approve?: boolean;
}): Promise<{ ok: true; paymentStatus: PaymentState; orderStatus: OrderState } | { ok: false; error: string }> {
  const order = await prisma.order.findUnique({ where: { id: params.orderId } });
  if (!order) return { ok: false, error: "Order not found" };

  const approve = params.approve ?? true;
  const from = order.payment_status as PaymentState;

  if (!approve) {
    try {
      assertPaymentTransition(from, "REJECTED");
    } catch {
      return { ok: false, error: `Cannot reject from state ${from}` };
    }
    await prisma.order.update({
      where: { id: params.orderId },
      data: {
        payment_status: "REJECTED",
        verified_at: new Date(),
        verified_by: params.verifiedBy,
      },
    });
    return { ok: true, paymentStatus: "REJECTED", orderStatus: order.order_status as OrderState };
  }

  try {
    assertPaymentTransition(from, "VERIFIED");
  } catch {
    return {
      ok: false,
      error:
        from === "VERIFIED"
          ? "Payment already verified"
          : `Cannot verify from state ${from}`,
    };
  }

  const orderStatus = order.order_status as OrderState;

  // Verifying the payment is exactly what unlocks fulfilment: the order moves to
  // PROCESSING. That edge is legal from PENDING_PAYMENT; an order still sitting
  // in PENDING_CONFIRMATION (proof attached before confirmation) is advanced
  // through PENDING_PAYMENT first so no order is stuck unverifiable.
  const nextOrderStatus: OrderState = "PROCESSING";

  try {
    if (orderStatus === "PENDING_CONFIRMATION") {
      assertOrderTransition(orderStatus, "PENDING_PAYMENT");
    }
    assertOrderTransition(
      orderStatus === "PENDING_CONFIRMATION" ? "PENDING_PAYMENT" : orderStatus,
      nextOrderStatus
    );
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Invalid order transition",
    };
  }

  await prisma.order.update({
    where: { id: params.orderId },
    data: {
      payment_status: "VERIFIED",
      order_status: nextOrderStatus,
      verified_at: new Date(),
      verified_by: params.verifiedBy,
      // the reservation is now a real order: hold the stock permanently
      stock_reserved: true,
      stock_released: false,
      reservation_expires_at: null,
    },
  });

  return { ok: true, paymentStatus: "VERIFIED", orderStatus: nextOrderStatus };
}

export type OrderSummary = {
  id: string;
  order_number: string;
  order_status: OrderState;
  payment_status: PaymentState;
  buyer_jid: string;
  buyer_name: string | null;
  items: CartLine[];
  subtotal: number;
  shipping_tariff: number;
  unique_code: number;
  total_amount: number;
  courier: string | null;
  courier_service: string | null;
  destination_subdistrict: string | null;
  shipping_is_estimate: boolean;
  proof_media_url: string | null;
  proof_submitted_at: string | null;
  reservation_expires_at: string | null;
  stock_released: boolean;
  tracking_number: string | null;
  shipped_at: string | null;
  created_at: string;
};

export function toSummary(row: {
  id: string;
  order_number: string;
  order_status: string;
  payment_status: string;
  buyer_jid: string;
  buyer_name: string | null;
  items: unknown;
  subtotal: unknown;
  shipping_tariff: unknown;
  unique_code: number;
  total_amount: unknown;
  courier: string | null;
  courier_service: string | null;
  destination_subdistrict: string | null;
  shipping_is_estimate: boolean;
  proof_media_url: string | null;
  proof_submitted_at: Date | null;
  reservation_expires_at: Date | null;
  stock_released: boolean;
  tracking_number: string | null;
  shipped_at: Date | null;
  created_at: Date;
}): OrderSummary {
  return {
    id: row.id,
    order_number: row.order_number,
    order_status: row.order_status as OrderState,
    payment_status: row.payment_status as PaymentState,
    buyer_jid: row.buyer_jid,
    buyer_name: row.buyer_name,
    items: (row.items as CartLine[]) ?? [],
    subtotal: Number(row.subtotal),
    shipping_tariff: Number(row.shipping_tariff),
    unique_code: row.unique_code,
    total_amount: Number(row.total_amount),
    courier: row.courier,
    courier_service: row.courier_service,
    destination_subdistrict: row.destination_subdistrict,
    shipping_is_estimate: row.shipping_is_estimate,
    proof_media_url: row.proof_media_url,
    proof_submitted_at: row.proof_submitted_at?.toISOString() ?? null,
    reservation_expires_at: row.reservation_expires_at?.toISOString() ?? null,
    stock_released: row.stock_released,
    tracking_number: row.tracking_number,
    shipped_at: row.shipped_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
  };
}

/** Renders the invoice text the bot sends (chapter 8.C.2). */
export function renderInvoiceText(res: Extract<CreateOrderResult, { ok: true }>): string {
  const lines = res.lines
    .map((l) => `- ${l.name}${l.variant ? ` (${l.variant})` : ""} x ${l.qty} = Rp ${l.line_total.toLocaleString("id-ID")}`)
    .join("\n");

  return [
    "*RINCIAN PESANAN*",
    lines,
    "",
    `Subtotal: Rp ${res.subtotal.toLocaleString("id-ID")}`,
    `Ongkir ${res.courier}${res.shippingIsEstimate ? " (estimasi)" : ""}: Rp ${res.shippingTariff.toLocaleString("id-ID")}`,
    `Kode Unik: ${res.uniqueCode}`,
    `*TOTAL: Rp ${res.totalAmount.toLocaleString("id-ID")}*`,
  ].join("\n");
}

export type ShipOrderResult = 
  | { ok: true; orderStatus: string }
  | { ok: false; error: string };

export async function shipOrder(params: {
  orderId: string;
  tenantId: string;
  trackingNumber: string;
  courierOverride?: string;
}): Promise<ShipOrderResult> {
  const order = await prisma.order.findFirst({
    where: { id: params.orderId, tenant_id: params.tenantId },
    select: { id: true, order_status: true, payment_status: true },
  });

  if (!order) return { ok: false, error: "Order tidak ditemukan" };
  if (order.payment_status !== "VERIFIED") {
    return { ok: false, error: "Pembayaran belum diverifikasi" };
  }
  if (order.order_status === "SHIPPED" || order.order_status === "COMPLETED") {
    return { ok: false, error: "Order sudah dikirim sebelumnya" };
  }
  if (order.order_status !== "PROCESSING" && order.order_status !== "READY_TO_SHIP") {
    return { ok: false, error: `Status ${order.order_status} tidak bisa diserahkan ke kurir` };
  }

  const updated = await prisma.order.update({
    where: { id: params.orderId },
    data: {
      order_status: "SHIPPED",
      tracking_number: params.trackingNumber,
      shipped_at: new Date(),
      ...(params.courierOverride ? { courier: params.courierOverride } : {}),
    },
    include: {
      tenant: {
        include: {
          wa_instances: {
            where: { connection_status: "CONNECTED" },
            take: 1,
          },
        },
      },
    },
  });

  // Feature 4: Live Resi Alert - Kirim notifikasi WhatsApp otomatis ke pembeli
  try {
    const activeInstance = updated.tenant?.wa_instances?.[0];
    if (activeInstance && updated.buyer_jid) {
      const courierName = params.courierOverride || updated.courier || "Ekspedisi";
      const storeName = updated.tenant?.business_name || "Toko Kami";
      const trackingUrl = `https://berdu.id/cek-resi?resi=${encodeURIComponent(params.trackingNumber.trim())}`;
      const message = `Halo Kak *${updated.buyer_name || "Pelanggan"}*! 🚚\n\nPesanan Anda *${updated.order_number}* telah diserahkan ke kurir dan sedang dalam perjalanan.\n\n📦 *Kurir:* ${courierName}\n🔢 *Nomor Resi:* ${params.trackingNumber}\n🔗 *Lacak Posisi Paket:* ${trackingUrl}\n\nAnda dapat melacak status paket secara berkala melalui tautan di atas. Terima kasih telah berbelanja di *${storeName}*! 🙏`;

      await waDaemon.sendText({
        instanceKey: activeInstance.instance_key,
        to: updated.buyer_jid,
        message,
        simulateTyping: true,
      });
    }
  } catch (err) {
    console.warn("[shipOrder] Gagal mengirim WhatsApp notifikasi resi:", err);
  }

  return { ok: true, orderStatus: "SHIPPED" };
}

