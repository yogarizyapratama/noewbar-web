import { NextRequest } from "next/server";
import { requireTenant, requireAdmin } from "@/lib/auth";
import { eventBus, tenantChannel, adminChannel } from "@/lib/realtime/event-bus";

/**
 * Server-Sent Events endpoint for the dashboards.
 *
 *   GET /api/realtime?scope=tenant   -> tenant-scoped events (store owner)
 *   GET /api/realtime?scope=admin    -> superadmin console events
 *
 * Authentication is re-checked on connect (session cookie). The stream stays
 * open until the client disconnects; the browser's EventSource reconnects
 * automatically, at which point the session is re-validated.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope") ?? "tenant";

  let channel: string;
  if (scope === "admin") {
    const admin = await requireAdmin();
    if (!admin) return new Response("Unauthorized", { status: 401 });
    channel = adminChannel;
  } else {
    const tenant = await requireTenant();
    if (!tenant) return new Response("Unauthorized", { status: 401 });
    channel = tenantChannel(tenant.sub);
  }

  // SSE framing.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("retry: 5000\n\n"));

      const unsubscribe = eventBus.subscribe(channel, (event) => {
        try {
          // Send as a DEFAULT message event (no `event:` line): the browser
          // client listens via `EventSource.onmessage`, which only receives
          // unnamed events. The type travels inside the JSON payload.
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Client gone; the unsubscribe below will clean up.
        }
      });

      // Heartbeat every 25s keeps proxies from killing the connection.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      }, 25_000);

      // Cleanup when the client disconnects.
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      // ReadableStream cancel path: nothing extra needed, listeners are tied to
      // the abort signal above.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}