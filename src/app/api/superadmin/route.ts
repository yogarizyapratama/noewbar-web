import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { ok, fail } from "@/lib/http";
import { requireAdmin, loginSuperadmin, registerTenant, ADMIN_COOKIE, COOKIE_OPTIONS, superadminHashConfigured } from "@/lib/auth";
import { env } from "@/lib/env";
import { gatewayHealth } from "@/lib/ai/orchestrator";
import { waDaemon } from "@/lib/wa/daemon-client";
import { nudgeQueueStats } from "@/lib/queue/nudge-queue";
import { getKillSwitch, setKillSwitch } from "@/lib/system/killswitch";
import { recentWebhookEvents } from "@/lib/webhooks/idempotency";
import { reconcileSubscriptions, fetchMidtransStatus } from "@/lib/billing/midtrans";
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

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("login"), email: z.string().email(), password: z.string().min(1) }),
  z.object({ action: z.literal("logout") }),
  z.object({ action: z.literal("kill_switch"), disabled: z.boolean() }),
  z.object({ action: z.literal("tenant_status"), tenant_id: z.string().uuid(), status: z.enum(["TRIAL", "ACTIVE", "GRACE_PERIOD", "SUSPENDED"]) }),
  z.object({ action: z.literal("extend_trial"), tenant_id: z.string().uuid(), days: z.number().int().min(1).max(90).default(7) }),
  z.object({ action: z.literal("wipe_tenant"), tenant_id: z.string().uuid(), confirm: z.literal("HAPUS") }),
  z.object({ action: z.literal("sync_midtrans"), order_id: z.string().min(3) }),
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
    password: z.string().min(6),
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
]);

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return fail("Aksi tidak valid", 422, parsed.error.issues);

  const body = parsed.data;

  if (body.action === "login") {
    const res = await loginSuperadmin(body.email, body.password);
    if (!res.ok) return fail(res.error, 401);

    const response = ok({ action: "login", authenticated: true });
    response.cookies.set(ADMIN_COOKIE, res.token, { ...COOKIE_OPTIONS, maxAge: 60 * 60 * 24 * 7 });
    return response;
  }

  // All non-login actions require an admin session.
  const admin = await requireAdmin();
  if (!admin) return fail("Unauthorized", 401);

  if (body.action === "logout") {
    const response = ok({ action: "logout", authenticated: false });
    response.cookies.set(ADMIN_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
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
    await prisma.webhookEvent.create({
      data: {
        provider: "TELEGRAM",
        event_key: `wipe:${body.tenant_id}:${Date.now()}`,
        event_type: "tenant_wiped",
        payload: { by: admin.email, tenant_id: body.tenant_id } as Prisma.InputJsonValue,
      },
    });
    notifyAdmin({ type: "fleet" });
    return ok({ action: "wipe_tenant", tenant_id: body.tenant_id, wiped: true });
  }

  if (body.action === "sync_midtrans") {
    const status = await fetchMidtransStatus(body.order_id);
    return ok({ action: "sync_midtrans", order_id: body.order_id, ...status });
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

    notifyAdmin({ type: "fleet" });
    return ok({ action: "create_tenant", tenant_id: reg.tenantId });
  }

  if (body.action === "test_ai_gateway") {
    const health = await gatewayHealth();
    return ok({ action: "test_ai_gateway", ...health });
  }

  if (body.action === "broadcast_tenants") {
    const admin = await requireAdmin();
    if (!admin) return fail("Unauthorized", 401);

    // Find all ACTIVE WA instances for tenants
    const whereClause = body.tenant_ids?.length
      ? { tenant_id: { in: body.tenant_ids }, connection_status: "CONNECTED" }
      : { connection_status: "CONNECTED" };

    const instances = await prisma.waInstance.findMany({
      where: whereClause,
      select: { instance_key: true, phone_number: true, tenant: { select: { business_name: true, id: true } } },
    });

    const results: { instance_key: string; tenant: string; ok: boolean; error?: string }[] = [];
    for (const inst of instances) {
      if (!inst.phone_number) {
        results.push({ instance_key: inst.instance_key, tenant: inst.tenant.business_name, ok: false, error: "no phone" });
        continue;
      }
      try {
        // Send to the tenant's own WA number (owner phone = phone_number registered)
        await waDaemon.sendText({ instanceKey: inst.instance_key, to: inst.phone_number, message: body.message });
        results.push({ instance_key: inst.instance_key, tenant: inst.tenant.business_name, ok: true });
        // Notify tenant dashboard via SSE
        notifyTenant(inst.tenant.id, { type: "billing" });
      } catch (e) {
        results.push({ instance_key: inst.instance_key, tenant: inst.tenant.business_name, ok: false, error: String(e) });
      }
      // Brief pause to avoid daemon rate limiting
      await new Promise((r) => setTimeout(r, 300));
    }

    const sent = results.filter((r) => r.ok).length;
    return ok({ action: "broadcast_tenants", total: results.length, sent, failed: results.length - sent, results });
  }

  return fail("Unsupported action", 400);
}

/** Full console snapshot: telemetry for every panel of chapter 11. */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return fail("Unauthorized", 401);

  const [
    gateway,
    daemonHealth,
    queue,
    telegram,
    redis,
    webhooks,
    tenants,
    instances,
    subscriptionCounts,
    recentOrders,
    totalTenantsCount,
    totalOrdersCount,
    totalConversationsCount,
    totalProductsCount,
  ] = await Promise.all([
    gatewayHealth(),
    waDaemon.health(),
    nudgeQueueStats(),
    telegramHealth(),
    redisHealthy(),
    recentWebhookEvents(15),
    prisma.tenant.findMany({
      orderBy: { created_at: "desc" },
      take: 50,
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
    prisma.order.count(),
    prisma.conversation.count(),
    prisma.product.count(),
  ]);

  // 9router latency sample: one real round-trip measured now.
  let gatewayLatencyMs: number | null = null;
  if (gateway.ok) gatewayLatencyMs = gateway.latencyMs;

  return ok({
    kill_switch: getKillSwitch(),
    superadmin_hash_configured: superadminHashConfigured(),
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
    queue,
    redis,
    telegram: { ok: telegram.ok, username: telegram.username ?? null, error: telegram.error ?? null },
    webhooks,
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
