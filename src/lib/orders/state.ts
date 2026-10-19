/**
 * The two separated state machines of chapter 8.C.5.
 *
 * An order may only enter PROCESSING after the payment has been VERIFIED by the
 * store owner. These transitions are the only legal ones; anything else throws.
 */

export const ORDER_STATES = [
  "DRAFT",
  "PENDING_CONFIRMATION",
  "PENDING_PAYMENT",
  "PROCESSING",
  "READY_TO_SHIP",
  "SHIPPED",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
] as const;

export const PAYMENT_STATES = [
  "UNPAID",
  "PROOF_SUBMITTED",
  "UNDER_REVIEW",
  "VERIFIED",
  "REJECTED",
] as const;

export type OrderState = (typeof ORDER_STATES)[number];
export type PaymentState = (typeof PAYMENT_STATES)[number];

const ORDER_TRANSITIONS: Record<OrderState, OrderState[]> = {
  DRAFT: ["PENDING_CONFIRMATION", "CANCELLED"],
  PENDING_CONFIRMATION: ["PENDING_PAYMENT", "CANCELLED"],
  PENDING_PAYMENT: ["PROCESSING", "CANCELLED", "EXPIRED"],
  PROCESSING: ["READY_TO_SHIP", "SHIPPED", "CANCELLED"],
  READY_TO_SHIP: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
};

const PAYMENT_TRANSITIONS: Record<PaymentState, PaymentState[]> = {
  UNPAID: ["PROOF_SUBMITTED", "VERIFIED", "REJECTED"],
  PROOF_SUBMITTED: ["PROOF_SUBMITTED", "UNDER_REVIEW", "VERIFIED", "REJECTED"],
  UNDER_REVIEW: ["PROOF_SUBMITTED", "VERIFIED", "REJECTED"],
  // A rejected payment can be re-submitted or directly verified by merchant bank mutation check
  REJECTED: ["PROOF_SUBMITTED", "VERIFIED"],
  VERIFIED: [],
};

export function canTransitionOrder(from: OrderState, to: OrderState): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionPayment(from: PaymentState, to: PaymentState): boolean {
  return PAYMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertOrderTransition(from: OrderState, to: OrderState): void {
  if (!canTransitionOrder(from, to)) {
    throw new Error(`Illegal order transition: ${from} -> ${to}`);
  }
}

export function assertPaymentTransition(from: PaymentState, to: PaymentState): void {
  if (!canTransitionPayment(from, to)) {
    throw new Error(`Illegal payment transition: ${from} -> ${to}`);
  }
}

/**
 * Chapter 8.C.5 guard: an order cannot reach PROCESSING while the payment is not
 * VERIFIED. This is the single hard gate that keeps fake receipts out of fulfilment.
 */
export function assertFulfilmentAllowed(orderState: OrderState, paymentState: PaymentState): void {
  if (orderState === "PROCESSING" && paymentState !== "VERIFIED") {
    throw new Error("Order cannot enter PROCESSING before the payment is VERIFIED");
  }
}

export const ORDER_PROGRESS: { state: OrderState; label: string }[] = [
  { state: "PENDING_PAYMENT", label: "Menunggu Pembayaran" },
  { state: "PROCESSING", label: "Diproses" },
  { state: "READY_TO_SHIP", label: "Siap Kirim" },
  { state: "SHIPPED", label: "Dikirim" },
  { state: "COMPLETED", label: "Selesai" },
];

export const PAYMENT_LABEL: Record<PaymentState, string> = {
  UNPAID: "Belum Bayar",
  PROOF_SUBMITTED: "Bukti Diterima",
  UNDER_REVIEW: "Sedang Diperiksa",
  VERIFIED: "Terverifikasi",
  REJECTED: "Ditolak",
};

export const ORDER_LABEL: Record<OrderState, string> = {
  DRAFT: "Draft",
  PENDING_CONFIRMATION: "Menunggu Konfirmasi",
  PENDING_PAYMENT: "Menunggu Pembayaran",
  PROCESSING: "Diproses",
  READY_TO_SHIP: "Siap Kirim",
  SHIPPED: "Dikirim",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
  EXPIRED: "Kedaluwarsa",
};
