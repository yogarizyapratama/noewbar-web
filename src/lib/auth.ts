import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { env } from "@/lib/env";
import {
  createToken,
  verifyToken,
  verifyPassword,
  hashPassword,
  generateInstanceKey,
  safeEqual,
  type SessionPayload,
  type AdminPayload,
} from "@/lib/crypto";

/**
 * Authentication (chapter 14.2).
 *
 * Two independent principals:
 *   - TENANT    : store owner logging into /dashboard. Credentials in `tenants`.
 *   - SUPERADMIN: platform operator at /superadmin. Credentials from env.
 *
 * Tokens are HMAC-SHA256 signed payloads (no external auth dependency), stored in
 * httpOnly cookies.
 */

export const TENANT_COOKIE = "noewbar_session";
export const ADMIN_COOKIE = "noewbar_admin";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const TRIAL_DAYS = 7;

export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

// ---------------------------------------------------------------------------
// Tenant sessions
// ---------------------------------------------------------------------------

export async function loginTenant(
  email: string,
  password: string
): Promise<{ ok: true; token: string; tenantId: string } | { ok: false; error: string }> {
  const tenant = await prisma.tenant.findUnique({ where: { email: email.toLowerCase().trim() } });

  // Same generic message for unknown email and wrong password (no user enumeration).
  const genericError = "Email atau password salah";

  if (!tenant) return { ok: false, error: genericError };

  const valid = await verifyPassword(password, tenant.password_hash);
  if (!valid) return { ok: false, error: genericError };

  const token = createToken<SessionPayload>(
    {
      sub: tenant.id,
      email: tenant.email,
      role: "TENANT",
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    },
    env.NEXTAUTH_SECRET
  );

  return { ok: true, token, tenantId: tenant.id };
}

export async function getTenantSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(TENANT_COOKIE)?.value;
  if (!token) return null;

  const payload = verifyToken<SessionPayload>(token, env.NEXTAUTH_SECRET);
  if (!payload || payload.role !== "TENANT") return null;
  return payload;
}

/** Resolves the full tenant record for the active session, or null. */
export async function getCurrentTenant() {
  const session = await getTenantSession();
  if (!session) return null;

  return prisma.tenant.findUnique({
    where: { id: session.sub },
    include: { catalog_settings: true, wa_instances: true, subscriptions: { orderBy: { created_at: "desc" }, take: 1 } },
  });
}

// ---------------------------------------------------------------------------
// Registration / trial
// ---------------------------------------------------------------------------

export type RegisterInput = {
  email: string;
  password: string;
  businessName: string;
  ownerName: string;
  ownerWhatsapp: string;
  sheetsUrl: string;
  originSubdistrict: string;
  ownerTelegramChatId?: string;
};

export async function registerTenant(
  input: RegisterInput
): Promise<{ ok: true; tenantId: string } | { ok: false; error: string }> {
  const email = input.email.toLowerCase().trim();

  const existing = await prisma.tenant.findUnique({ where: { email } });
  if (existing) return { ok: false, error: "Email sudah terdaftar" };

  const passwordHash = await hashPassword(input.password);
  const trialExpiresAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000);

  const tenant = await prisma.tenant.create({
    data: {
      email,
      password_hash: passwordHash,
      business_name: input.businessName.trim(),
      owner_name: input.ownerName.trim(),
      owner_whatsapp: input.ownerWhatsapp.replace(/[^0-9]/g, ""),
      owner_telegram_chat_id: input.ownerTelegramChatId?.trim() || null,
      status: "TRIAL",
      trial_expires_at: trialExpiresAt,
      catalog_settings: {
        create: {
          // Both may be empty: the signup form treats them as optional and the
          // Katalog & media tab is where they get filled in. fetchCatalog already
          // fails closed on an empty URL instead of fetching nothing.
          sheets_url: input.sheetsUrl.trim(),
          origin_subdistrict: input.originSubdistrict.trim(),
          nudge_delay_minutes: 120,
          auto_reply_enabled: true,
          alert_whatsapp_enabled: true,
          alert_telegram_enabled: Boolean(input.ownerTelegramChatId),
        },
      },
      wa_instances: {
        create: {
          instance_key: generateInstanceKey(input.businessName),
          connection_status: "OFFLINE",
        },
      },
    },
  });

  return { ok: true, tenantId: tenant.id };
}

// ---------------------------------------------------------------------------
// Superadmin sessions
// ---------------------------------------------------------------------------

/**
 * The superadmin password hash must be a real Argon2id PHC string. A placeholder
 * (e.g. the literal "$argon2id$...$noewbarAdminPasswordHash2026" shipped in the
 * environment template) is structurally invalid and can never authenticate, so a
 * misconfigured deployment fails closed instead of accepting a guessable password.
 */
export function superadminHashConfigured(): boolean {
  const hash = (env.SUPERADMIN_PASSWORD_HASH || "").replace(/\\+(\$)/g, "$1");
  return /^\$argon2(id|i|d)\$v=\d+\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/.test(
    hash
  );
}

export async function loginSuperadmin(
  email: string,
  password: string
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const genericError = "Kredensial admin salah";

  if (!safeEqual(email.toLowerCase().trim(), env.SUPERADMIN_EMAIL.toLowerCase().trim())) {
    return { ok: false, error: genericError };
  }

  if (!superadminHashConfigured()) {
    return {
      ok: false,
      error:
        "SUPERADMIN_PASSWORD_HASH belum diisi dengan hash Argon2id yang valid. Jalankan: npm run admin:hash -- <password>",
    };
  }

  const hash = (env.SUPERADMIN_PASSWORD_HASH || "").replace(/\\+(\$)/g, "$1");
  const valid = await verifyPassword(password, hash);
  if (!valid) return { ok: false, error: genericError };

  const token = createToken<AdminPayload>(
    {
      sub: "superadmin",
      email: env.SUPERADMIN_EMAIL,
      role: "SUPERADMIN",
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    },
    env.NEXTAUTH_SECRET
  );

  return { ok: true, token };
}

export async function getAdminSession(): Promise<AdminPayload | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return null;

  const payload = verifyToken<AdminPayload>(token, env.NEXTAUTH_SECRET);
  if (!payload || payload.role !== "SUPERADMIN") return null;
  return payload;
}

/** Guard helper for API routes: returns the tenant session or null. */
export async function requireTenant(): Promise<SessionPayload | null> {
  const session = await getTenantSession();
  if (!session) return null;

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.sub },
    select: { id: true, status: true },
  });

  // SUSPENDED tenants lose API access entirely.
  if (!tenant || tenant.status === "SUSPENDED") return null;
  return session;
}

export async function requireAdmin(): Promise<AdminPayload | null> {
  return getAdminSession();
}
