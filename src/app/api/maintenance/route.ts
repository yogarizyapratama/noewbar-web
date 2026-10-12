import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { requireTenant } from "@/lib/auth";
import { waDaemon } from "@/lib/wa/daemon-client";
import { nudgeQueueStats } from "@/lib/queue/nudge-queue";
import { runMaintenanceSweep, schedulerHealth } from "@/lib/system/scheduler";
import { telegramHealth } from "@/lib/alerts/telegram";
import { gatewayHealth } from "@/lib/ai/orchestrator";
import { safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";
import { publicUrlFor, tenantUsageBytes, TENANT_QUOTA_BYTES } from "@/lib/storage/minio";
import { getTenantSubscriptionInfo } from "@/lib/billing/subscription-guard";

/**
 * Maintenance / cron endpoint (chapter 12 + chapter 11).
 *
 * Covered jobs:
 *   - deliver due anti-ghosting nudges that Redis could not hold
 *   - expire and release stale 2-hour stock reservations (idempotent)
 *   - reconcile Midtrans subscriptions whose webhook never arrived
 *
 * Authentication: either the internal cron secret or a valid tenant session
 * (so a store owner can trigger their own maintenance from the dashboard).
 *
 * The work itself lives in `runMaintenanceSweep` so this endpoint and the
 * in-process scheduler (instrumentation.ts) share one implementation. Tenant
 * scope never runs the platform-wide subscription reconciler.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorizedCron(req: NextRequest): boolean {
  const provided = req.headers.get("x-noewbar-secret") ?? "";
  if (!env.WHATSMEOW_SECRET) return false;
  return safeEqual(provided, env.WHATSMEOW_SECRET);
}

export async function POST(req: NextRequest) {
  const isCron = authorizedCron(req);
  const session = isCron ? null : await requireTenant();

  if (!isCron && !session) return fail("Unauthorized", 401);

  const sweep = await runMaintenanceSweep({ nudgeLimit: 25, reconcile: isCron });

  return ok({
    ok: true,
    scope: isCron ? "platform" : "tenant",
    worker_started: sweep.worker,
    nudges_delivered: sweep.nudges.delivered ?? 0,
    nudges_error: sweep.nudges.error ?? null,
    reservations_expired: sweep.reservations.expired ?? 0,
    reservations_released: sweep.reservations.released ?? 0,
    reservations_error: sweep.reservations.error ?? null,
    reconciliation: isCron
      ? {
          checked: sweep.subscriptions.checked,
          activated: sweep.subscriptions.activated,
          grace: sweep.subscriptions.grace,
          suspended: sweep.subscriptions.suspended,
          errors: sweep.subscriptions.error ?? null,
        }
      : "skipped (tenant scope)",
    at: new Date().toISOString(),
  });
}

/** Health board for the dashboard status strip (real probes, no placeholders). */
export async function GET() {
  const session = await requireTenant();
  if (!session) return fail("Unauthorized", 401);

  // Soft-fail: the DB sits across a Tailscale relay that can blip. A blip must
  // degrade the board (HTTP 200 + degraded flag), never 500 the dashboard poll.
  try {
    return ok(await buildHealth(session.sub));
  } catch (err) {
    const [daemon, gateway, telegram] = await Promise.all([
      waDaemon.health().catch(() => null),
      gatewayHealth().catch(() => null),
      telegramHealth().catch(() => null),
    ]);
    return ok({
      degraded: true,
      error: err instanceof Error ? err.message : "health probe failed",
      tenant: null,
      subscription: null,
      whatsapp: {
        daemon_reachable: daemon?.ok ?? false,
        connection_status: "UNKNOWN",
        phone_number: null,
        last_seen: null,
        error: "Database tidak terjangkau sesaat, coba lagi.",
      },
      catalog: {
        configured: false,
        sheets_url: null,
        origin_subdistrict: null,
        last_synced_at: null,
        bank_name: "",
        bank_account_number: "",
        bank_account_holder: "",
        qris_key: null,
      },
      persona: {
        bot_name: "Admin CS",
        bot_tone: "RAMAH",
        custom_persona_prompt: "",
        greeting_message: "",
      },
      promos: { promo_rules: [], voucher_rules: [] },
      shipping: { cut_off_hour: 15, open_hour: 8, close_hour: 21 },
      storage: { used_bytes: 0, quota_bytes: TENANT_QUOTA_BYTES, used_percent: 0 },
      ai: {
        gateway_ok: gateway?.ok ?? false,
        model: null,
        latency_ms: gateway?.latencyMs ?? null,
        error: null,
      },
      telegram: { ok: telegram?.ok ?? false, username: telegram?.username ?? null },
      queue: { redis: false, waiting: 0, delayed: 0, pendingInDb: 0 },
      pending_proofs: null,
    });
  }
}

async function buildHealth(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { wa_instances: true, catalog_settings: true },
  });

  // Self-healing status: the daemon is the ground truth for pairing state.
  // A scan that succeeded outside any poll window, or a logout from the phone
  // itself, would otherwise leave the DB row (and the dashboard badge) stale.
  // Best-effort: a daemon hiccup must not fail the whole health board.
  let instance = tenant?.wa_instances[0];
  if (instance) {
    try {
      const live = await waDaemon.getStatus(instance.instance_key);
      if (live.ok && (live.data.connection_status !== instance.connection_status ||
          (live.data.phone_number || null) !== instance.phone_number)) {
        instance = await prisma.waInstance.update({
          where: { id: instance.id },
          data: {
            connection_status: live.data.connection_status,
            phone_number: live.data.phone_number || null,
            last_seen: new Date(),
          },
        });
      }
    } catch {
      /* keep the stored row; daemon reachability is reported separately */
    }
  }

  const [daemon, gateway, telegram, queue, storageUsed, subInfo] = await Promise.all([
    waDaemon.health(),
    gatewayHealth(),
    telegramHealth(),
    nudgeQueueStats(),
    tenantUsageBytes(tenantId),
    getTenantSubscriptionInfo(tenantId),
  ]);

  const scheduler = await schedulerHealth();

  const pendingProofs = await prisma.order.count({
    where: { tenant_id: tenantId, payment_status: { in: ["PROOF_SUBMITTED", "UNDER_REVIEW"] } },
  });

  return ok({
    tenant: tenant
      ? {
          id: tenant.id,
          business_name: tenant.business_name,
          status: tenant.status,
          trial_expires_at: tenant.trial_expires_at.toISOString(),
        }
      : null,
    subscription: {
      is_expired: subInfo.isExpired,
      is_expiring_soon: subInfo.isExpiringSoon,
      days_remaining: subInfo.daysRemaining,
      status: subInfo.status,
      plan_name: subInfo.planName,
      expires_at: subInfo.expiresAt?.toISOString() ?? null,
      reason: subInfo.reason ?? null,
    },
    whatsapp: {
      daemon_reachable: daemon.ok,
      connection_status: instance?.connection_status ?? "OFFLINE",
      phone_number: instance?.phone_number ?? null,
      last_seen: instance?.last_seen?.toISOString() ?? null,
      error: daemon.ok ? null : daemon.error,
    },
    catalog: {
      configured: Boolean(tenant?.catalog_settings?.sheets_url),
      sheets_url: tenant?.catalog_settings?.sheets_url ?? null,
      origin_subdistrict: tenant?.catalog_settings?.origin_subdistrict ?? null,
      last_synced_at: tenant?.catalog_settings?.last_synced_at?.toISOString() ?? null,
      bank_name: tenant?.catalog_settings?.bank_name ?? "",
      bank_account_number: tenant?.catalog_settings?.bank_account_number ?? "",
      bank_account_holder: tenant?.catalog_settings?.bank_account_holder ?? "",
      qris_key: tenant?.catalog_settings?.qris_object_key
        ? {
            key: tenant.catalog_settings.qris_object_key,
            url: publicUrlFor(tenant.catalog_settings.qris_object_key),
          }
        : null,
      bot_name: tenant?.catalog_settings?.bot_name ?? "Admin CS",
      bot_tone: tenant?.catalog_settings?.bot_tone ?? "RAMAH",
      custom_persona_prompt: tenant?.catalog_settings?.custom_persona_prompt ?? "",
      greeting_message: tenant?.catalog_settings?.greeting_message ?? "",
    },
    persona: {
      bot_name: tenant?.catalog_settings?.bot_name ?? "Admin CS",
      bot_tone: tenant?.catalog_settings?.bot_tone ?? "RAMAH",
      custom_persona_prompt: tenant?.catalog_settings?.custom_persona_prompt ?? "",
      greeting_message: tenant?.catalog_settings?.greeting_message ?? "",
    },
    promos: {
      promo_rules: (tenant?.catalog_settings?.promo_rules as unknown as unknown[]) ?? [],
      voucher_rules: (tenant?.catalog_settings?.voucher_rules as unknown as unknown[]) ?? [],
    },
    shipping: {
      cut_off_hour: tenant?.catalog_settings?.shipping_cut_off_hour ?? 15,
      open_hour: tenant?.catalog_settings?.shipping_open_hour ?? 8,
      close_hour: tenant?.catalog_settings?.shipping_close_hour ?? 21,
    },
    storage: {
      used_bytes: storageUsed,
      quota_bytes: TENANT_QUOTA_BYTES,
      used_percent: Math.round((storageUsed / TENANT_QUOTA_BYTES) * 1000) / 10,
    },
    ai: {
      gateway_ok: gateway.ok,
      model: env.AI_MODEL,
      latency_ms: gateway.latencyMs,
      error: gateway.error ?? null,
    },
    telegram: { ok: telegram.ok, username: telegram.username ?? null },
    queue,
    scheduler: {
      interval_minutes: scheduler.interval_minutes,
      worker_started: scheduler.worker_started,
    },
    pending_proofs: pendingProofs,
  });
}
