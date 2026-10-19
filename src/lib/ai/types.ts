/**
 * Shared AI domain types (chapters 6 and 8.C).
 */

/** One catalog row, mirroring the store owner's spreadsheet columns. */
export type ProductRow = {
  sku: string;
  name: string;
  variant: string;
  price: number;
  stock: number;
  photo_url: string | null;
  video_url: string | null;
  // Extended catalog columns (optional for backward compatibility)
  description?: string | null;
  category?: string | null;
  weight_grams?: number | null;
  is_active?: boolean;
};

/** The micro-tools of the Micro-Agent Tool Engine (chapter 6). */
export type ToolName =
  | "tool_cari_produk"
  | "tool_ambil_foto_video"
  | "tool_cek_ongkir"
  | "tool_atur_nudge"
  | "tool_oper_manusia"
  | "tool_cek_status_order"
  | "tool_baca_panduan_toko"
  | "tool_rekomendasi_ukuran"
  | "tool_hitung_promo_bundling"
  | "tool_cek_jadwal_pengiriman"
  | "tool_rekomendasi_alternatif";

export const TOOL_NAMES: ToolName[] = [
  "tool_cari_produk",
  "tool_ambil_foto_video",
  "tool_cek_ongkir",
  "tool_atur_nudge",
  "tool_oper_manusia",
  "tool_cek_status_order",
  "tool_baca_panduan_toko",
  "tool_rekomendasi_ukuran",
  "tool_hitung_promo_bundling",
  "tool_cek_jadwal_pengiriman",
  "tool_rekomendasi_alternatif",
];

/** Buyer intent classification used for routing and pipeline staging. */
export type BuyerIntent =
  | "INQUIRY"
  | "REQUEST_PHOTO"
  | "SHIPPING_CHECK"
  | "READY_TO_BUY"
  | "NEGOTIATION"
  | "COMPLAINT"
  | "OUT_OF_SCOPE";

export type CartLine = {
  sku: string;
  name: string;
  variant: string;
  price: number;
  qty: number;
  line_total: number;
  weight_grams?: number | null;
};

/** Aturan Promo Bundling per tenant: [{ min_qty: 2, discount_percent: 5, promo_name: "Diskon 2 pcs" }] */
export type TenantPromoTier = {
  min_qty: number;
  discount_percent: number;
  promo_name: string;
};

/** Aturan Voucher per tenant */
export type TenantVoucher = {
  code: string;
  discount_amount?: number;
  discount_percent?: number;
};

/** Jadwal Pengiriman dan Cut-off per tenant */
export type TenantShippingSchedule = {
  cut_off_hour: number;
  open_hour: number;
  close_hour: number;
};

/**
 * Everything a tool needs. Assembled once per inbound message so a tool never
 * re-reads the catalog or re-resolves the tenant mid-conversation.
 */
export type ToolContext = {
  tenantId: string;
  conversationId: string;
  buyerJid: string;
  buyerName: string | null;
  instanceKey: string | null;
  originSubdistrict: string;
  nudgeDelayMinutes: number;
  catalog: ProductRow[];
  catalogSource: "sheet" | "cache";
  /**
   * Payment destination, filled by the store owner in the dashboard. The model
   * may only echo these values back, never invent them (anti-hallucination).
   */
  payment: {
    bankName: string;
    bankAccountNumber: string;
    bankAccountHolder: string;
    qrisUrl: string | null;
  };
  /** Dynamic per-tenant promo bundling rules */
  promoRules?: TenantPromoTier[];
  /** Dynamic per-tenant voucher rules */
  voucherRules?: TenantVoucher[];
  /** Dynamic per-tenant shipping schedule & cut-off */
  shippingSchedule?: TenantShippingSchedule;
};

/** Structurally identical to the OpenAI function-calling tool schema. */
export type ToolSchema = {
  type: "function";
  function: {
    name: ToolName;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
};

/** A media payload the orchestrator decided to send alongside the text reply. */
export type OutboundMedia = {
  kind: "image" | "video" | "document";
  url: string;
  caption?: string;
  sku?: string;
};

export type ToolExecutionResult = {
  tool: ToolName;
  /** Compact JSON handed back to the model as the tool message. */
  payload: unknown;
  /** Human readable trace line for the dashboard activity feed. */
  summary: string;
  /** Side effect: the orchestrator should send these files to the buyer. */
  media: OutboundMedia[];
  /** Side effect: booking was escalated to the store owner. */
  escalated: boolean;
};
