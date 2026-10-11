import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { ok, fail, rateLimit } from "@/lib/http";
import { hashPassword } from "@/lib/crypto";
import {
  COOKIE_OPTIONS,
  TENANT_COOKIE,
  loginTenant,
  registerTenant,
  getTenantSession,
  getAdminSession,
} from "@/lib/auth";

/**
 * Tenant authentication + trial registration (chapter 14.2, 7-day free trial).
 * No external auth provider: Argon2id + HMAC session cookie.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  intent: z.literal("login"),
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  intent: z.literal("register"),
  email: z.string().email(),
  password: z.string().min(8, "Password minimal 8 karakter"),
  business_name: z.string().min(2),
  owner_name: z.string().min(2),
  owner_whatsapp: z.string().min(9),
  // Optional at signup: both live in the Katalog & media tab and can be filled in
  // later. Requiring them here blocked trial signup for data that is not needed to
  // start (an unconfigured catalog already returns a clean "not connected" state).
  sheets_url: z.string().optional().default(""),
  origin_subdistrict: z.string().optional().default(""),
  owner_telegram_chat_id: z.string().optional().default(""),
});

const bodySchema = z.discriminatedUnion("intent", [loginSchema, registerSchema]);

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limiter = rateLimit(`auth:${ip}`, 12, 60_000);
  if (!limiter.allowed) return fail("Terlalu banyak percobaan. Coba lagi sebentar lagi.", 429);

  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return fail("Data tidak valid", 422, parsed.error.issues);

  if (parsed.data.intent === "login") {
    const result = await loginTenant(parsed.data.email, parsed.data.password);
    if (!result.ok) return fail(result.error, 401);

    const tenant = await prisma.tenant.findUnique({
      where: { id: result.tenantId },
      select: { id: true, status: true, business_name: true, trial_expires_at: true },
    });

    const res = ok({
      intent: "login",
      tenant: tenant
        ? {
            id: tenant.id,
            status: tenant.status,
            business_name: tenant.business_name,
            trial_expires_at: tenant.trial_expires_at.toISOString(),
          }
        : null,
    });
    res.cookies.set(TENANT_COOKIE, result.token, {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  }

  const result = await registerTenant({
    email: parsed.data.email,
    password: parsed.data.password,
    businessName: parsed.data.business_name,
    ownerName: parsed.data.owner_name,
    ownerWhatsapp: parsed.data.owner_whatsapp,
    sheetsUrl: parsed.data.sheets_url,
    originSubdistrict: parsed.data.origin_subdistrict,
    ownerTelegramChatId: parsed.data.owner_telegram_chat_id || undefined,
  });

  if (!result.ok) return fail(result.error, 400);

  // Immediately issue a session so the new store lands in the dashboard.
  const login = await loginTenant(parsed.data.email, parsed.data.password);
  if (!login.ok) {
    return ok({ intent: "register", tenant_id: result.tenantId, auto_login: false });
  }

  const res = ok({ intent: "register", tenant_id: result.tenantId, auto_login: true });
  res.cookies.set(TENANT_COOKIE, login.token, { ...COOKIE_OPTIONS, maxAge: 60 * 60 * 24 * 7 });
  return res;
}

/** Session probe used by the dashboard shell. */
export async function GET() {
  const session = await getTenantSession();
  if (!session) return ok({ authenticated: false });

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, business_name: true, status: true, trial_expires_at: true },
  });

  if (!tenant) return ok({ authenticated: false });

  return ok({
    authenticated: true,
    tenant: {
      id: tenant.id,
      email: tenant.email,
      business_name: tenant.business_name,
      status: tenant.status,
      trial_expires_at: tenant.trial_expires_at.toISOString(),
    },
  });
}

/** Logout: clears the session cookie. */
export async function DELETE() {
  const res = ok({ logged_out: true });
  res.cookies.set(TENANT_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  return res;
}

/** Exposed so the admin password-hash helper can reuse the same hasher. */
export async function PUT(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return fail("Unauthorized", 401);

  const body = (await req.json().catch(() => null)) as { password?: string } | null;
  if (!body?.password || body.password.length < 8) {
    return fail("Password minimal 8 karakter", 422);
  }

  const hash = await hashPassword(body.password);

  // Persisted only to the audit ledger; the operator copies it into .env.
  await prisma.webhookEvent.create({
    data: {
      provider: "TELEGRAM",
      event_key: `admin:hash:${Date.now()}`,
      event_type: "superadmin_hash_generated",
      payload: { generated: true, algorithm: "argon2id" } as Prisma.InputJsonValue,
    },
  });

  return ok({
    algorithm: "argon2id",
    hash,
    env_line: `SUPERADMIN_PASSWORD_HASH="${hash}"`,
    note: "Salin ke .env lalu restart aplikasi. Hash tidak ditampilkan lagi setelah ini.",
  });
}
