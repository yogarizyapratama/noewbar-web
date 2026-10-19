import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireTenant } from "@/lib/auth";
import { waDaemon } from "@/lib/wa/daemon-client";

/**
 * WhatsApp Gateway Latency & Health Probe API.
 * Measures round-trip ping latency to the local or remote Go Whatsmeow daemon.
 */
export async function GET() {
  const session = await requireTenant();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.sub;

  const instance = await prisma.waInstance.findFirst({
    where: { tenant_id: tenantId },
    orderBy: { created_at: "desc" },
  });

  const start = performance.now();
  let daemonRes;

  if (instance?.instance_key) {
    daemonRes = await waDaemon.getStatus(instance.instance_key);
  } else {
    daemonRes = await waDaemon.health();
  }

  const latencyMs = Math.round(performance.now() - start);

  if (!daemonRes.ok) {
    return NextResponse.json({
      ok: false,
      latency_ms: latencyMs,
      status: "UNREACHABLE",
      error: daemonRes.error,
    });
  }

  const connectionStatus =
    "connection_status" in daemonRes.data
      ? daemonRes.data.connection_status
      : "status" in daemonRes.data
      ? daemonRes.data.status
      : "ONLINE";

  const phone =
    "phone_number" in daemonRes.data ? daemonRes.data.phone_number : null;

  return NextResponse.json({
    ok: true,
    latency_ms: latencyMs,
    status: connectionStatus,
    phone,
    timestamp: new Date().toISOString(),
  });
}
