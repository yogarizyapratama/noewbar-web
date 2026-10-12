/** Shapes returned by the dashboard APIs, shared by every tab panel. */

export type Health = {
  tenant: { business_name: string; status: string; trial_expires_at: string } | null;
  whatsapp: {
    daemon_reachable: boolean;
    connection_status: string;
    phone_number: string | null;
    last_seen: string | null;
    error: string | null;
  };
  catalog: {
    configured: boolean;
    sheets_url: string | null;
    origin_subdistrict: string | null;
    last_synced_at: string | null;
    bank_name: string;
    bank_account_number: string;
    bank_account_holder: string;
    qris_key: { key: string; url: string } | null;
    bot_name?: string;
    bot_tone?: string;
    custom_persona_prompt?: string;
    greeting_message?: string;
  };
  persona?: {
    bot_name: string;
    bot_tone: string;
    custom_persona_prompt: string;
    greeting_message: string;
  };
  promos?: {
    promo_rules: TenantPromoTier[];
    voucher_rules: TenantVoucher[];
  };
  shipping?: TenantShippingSchedule;
  storage?: StorageStats;
  media_uploads?: number;
  subscription?: {
    is_expired: boolean;
    is_expiring_soon: boolean;
    days_remaining: number;
    status: string;
    plan_name: string | null;
    expires_at: string | null;
    reason: string | null;
  };
  ai: { gateway_ok: boolean; model: string; latency_ms: number; error: string | null };
  telegram: { ok: boolean; username: string | null };
  queue: { redis: boolean; waiting: number; delayed: number; pendingInDb: number };
  pending_proofs: number;
};

export type TenantPromoTier = {
  min_qty: number;
  discount_percent: number;
  promo_name: string;
};

export type TenantVoucher = {
  code: string;
  discount_amount?: number;
  discount_percent?: number;
};

export type TenantShippingSchedule = {
  cut_off_hour: number;
  open_hour: number;
  close_hour: number;
};

export type StorageStats = {
  used_bytes: number;
  quota_bytes: number;
  used_percent: number;
};

export type OrderItem = {
  sku: string;
  name: string;
  variant: string;
  qty: number;
  line_total: number;
};

export type OrderRow = {
  id: string;
  order_number: string;
  buyer_name: string | null;
  buyer_jid: string;
  total_amount: number;
  subtotal: number;
  shipping_tariff: number;
  unique_code: number;
  courier: string | null;
  destination_subdistrict: string | null;
  shipping_is_estimate: boolean;
  order_status: string;
  order_status_label: string;
  payment_status: string;
  payment_status_label: string;
  proof_media_url: string | null;
  reservation_expires_at: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  created_at: string;
  items: OrderItem[];
};

export type ConversationRow = {
  id: string;
  buyer_jid: string;
  buyer_name: string | null;
  pipeline_stage: string;
  is_human_takeover: boolean;
  message_count: number;
  last_interaction: string;
};

export type MessageRow = {
  id: string;
  sender_type: string;
  message_type: string;
  content: string;
  media_url: string | null;
  created_at: string;
};

export type Billing = {
  subscription: {
    planName: string | null;
    status: string;
    expiresAt: string | null;
    daysRemaining: number | null;
    amount: number | null;
  };
};
