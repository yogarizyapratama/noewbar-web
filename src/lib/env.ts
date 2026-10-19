import { z } from "zod";

/**
 * Central environment contract.
 *
 * FAIL-CLOSED BY DESIGN: every value that is a credential (secret key, signing
 * key, internal shared token) is REQUIRED and has NO default. A deployment that
 * forgets one refuses to start instead of silently falling back to a value that
 * is public knowledge in this repository. That is the whole point: a guard like
 * `if (!env.WHATSMEOW_SECRET) return false` is dead code when the schema hands
 * the variable a non-empty default.
 *
 * Non-secret infrastructure addresses (host, port, model id) keep a neutral
 * localhost default so a fresh checkout can boot against a local stack, but they
 * never carry a real credential or leak an internal topology address.
 */
const booleanish = z
  .union([z.literal("true"), z.literal("false"), z.boolean()])
  .transform((v) => v === true || v === "true");

const envSchema = z.object({
  // Database (credential: the URL embeds the password)
  DATABASE_URL: z.string().min(1),

  // MinIO S3
  MINIO_ENDPOINT: z.string().default("127.0.0.1"),
  MINIO_PORT: z.string().default("9000"),
  MINIO_USE_SSL: booleanish.default(false),
  MINIO_ACCESS_KEY: z.string().min(1, "MINIO_ACCESS_KEY wajib diisi (tanpa default)"),
  MINIO_SECRET_KEY: z.string().min(1, "MINIO_SECRET_KEY wajib diisi (tanpa default)"),
  MINIO_BUCKET: z.string().default("noewbar-assets"),
  // Public base URL for stored objects. Left empty the callers derive it from
  // MINIO_ENDPOINT/PORT/BUCKET, so no internal address is baked into source.
  MINIO_PUBLIC_URL: z.string().default(""),

  // 9router AI gateway
  AI_GATEWAY_URL: z.string().default("http://127.0.0.1:20128/v1"),
  AI_MODEL: z.string().default("combo-ai"),
  AI_API_KEY: z.string().default(""),
  // Comma-separated fallback model ids tried in order when the primary model
  // returns an empty completion (e.g. a gateway upstream stuck "in_progress").
  AI_FALLBACK_MODELS: z.string().default("combo-free"),
  // How many past chat messages are replayed to the model as conversation
  // context. 12 (~6 exchanges) covers a full inquiry -> order flow; a smaller
  // window makes the bot forget what it just quoted, and image messages consume
  // a slot each. Each extra message costs only ~27 tokens, and the whole history
  // is roughly 7% of a reply's input tokens (tool schemas dominate), so this is
  // a quality knob, not a cost knob. Clamped to 0..50.
  AI_MAX_HISTORY_MESSAGES: z.coerce.number().int().min(0).max(50).default(12),

  // Whatsmeow daemon
  WHATSMEOW_URL: z.string().default("http://127.0.0.1:8088"),
  // Internal shared secret between the webhook and the Go daemon. REQUIRED: an
  // empty value would make the webhook accept anonymous callers.
  WHATSMEOW_SECRET: z.string().min(1, "WHATSMEOW_SECRET wajib diisi (fail-closed)"),

  // Telegram emergency alert
  TELEGRAM_BOT_TOKEN: z.string().default(""),
  TELEGRAM_ADMIN_CHAT_ID: z.string().default(""),

  // Midtrans billing
  MIDTRANS_SERVER_KEY: z.string().default(""),
  MIDTRANS_CLIENT_KEY: z.string().default(""),
  MIDTRANS_IS_PRODUCTION: booleanish.default(false),
  MIDTRANS_NOTIFICATION_URL: z.string().default("http://localhost:3001/api/billing/webhook"),

  // Redis / BullMQ
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),

  // Auth. REQUIRED: this key signs every session token. A default here means
  // any read of this repository can forge a superadmin session.
  NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET wajib diisi, minimal 32 karakter (fail-closed)"),
  NEXTAUTH_URL: z.string().default("http://localhost:3001"),

  // App
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3001"),
  NEXT_PUBLIC_APP_NAME: z.string().default("Noewbar CS Pro"),

  // Superadmin. Neutral default so no real operator address is baked in; the
  // password hash is empty-by-default and must be a real Argon2id PHC string.
  SUPERADMIN_EMAIL: z.string().default("superadmin@localhost"),
  SUPERADMIN_PASSWORD_HASH: z
    .string()
    .default("")
    .transform((val) => val.replace(/\\+(\$)/g, "$1")),

  // Playground (public landing-page simulator) catalog source.
  // Empty means the playground reports an honest "not configured" state instead
  // of fabricating a catalog.
  PLAYGROUND_SHEET_URL: z.string().default(""),

  // Optional public logistics provider endpoints (no-key). When empty the engine
  // relies on the documented local estimation fallback.
  COURIER_PUBLIC_API_URL: z.string().default(""),

  // Optional multi-provider logistics API keys (Biteship, RajaOngkir)
  BITESHIP_API_KEY: z.string().default(""),
  RAJAONGKIR_API_KEY: z.string().default(""),
});

const isBrowser = typeof window !== "undefined";
const parsed = isBrowser ? null : envSchema.safeParse(process.env);

if (!isBrowser && (!parsed || !parsed.success)) {
  const detail = parsed!.error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration -> ${detail}`);
}

export const env: z.infer<typeof envSchema> = (
  isBrowser ? ({} as z.infer<typeof envSchema>) : parsed!.data
) as z.infer<typeof envSchema>;

export const MINIO_BASE: string = isBrowser
  ? ""
  : `http${env.MINIO_USE_SSL ? "s" : ""}://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`;

/** Public base for stored objects; falls back to the derived MinIO origin. */
export const MINIO_PUBLIC_BASE: string = isBrowser
  ? ""
  : env.MINIO_PUBLIC_URL || `${MINIO_BASE}/${env.MINIO_BUCKET}`;

export const isProduction: boolean = isBrowser ? false : env.MIDTRANS_IS_PRODUCTION;

/** True when a real argon2id hash is configured for the superadmin account. */
export const hasValidSuperadminHash: boolean = isBrowser
  ? false
  : Boolean(env.SUPERADMIN_PASSWORD_HASH && env.SUPERADMIN_PASSWORD_HASH.startsWith("$argon2"));
