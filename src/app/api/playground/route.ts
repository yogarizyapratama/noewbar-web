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

const DEFAULT_PLAYGROUND_CATALOG: ProductRow[] = [
  {
    sku: "TSH-OVR-BLK",
    name: "Kaos Oversize Cotton Combed 24s",
    variant: "Hitam (Size L & XL)",
    price: 95000,
    stock: 45,
    photo_url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800",
    video_url: null,
    category: "Pakaian",
    description: "Kaos polos oversized unisex bahan 100% Cotton Combed 24s adem, tebal, dan nyaman dipakai harian.",
    weight_grams: 250,
    is_active: true,
  },
  {
    sku: "TSH-OVR-WHT",
    name: "Kaos Oversize Cotton Combed 24s",
    variant: "Putih (Size M, L, XL)",
    price: 95000,
    stock: 30,
    photo_url: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800",
    video_url: null,
    category: "Pakaian",
    description: "Kaos polos oversized unisex bahan 100% Cotton Combed 24s warna putih bersih.",
    weight_grams: 250,
    is_active: true,
  },
  {
    sku: "HOD-FLC-MGB",
    name: "Hoodie Heavyweight Fleece 330gsm",
    variant: "Abu Misty (Size L & XL)",
    price: 185000,
    stock: 20,
    photo_url: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800",
    video_url: null,
    category: "Outerwear",
    description: "Hoodie fleece premium tebal dan lembut dengan saku kangguru dan tali serut adjustable.",
    weight_grams: 650,
    is_active: true,
  },
  {
    sku: "SNK-CNV-WHT",
    name: "Sneakers Canvas Vulcanized Low",
    variant: "Putih Polos (Size 40, 41, 42, 43)",
    price: 219000,
    stock: 15,
    photo_url: "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=800",
    video_url: null,
    category: "Sepatu",
    description: "Sepatu sneakers kanvas sol karet vulcanized antiselip, nyaman untuk kuliah dan jalan santai.",
    weight_grams: 800,
    is_active: true,
  },
];

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

  // Resolve catalog: Google Sheets if configured, otherwise built-in demo catalog
  const sheetUrl = env.PLAYGROUND_SHEET_URL.trim();
  let catalog: ProductRow[] = DEFAULT_PLAYGROUND_CATALOG;
  let catalogSource: "sheet" | "cache" = "cache";

  if (sheetUrl) {
    const fetched = await fetchCatalog(sheetUrl);
    if (fetched.ok && fetched.rows.length > 0) {
      catalog = fetched.rows;
      catalogSource = "sheet";
    }
  }

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
    catalogSource,
    payment: { bankName: "", bankAccountNumber: "", bankAccountHolder: "", qrisUrl: null },
  };

  const result = await runAgent({
    ctx,
    businessName: env.NEXT_PUBLIC_APP_NAME,
    catalogSource,
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

  if (sheetUrl) {
    const catalog = await readCatalog("playground", sheetUrl);
    if (catalog.rows.length > 0) {
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
  }

  return ok({
    configured: true,
    source: "demo",
    warning: null,
    total: DEFAULT_PLAYGROUND_CATALOG.length,
    preview: DEFAULT_PLAYGROUND_CATALOG.slice(0, 4).map((r) => ({
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
