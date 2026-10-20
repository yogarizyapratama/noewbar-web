import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/http";
import { requireTenant } from "@/lib/auth";
import { syncTenantSubscription } from "@/lib/billing/midtrans";
import { notifyTenant, notifyAdmin } from "@/lib/realtime/event-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const syncSchema = z.object({
  order_id: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await requireTenant();
  if (!session) return fail("Unauthorized", 401);

  let targetOrderId: string | undefined;
  try {
    const body = await req.json();
    const parsed = syncSchema.safeParse(body);
    if (parsed.success) {
      targetOrderId = parsed.data.order_id;
    }
  } catch {
    // Body is optional
  }

  try {
    const result = await syncTenantSubscription(session.sub, targetOrderId);
    if (result.activated) {
      notifyTenant(session.sub, { type: "billing" });
      notifyAdmin({ type: "billing" });
    }
    return ok(result);
  } catch (err) {
    return fail(
      `Gagal memeriksa status pembayaran: ${err instanceof Error ? err.message : "unknown error"}`,
      500
    );
  }
}

export async function GET(req: NextRequest) {
  const session = await requireTenant();
  if (!session) return fail("Unauthorized", 401);

  const orderId = req.nextUrl.searchParams.get("order_id") ?? undefined;

  try {
    const result = await syncTenantSubscription(session.sub, orderId);
    if (result.activated) {
      notifyTenant(session.sub, { type: "billing" });
      notifyAdmin({ type: "billing" });
    }
    return ok(result);
  } catch (err) {
    return fail(
      `Gagal memeriksa status pembayaran: ${err instanceof Error ? err.message : "unknown error"}`,
      500
    );
  }
}
