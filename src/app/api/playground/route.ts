import { NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { ok, fail, rateLimit } from "@/lib/http";
import { readCatalog, fetchCatalog } from "@/lib/catalog/sheets";
import { runAgent } from "@/lib/ai/orchestrator";
import type { ProductRow, ToolContext } from "@/lib/ai/types";
import { isBotDisabled } from "@/lib/system/killswitch";

/**
 * Public Interactive Playground (chapter 10.A.5).
 *
 * The visitor types a real message and watches the actual `combo-ai` pipeline
 * answer using a real catalog. Nothing is fabricated:
 *
 *   - The catalog comes from PLAYGROUND_SHEET_URL (a real published Google Sheet).
 *   - When that is not configured the endpoint returns an explicit `not_configured`
 *     state and the UI shows an honest empty state. It never invents sample products.
 *   - Nothing is persisted: no conversation, no order, no stock reservation. Orders
 *     produced by the playground are marked `simulated` so the UI can label them.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  message: z.string().min(1).max(600),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(2000),
      })
    )
    .max(6)
    .optional()
    .default([]),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limiter = rateLimit(`playground:${ip}`, 20, 60_000);
  if (!limiter.allowed) {
    return fail("Terlalu banyak percobaan. Coba lagi sebentar lagi.", 429);
  }

  if (isBotDisabled()) {
    return fail("Simulator sedang dinonaktifkan sementara oleh operator.", 503);
  }

  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Pesan tidak valid", 422, parsed.error.issues);
  }

  // Resolve the real catalog source for the playground.
  const sheetUrl = env.PLAYGROUND_SHEET_URL.trim();
  if (!sheetUrl) {
    return ok({
      configured: false,
      note: "Simulator belum dihubungkan ke katalog. Atur PLAYGROUND_SHEET_URL ke Google Sheets toko Anda yang sudah di-publish ke web, lalu simulator akan menjawab memakai data asli.",
      reply: null,
      tool_calls: [],
      media: [],
    });
  }

  const fetched = await fetchCatalog(sheetUrl);
  if (!fetched.ok) {
    return ok({
      configured: true,
      catalog_available: false,
      note: fetched.error,
      reply: null,
      tool_calls: [],
      media: [],
    });
  }

  const catalog: ProductRow[] = fetched.rows;

  // The catalog above is real; the storefront identity is deliberately NOT read
  // from any tenant row. This endpoint is public, so surfacing a paying customer's
  // `business_name` would leak their identity on a marketing page. A fixed neutral
  // label is used instead, and the origin is the documented default.
  const origin = "Jakarta Selatan";

  const ctx: ToolContext = {
    tenantId: "00000000-0000-0000-0000-000000000000",
    conversationId: "00000000-0000-0000-0000-000000000000",
    buyerJid: "playground@s.whatsapp.net",
    buyerName: "Pengunjung",
    instanceKey: null,
    originSubdistrict: origin,
    nudgeDelayMinutes: 120,
    catalog,
    catalogSource: "sheet",
    payment: { bankName: "", bankAccountNumber: "", bankAccountHolder: "", qrisUrl: null },
  };

  const result = await runAgent({
    ctx,
    businessName: env.NEXT_PUBLIC_APP_NAME,
    catalogSource: "sheet",
    history: parsed.data.history,
    incomingText: parsed.data.message,
  });

  return ok({
    configured: true,
    catalog_available: true,
    catalog_size: catalog.length,
    origin,
    reply: result.replyText,
    tool_calls: result.toolOutcomes.map((t) => ({
      tool: t.tool,
      summary: t.summary,
      simulated: t.tool === "tool_atur_nudge",
    })),
    media: result.media.map((m) => ({ kind: m.kind, url: m.url, caption: m.caption })),
    escalated: result.escalated,
    model: result.model,
    latency_ms: result.latencyMs,
    degraded: result.degraded,
  });
}

/** Reads a tiny catalog preview so the landing page can show real product rows. */
export async function GET() {
  const sheetUrl = env.PLAYGROUND_SHEET_URL.trim();

  if (!sheetUrl) {
    return ok({
      configured: false,
      note: "PLAYGROUND_SHEET_URL belum diatur.",
      preview: [],
    });
  }

  const catalog = await readCatalog("playground", sheetUrl);

  return ok({
    configured: true,
    source: catalog.source,
    warning: catalog.warning ?? null,
    total: catalog.rows.length,
    preview: catalog.rows.slice(0, 4).map((r) => ({
      sku: r.sku,
      name: r.name,
      variant: r.variant,
      price: r.price,
      stock: r.stock,
      has_photo: Boolean(r.photo_url),
      has_video: Boolean(r.video_url),
    })),
  });
}
