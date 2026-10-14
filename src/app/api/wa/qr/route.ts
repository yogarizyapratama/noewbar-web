import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { requireTenant } from "@/lib/auth";
import { getTenantSubscriptionInfo } from "@/lib/billing/subscription-guard";
import { waDaemon } from "@/lib/wa/daemon-client";
import { env } from "@/lib/env";
import { generateInstanceKey } from "@/lib/crypto";

/**
 * WhatsApp pairing (QR) for the logged-in store (chapter 10.B).
 *
 * The bot itself lives in the Go daemon; this route only brokers pairing and keeps
 * the `wa_instances` row in sync so the dashboard reflects reality (CONNECTED /
 * PAIRING / OFFLINE) rather than a decorative badge.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const actionSchema = z.object({
  action: z.enum(["start", "poll", "logout"]),
  instance_key: z.string().min(1).optional(),
});

function webhookUrl(): string {
  return `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/wa-webhook`;
}

export async function POST(req: NextRequest) {
  const session = await requireTenant();
  if (!session) return fail("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid action", 422, parsed.error.issues);

  const { action } = parsed.data;

  if (action === "start") {
    const subInfo = await getTenantSubscriptionInfo(session.sub);
    if (subInfo.isExpired) {
      return fail("Langganan toko Anda telah berakhir. Perbarui paket untuk menghubungkan WhatsApp.", 403);
    }
  }

  // Always operate on an instance owned by the session's tenant.
  let instance = parsed.data.instance_key
    ? await prisma.waInstance.findFirst({
        where: { tenant_id: session.sub, instance_key: parsed.data.instance_key },
      })
    : await prisma.waInstance.findFirst({
        where: { tenant_id: session.sub },
        orderBy: { created_at: "asc" },
      });

  if (!instance && action === "start") {
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.sub },
      select: { business_name: true },
    });
    instance = await prisma.waInstance.create({
      data: {
        tenant_id: session.sub,
        instance_key: generateInstanceKey(tenant?.business_name ?? "noewbar-store"),
        connection_status: "OFFLINE",
      },
    });
  }

  if (!instance) return fail("No WhatsApp instance for this store", 404);

  if (action === "logout") {
    const res = await waDaemon.logout(instance.instance_key);
    await prisma.waInstance.update({
      where: { id: instance.id },
      data: { connection_status: "OFFLINE", phone_number: null, last_seen: null },
    });
    return ok({
      action: "logout",
      daemon_ok: res.ok,
      daemon_error: res.ok ? null : res.error,
      connection_status: "OFFLINE",
    });
  }

  if (action === "start") {
    const init = await waDaemon.initInstance(instance.instance_key, webhookUrl());

    if (!init.ok) {
      await prisma.waInstance.update({
        where: { id: instance.id },
        data: { connection_status: "OFFLINE" },
      });
      return ok({
        action: "start",
        daemon_reachable: false,
        error: init.error,
        instance_key: instance.instance_key,
        connection_status: "OFFLINE",
      });
    }

    const status = init.data.status;
    await prisma.waInstance.update({
      where: { id: instance.id },
      data: {
        connection_status: status,
        phone_number: init.data.phone_number || null,
        last_seen: new Date(),
      },
    });

    return ok({
      action: "start",
      daemon_reachable: true,
      instance_key: instance.instance_key,
      connection_status: status,
      qr_base64: init.data.qr_base64,
      phone_number: init.data.phone_number || null,
    });
  }

  // poll
  const [qr, statusRes] = await Promise.all([
    waDaemon.getQr(instance.instance_key),
    waDaemon.getStatus(instance.instance_key),
  ]);

  if (!qr.ok && !statusRes.ok) {
    await prisma.waInstance.update({
      where: { id: instance.id },
      data: { connection_status: "OFFLINE" },
    });
    return ok({
      action: "poll",
      daemon_reachable: false,
      error: qr.error,
      instance_key: instance.instance_key,
      connection_status: "OFFLINE",
    });
  }

  const connectionStatus = statusRes.ok
    ? statusRes.data.connection_status
    : (qr.ok ? qr.data.status : "OFFLINE");
  const phone = statusRes.ok
    ? statusRes.data.phone_number
    : (qr.ok ? qr.data.phone_number : "");

  await prisma.waInstance.update({
    where: { id: instance.id },
    data: {
      connection_status: connectionStatus,
      phone_number: phone || null,
      last_seen: new Date(),
    },
  });

  // A newly connected number releases any stale freeze.
  return ok({
    action: "poll",
    daemon_reachable: true,
    instance_key: instance.instance_key,
    connection_status: connectionStatus,
    qr_base64: qr.ok ? qr.data.qr_base64 : "",
    phone_number: phone || null,
  });
}

/** Instance snapshot for first paint of the dashboard. */
export async function GET() {
  const session = await requireTenant();
  if (!session) return fail("Unauthorized", 401);

  const instance = await prisma.waInstance.findFirst({
    where: { tenant_id: session.sub },
    orderBy: { created_at: "asc" },
  });

  const health = await waDaemon.health();

  return ok({
    daemon_reachable: health.ok,
    daemon_error: health.ok ? null : health.error,
    daemon_url: waDaemon.baseUrl,
    webhook_url: webhookUrl(),
    instance: instance
      ? {
          instance_key: instance.instance_key,
          connection_status: instance.connection_status,
          phone_number: instance.phone_number,
          last_seen: instance.last_seen?.toISOString() ?? null,
        }
      : null,
  });
}
