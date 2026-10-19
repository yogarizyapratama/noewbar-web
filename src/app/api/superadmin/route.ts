import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { ok, fail, rateLimit } from "@/lib/http";
import {
  requireAdmin,
  loginSuperadmin,
  registerTenant,
  createImpersonationToken,
  ADMIN_COOKIE,
  TENANT_COOKIE,
  COOKIE_OPTIONS,
  ADMIN_SESSION_TTL_SECONDS,
  superadminHashConfigured,
} from "@/lib/auth";
import { env } from "@/lib/env";
import { gatewayHealth } from "@/lib/ai/orchestrator";
import { waDaemon } from "@/lib/wa/daemon-client";
import { nudgeQueueStats } from "@/lib/queue/nudge-queue";
import { getKillSwitch, setKillSwitch } from "@/lib/system/killswitch";
import { reconcileSubscriptions } from "@/lib/billing/midtrans";
import { telegramHealth, sendTelegramAlert } from "@/lib/alerts/telegram";
import { redisHealthy } from "@/lib/queue/nudge-queue";
import { notifyAdmin, notifyTenant } from "@/lib/realtime/event-bus";
import { runMaintenanceSweep } from "@/lib/system/scheduler";

/**
 * Master Control Console API (chapter 11).
 *
 * Every panel reports a real probe result. Where a dependency is unreachable the
 * endpoint says so explicitly instead of rendering a green placeholder, so the
 * operator can distinguish "healthy" from "never asked".
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function logAdminAudit(
  adminEmail: string,
  eventType: string,
  tenantId?: string | null,
  payload?: Record<string, unknown>
) {
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: "SUPERADMIN_AUDIT",
        event_key: `audit:${eventType}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
        event_type: eventType,
        payload: { by: adminEmail, tenant_id: tenantId ?? null, ...payload } as Prisma.InputJsonValue,
      },
    });
  } catch {
    // Best-effort audit logging
  }
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("login"), email: z.string().email(), password: z.string().min(1) }),
  z.object({ action: z.literal("logout") }),
  z.object({ action: z.literal("impersonate_tenant"), tenant_id: z.string().uuid() }),
  z.object({ action: z.literal("kill_switch"), disabled: z.boolean() }),
  z.object({ action: z.literal("tenant_status"), tenant_id: z.string().uuid(), status: z.enum(["TRIAL", "ACTIVE", "GRACE_PERIOD", "SUSPENDED"]) }),
  z.object({ action: z.literal("extend_trial"), tenant_id: z.string().uuid(), days: z.number().int().min(1).max(90).default(7) }),
  z.object({ action: z.literal("wipe_tenant"), tenant_id: z.string().uuid(), confirm: z.literal("HAPUS") }),
  z.object({ action: z.literal("reconcile") }),
  z.object({ action: z.literal("restart_instance"), instance_key: z.string().min(1) }),
  z.object({ action: z.literal("fleet") }),
  z.object({ action: z.literal("trigger_maintenance") }),
  z.object({ action: z.literal("test_telegram") }),
  z.object({
    action: z.literal("create_tenant"),
    business_name: z.string().min(2),
    owner_name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    owner_whatsapp: z.string().min(8),
    status: z.enum(["TRIAL", "ACTIVE"]).default("TRIAL"),
    trial_days: z.number().int().min(1).max(365).default(14),
  }),
  z.object({ action: z.literal("test_ai_gateway") }),
  z.object({
    action: z.literal("broadcast_tenants"),
    message: z.string().min(1).max(4000),
    tenant_ids: z.array(z.string().uuid()).optional(),
  }),
  z.object({ action: z.literal("superadmin_wa_status") }),
  z.object({ action: z.literal("superadmin_wa_start") }),
  z.object({ action: z.literal("superadmin_wa_logout") }),
]);

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && !origin.includes(host)) {
    return fail("Akses lintas domain ditolak (CSRF protection)", 403);
  }

  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return fail("Aksi tidak valid", 422, parsed.error.issues);

  const body = parsed.data;

  if (body.action === "login") {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const limiter = rateLimit(`admin:login:${ip}`, 5, 60_000);
    if (!limiter.allowed) {
      return fail("Terlalu banyak percobaan login admin. Tunggu 1 menit.", 429);
    }

    const res = await loginSuperadmin(body.email, body.password);
    if (!res.ok) return fail(res.error, 401);

    await logAdminAudit(body.email, "admin_login_success");

    const response = ok({ action: "login", authenticated: true });
    response.cookies.set(ADMIN_COOKIE, res.token, { ...COOKIE_OPTIONS, maxAge: ADMIN_SESSION_TTL_SECONDS });
    return response;
  }

  // All non-login actions require an admin session.
  const admin = await requireAdmin();
  if (!admin) return fail("Unauthorized", 401);

  if (body.action === "logout") {
    await logAdminAudit(admin.email, "admin_logout");
    const response = ok({ action: "logout", authenticated: false });
    response.cookies.set(ADMIN_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
    return response;
  }

  if (body.action === "impersonate_tenant") {
    const token = await createImpersonationToken(body.tenant_id);
    if (!token) return fail("Tenant tidak ditemukan", 404);

    await logAdminAudit(admin.email, "impersonate_tenant", body.tenant_id, { tenant_id: body.tenant_id });

    const response = ok({ action: "impersonate_tenant", redirect: "/dashboard", tenant_id: body.tenant_id });
    response.cookies.set(TENANT_COOKIE, token, { ...COOKIE_OPTIONS, maxAge: 60 * 30 }); // 30 minutes
    return response;
  }

  if (body.action === "kill_switch") {
    const state = setKillSwitch(body.disabled, admin.email);
    await prisma.webhookEvent.create({
      data: {
        provider: "TELEGRAM",
        event_key: `killswitch:${Date.now()}`,
        event_type: body.disabled ? "bot_disabled" : "bot_enabled",
        payload: { by: admin.email, state } as Prisma.InputJsonValue,
      },
    });
    await logAdminAudit(admin.email, body.disabled ? "killswitch_disabled" : "killswitch_enabled", null, { state });
    notifyAdmin({ type: "killswitch" });
    return ok({ action: "kill_switch", state });
  }

  if (body.action === "tenant_status") {
    const tenant = await prisma.tenant.update({
      where: { id: body.tenant_id },
      data: { status: body.status },
      select: { id: true, business_name: true, status: true },
    });
    await prisma.subscription.updateMany({
      where: { tenant_id: body.tenant_id, status: { not: "EXPIRED" } },
      data: { status: body.status === "SUSPENDED" ? "EXPIRED" : body.status },
    });
    await logAdminAudit(admin.email, "tenant_status_changed", body.tenant_id, { status: body.status });
    notifyTenant(body.tenant_id, { type: "wa_status" });
    notifyAdmin({ type: "fleet" });
    return ok({ action: "tenant_status", tenant });
  }

  if (body.action === "extend_trial") {
    const tenant = await prisma.tenant.findUnique({
      where: { id: body.tenant_id },
      select: { trial_expires_at: true },
    });
    if (!tenant) return fail("Tenant not found", 404);

    const base = tenant.trial_expires_at > new Date() ? tenant.trial_expires_at : new Date();
    const next = new Date(base.getTime() + body.days * 86_400_000);

    const updated = await prisma.tenant.update({
      where: { id: body.tenant_id },
      data: { trial_expires_at: next, status: "TRIAL" },
      select: { id: true, business_name: true, status: true, trial_expires_at: true },
    });

    await logAdminAudit(admin.email, "extend_trial", body.tenant_id, { days: body.days });
    notifyTenant(body.tenant_id, { type: "billing" });
    notifyAdmin({ type: "fleet" });

    return ok({
      action: "extend_trial",
      tenant: { ...updated, trial_expires_at: updated.trial_expires_at.toISOString() },
    });
  }

  if (body.action === "wipe_tenant") {
    // Cascading deletes remove conversations, messages, orders and subscriptions.
    await prisma.tenant.delete({ where: { id: body.tenant_id } });
    await logAdminAudit(admin.email, "tenant_wiped", body.tenant_id, {});
    notifyAdmin({ type: "fleet" });
    return ok({ action: "wipe_tenant", tenant_id: body.tenant_id, wiped: true });
  }

  if (body.action === "reconcile") {
    const res = await reconcileSubscriptions();
    return ok({ action: "reconcile", ...res });
  }

  if (body.action === "restart_instance") {
    const instance = await prisma.waInstance.findUnique({
      where: { instance_key: body.instance_key },
      select: { instance_key: true, tenant_id: true },
    });
    if (!instance) return fail("Instance not found", 404);

    const logout = await waDaemon.logout(instance.instance_key);
    const init = await waDaemon.initInstance(
      instance.instance_key,
      `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/wa-webhook`
    );

    await prisma.waInstance.update({
      where: { instance_key: instance.instance_key },
      data: {
        connection_status: init.ok ? init.data.status : "OFFLINE",
        phone_number: init.ok ? init.data.phone_number || null : null,
        last_seen: new Date(),
      },
    });

    notifyTenant(instance.tenant_id, { type: "wa_status" });
    notifyAdmin({ type: "fleet" });

    return ok({
      action: "restart_instance",
      instance_key: instance.instance_key,
      logout_ok: logout.ok,
      restart_ok: init.ok,
      connection_status: init.ok ? init.data.status : "OFFLINE",
      error: init.ok ? null : init.error,
    });
  }

  if (body.action === "trigger_maintenance") {
    const sweep = await runMaintenanceSweep({ nudgeLimit: 50, reconcile: true });
    notifyAdmin({ type: "alert" });
    return ok({ action: "trigger_maintenance", sweep, at: new Date().toISOString() });
  }

  if (body.action === "test_telegram") {
    const alert = await sendTelegramAlert("NOEWBAR MASTER CONSOLE: Uji coba notifikasi platform berhasil.");
    return ok({ action: "test_telegram", delivered: alert.delivered, error: alert.error ?? null });
  }

  if (body.action === "create_tenant") {
    const reg = await registerTenant({
      email: body.email,
      password: body.password,
      businessName: body.business_name,
      ownerName: body.owner_name,
      ownerWhatsapp: body.owner_whatsapp,
      sheetsUrl: "",
      originSubdistrict: "",
    });
    if (!reg.ok) return fail(reg.error, 400);

    const trialExpiresAt = new Date(Date.now() + body.trial_days * 86_400_000);
    await prisma.tenant.update({
      where: { id: reg.tenantId },
      data: {
        status: body.status,
        trial_expires_at: trialExpiresAt,
      },
    });

    await logAdminAudit(admin.email, "tenant_created", reg.tenantId, {
      business_name: body.business_name,
      email: body.email,
    });

    notifyAdmin({ type: "fleet" });
    return ok({ action: "create_tenant", tenant_id: reg.tenantId });
  }

  if (body.action === "test_ai_gateway") {
    const health = await gatewayHealth();
    return ok({ action: "test_ai_gateway", ...health });
  }

  const SUPERADMIN_INSTANCE_KEY = "noewbar-superadmin";

  if (body.action === "superadmin_wa_start") {
    const admin = await requireAdmin();
    if (!admin) return fail("Unauthorized", 401);

    const webhookUrl = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/wa-webhook`;
    const initRes = await waDaemon.initInstance(SUPERADMIN_INSTANCE_KEY, webhookUrl);
    if (!initRes.ok) {
      return fail(initRes.error, 502);
    }
    const qrRes = await waDaemon.getQr(SUPERADMIN_INSTANCE_KEY);
    return ok({
      action: "superadmin_wa_start",
      connection_status: qrRes.ok ? qrRes.data.status : initRes.data.status,
      qr_base64: qrRes.ok ? qrRes.data.qr_base64 : initRes.data.qr_base64,
      phone_number: qrRes.ok ? qrRes.data.phone_number : initRes.data.phone_number,
    });
  }

  if (body.action === "superadmin_wa_status") {
    const admin = await requireAdmin();
    if (!admin) return fail("Unauthorized", 401);

    const [statusRes, qrRes] = await Promise.all([
      waDaemon.getStatus(SUPERADMIN_INSTANCE_KEY),
      waDaemon.getQr(SUPERADMIN_INSTANCE_KEY),
    ]);

    return ok({
      action: "superadmin_wa_status",
      connection_status: statusRes.ok ? statusRes.data.connection_status : "OFFLINE",
      phone_number: statusRes.ok ? statusRes.data.phone_number : null,
      qr_base64: qrRes.ok ? qrRes.data.qr_base64 : null,
    });
  }

  if (body.action === "superadmin_wa_logout") {
    const admin = await requireAdmin();
    if (!admin) return fail("Unauthorized", 401);

    const res = await waDaemon.logout(SUPERADMIN_INSTANCE_KEY);
    return ok({
      action: "superadmin_wa_logout",
      success: res.ok,
      error: res.ok ? null : res.error,
    });
  }

  if (body.action === "broadcast_tenants") {
    const admin = await requireAdmin();
    if (!admin) return fail("Unauthorized", 401);

    // Verify Super Admin WhatsApp is connected
    const saStatus = await waDaemon.getStatus(SUPERADMIN_INSTANCE_KEY);
    if (!saStatus.ok || saStatus.data.connection_status !== "CONNECTED") {
      return fail(
        "WhatsApp Super Admin belum terhubung. Silakan buka menu 'Koneksi WA Super Admin' dan scan QR terlebih dahulu sebelum melakukan siaran.",
        400
      );
    }

    // Find target tenants
    const whereClause = body.tenant_ids?.length
      ? { id: { in: body.tenant_ids } }
      : {};

    const targetTenants = await prisma.tenant.findMany({
      where: whereClause,
      select: { id: true, business_name: true, owner_whatsapp: true },
      orderBy: { business_name: "asc" },
    });

    if (targetTenants.length === 0) {
      return fail("Tidak ada tenant penerima yang ditemukan.", 400);
    }

    const results: { tenant_id: string; tenant: string; phone: string; ok: boolean; error?: string }[] = [];
    for (const t of targetTenants) {
      const phone = t.owner_whatsapp?.replace(/[^\d+]/g, "") || "";
      if (!phone || phone.length < 8) {
        results.push({
          tenant_id: t.id,
          tenant: t.business_name,
          phone: t.owner_whatsapp || "-",
          ok: false,
          error: "Nomor WhatsApp pemilik tidak valid atau kosong",
        });
        continue;
      }
      try {
        await waDaemon.sendText({
          instanceKey: SUPERADMIN_INSTANCE_KEY,
          to: phone,
          message: body.message,
        });
        results.push({ tenant_id: t.id, tenant: t.business_name, phone, ok: true });
        // Notify tenant dashboard via SSE
        notifyTenant(t.id, { type: "billing" });
      } catch (e) {
        results.push({ tenant_id: t.id, tenant: t.business_name, phone, ok: false, error: String(e) });
      }
      // Brief pause to avoid rate limiting
      await new Promise((r) => setTimeout(r, 350));
    }

    const sent = results.filter((r) => r.ok).length;
    await logAdminAudit(admin.email, "broadcast_sent", null, {
      total: results.length,
      sent,
      failed: results.length - sent,
    });
    return ok({ action: "broadcast_tenants", total: results.length, sent, failed: results.length - sent, results });
  }

  return fail("Unsupported action", 400);
}

/** Full console snapshot: telemetry for every panel of chapter 11. */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return fail("Unauthorized", 401);

  const url = new URL(req.url);
  const search = (url.searchParams.get("search") || "").trim();
  const statusFilter = url.searchParams.get("status") || "all";
  const limit = Math.min(200, Math.max(10, parseInt(url.searchParams.get("limit") || "100", 10)));
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const skip = (page - 1) * limit;

  const tenantWhere: Prisma.TenantWhereInput = {};
  if (statusFilter !== "all" && ["ACTIVE", "TRIAL", "SUSPENDED", "GRACE_PERIOD"].includes(statusFilter)) {
    tenantWhere.status = statusFilter as any;
  }
  if (search) {
    tenantWhere.OR = [
      { business_name: { contains: search, mode: "insensitive" } },
      { owner_name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { owner_whatsapp: { contains: search } },
    ];
  }

  const [
    gateway,
    daemonHealth,
    queue,
    telegram,
    redis,
    tenants,
    instances,
    subscriptionCounts,
    recentOrders,
    totalTenantsCount,
    filteredTenantsCount,
    totalOrdersCount,
    totalConversationsCount,
    totalProductsCount,
    saWaStatus,
    activeSubs,
    gmvAggregate,
    recentAudits,
  ] = await Promise.all([
    gatewayHealth(),
    waDaemon.health(),
    nudgeQueueStats(),
    telegramHealth(),
    redisHealthy(),
    prisma.tenant.findMany({
      where: tenantWhere,
      orderBy: { created_at: "desc" },
      take: limit,
      skip: skip,
      include: {
        catalog_settings: { select: { sheets_url: true, origin_subdistrict: true, last_synced_at: true } },
        subscriptions: { orderBy: { created_at: "desc" }, take: 1 },
        _count: { select: { conversations: true, orders: true, knowledge_docs: true, products: true, websites: true } },
      },
    }),
    prisma.waInstance.findMany({
      orderBy: { created_at: "asc" },
      take: 200,
      include: { tenant: { select: { business_name: true } } },
    }),
    prisma.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.findMany({
      orderBy: { created_at: "desc" },
      take: 20,
      include: { tenant: { select: { business_name: true } } },
    }),
    prisma.tenant.count(),
    prisma.tenant.count({ where: tenantWhere }),
    prisma.order.count(),
    prisma.conversation.count(),
    prisma.product.count(),
    waDaemon.getStatus("noewbar-superadmin").catch(() => ({ ok: false as const, error: "offline" })),
    prisma.subscription.findMany({
      where: { status: "ACTIVE" },
      select: { amount: true, plan_name: true },
    }),
    prisma.order.aggregate({
      _sum: { total_amount: true },
      where: { payment_status: "PAID" },
    }),
    prisma.webhookEvent.findMany({
      where: { provider: "SUPERADMIN_AUDIT" },
      orderBy: { created_at: "desc" },
      take: 25,
      select: { id: true, event_type: true, payload: true, created_at: true },
    }),
  ]);

  // 9router latency sample: one real round-trip measured now.
  let gatewayLatencyMs: number | null = null;
  if (gateway.ok) gatewayLatencyMs = gateway.latencyMs;

  // Calculate SaaS Financial Metrics
  const mrr = activeSubs.reduce((acc, s) => {
    const amt = Number(s.amount);
    return acc + (s.plan_name?.toUpperCase().includes("ANNUAL") ? Math.round(amt / 12) : amt);
  }, 0);
  const arr = mrr * 12;
  const gmv = Number(gmvAggregate._sum.total_amount || 0);

  const totalSubsAll = subscriptionCounts.reduce((acc, c) => acc + c._count._all, 0);
  const expiredSubs = subscriptionCounts.find((c) => c.status === "EXPIRED")?._count._all ?? 0;
  const churnRatePct = totalSubsAll > 0 ? Math.round((expiredSubs / totalSubsAll) * 100 * 10) / 10 : 0;

  // Fleet self-healing: the daemon is the ground truth for socket state.
  await Promise.all(
    instances.map(async (inst) => {
      try {
        const live = await waDaemon.getStatus(inst.instance_key);
        if (!live.ok) return;
        if (
          live.data.connection_status !== inst.connection_status ||
          (live.data.phone_number || null) !== inst.phone_number
        ) {
          await prisma.waInstance.update({
            where: { id: inst.id },
            data: {
              connection_status: live.data.connection_status,
              phone_number: live.data.phone_number || null,
              last_seen: new Date(),
            },
          });
          inst.connection_status = live.data.connection_status;
          inst.phone_number = live.data.phone_number || null;
          inst.last_seen = new Date();
        }
      } catch {
        /* keep the stored row for this instance */
      }
    })
  );

  return ok({
    kill_switch: getKillSwitch(),
    superadmin_hash_configured: superadminHashConfigured(),
    financial_metrics: {
      mrr,
      arr,
      gmv,
      churn_rate_pct: churnRatePct,
      active_subscribers: activeSubs.length,
    },
    audit_logs: recentAudits.map((a) => ({
      id: a.id,
      event_type: a.event_type,
      payload: (a.payload || {}) as Record<string, unknown>,
      created_at: a.created_at.toISOString(),
    })),
    pagination: {
      page,
      limit,
      total_filtered: filteredTenantsCount,
      total_pages: Math.ceil(filteredTenantsCount / limit),
    },
    gateway: {
      ok: gateway.ok,
      url: env.AI_GATEWAY_URL,
      model: env.AI_MODEL,
      models: gateway.models.slice(0, 40),
      latency_ms: gatewayLatencyMs,
      error: gateway.error ?? null,
    },
    daemon: {
      ok: daemonHealth.ok,
      url: waDaemon.baseUrl,
      active_instances: daemonHealth.ok ? daemonHealth.data.active_instances : null,
      uptime_reported_at: daemonHealth.ok ? daemonHealth.data.time : null,
      error: daemonHealth.ok ? null : daemonHealth.error,
    },
    superadmin_wa: {
      connection_status: saWaStatus.ok ? saWaStatus.data.connection_status : "OFFLINE",
      phone_number: saWaStatus.ok ? saWaStatus.data.phone_number : null,
    },
    queue,
    redis,
    telegram: { ok: telegram.ok, username: telegram.username ?? null, error: telegram.error ?? null },
    fleet: instances.map((i) => ({
      instance_key: i.instance_key,
      tenant: i.tenant.business_name,
      connection_status: i.connection_status,
      phone_number: i.phone_number,
      last_seen: i.last_seen?.toISOString() ?? null,
    })),
    tenants: tenants.map((t) => ({
      id: t.id,
      business_name: t.business_name,
      owner_name: t.owner_name,
      email: t.email,
      owner_whatsapp: t.owner_whatsapp,
      status: t.status,
      created_at: t.created_at.toISOString(),
      trial_expires_at: t.trial_expires_at.toISOString(),
      conversations: t._count.conversations,
      orders: t._count.orders,
      knowledge_docs: t._count.knowledge_docs,
      products: t._count.products,
      websites: t._count.websites,
      sheet: t.catalog_settings
        ? {
            url: t.catalog_settings.sheets_url,
            origin: t.catalog_settings.origin_subdistrict,
            last_synced_at: t.catalog_settings.last_synced_at?.toISOString() ?? null,
          }
        : null,
      subscription: t.subscriptions[0]
        ? {
            plan: t.subscriptions[0].plan_name,
            status: t.subscriptions[0].status,
            expires_at: t.subscriptions[0].expires_at.toISOString(),
            amount: Number(t.subscriptions[0].amount),
          }
        : null,
    })),
    subscription_counts: subscriptionCounts.reduce<Record<string, number>>((acc, c) => {
      acc[c.status] = c._count._all;
      return acc;
    }, {}),
    recent_orders: recentOrders.map((o) => ({
      id: o.id,
      order_number: o.order_number,
      tenant_id: o.tenant_id,
      tenant: o.tenant.business_name,
      order_status: o.order_status,
      payment_status: o.payment_status,
      total: Number(o.total_amount),
      created_at: o.created_at.toISOString(),
    })),
    system_stats: {
      node_version: process.version,
      memory_heap_used_mb: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 10) / 10,
      memory_rss_mb: Math.round((process.memoryUsage().rss / 1024 / 1024) * 10) / 10,
      uptime_seconds: Math.round(process.uptime()),
      total_tenants: totalTenantsCount,
      total_orders: totalOrdersCount,
      total_conversations: totalConversationsCount,
      total_products: totalProductsCount,
    },
  });
}
