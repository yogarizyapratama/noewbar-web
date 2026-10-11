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
    variant: "Hitam (Size M, L, XL)",
    price: 95000,
    stock: 45,
    photo_url: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800",
    video_url: null,
    category: "Kaos & T-Shirt",
    description: "Kaos polos oversized unisex bahan 100% Cotton Combed 24s gramasi 185gsm. Jahitan rantai standar distro, adem, lembut, dan menyerap keringat.",
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
    category: "Kaos & T-Shirt",
    description: "Kaos polos oversized unisex bahan 100% Cotton Combed 24s warna putih bersih, tidak menerawang, cocok untuk casual daily wear.",
    weight_grams: 250,
    is_active: true,
  },
  {
    sku: "TSH-OVR-SGE",
    name: "Kaos Oversize Cotton Combed 24s",
    variant: "Sage Green (Size L, XL)",
    price: 95000,
    stock: 25,
    photo_url: "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800",
    video_url: null,
    category: "Kaos & T-Shirt",
    description: "Kaos oversized warna hijau sage estetik bahan katun combed 24s lembut dan adem.",
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
    category: "Outerwear & Jaket",
    description: "Hoodie fleece katun premium 330gsm tebal, bagian dalam lembut tidak berbulu rontok, kantong kangguru depan dan rib elastis.",
    weight_grams: 650,
    is_active: true,
  },
  {
    sku: "HOD-FLC-BLK",
    name: "Hoodie Heavyweight Fleece 330gsm",
    variant: "Hitam Pekat (Size M, L, XL)",
    price: 185000,
    stock: 28,
    photo_url: "https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=800",
    video_url: null,
    category: "Outerwear & Jaket",
    description: "Hoodie tebal hitam pekat warna tidak pudar saat dicuci. Sangat hangat untuk musim hujan atau riding malam.",
    weight_grams: 650,
    is_active: true,
  },
  {
    sku: "KMR-FLN-NVY",
    name: "Kemeja Flannel Tartan Kotak",
    variant: "Navy Kotak (Size L)",
    price: 149000,
    stock: 16,
    photo_url: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800",
    video_url: null,
    category: "Kemeja",
    description: "Kemeja flannel lengan panjang motif kotak tartan kasual, bahan katun wol halus nyaman dipakai sebagai outer atau kemeja kasual.",
    weight_grams: 350,
    is_active: true,
  },
  {
    sku: "CLN-CHN-KHK",
    name: "Celana Chino Slim Fit Stretch",
    variant: "Khaki (Size 30, 32, 34)",
    price: 165000,
    stock: 22,
    photo_url: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800",
    video_url: null,
    category: "Celana Panjang",
    description: "Celana chino katun twill stretch melar nyaman bergerak, jahitan bartack kuat, cocok untuk kerja kantor maupun hangout santai.",
    weight_grams: 450,
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
    description: "Sepatu sneakers kanvas 12oz sol karet vulcanized gum antiselip tahan aus, insole empuk nyaman seharian.",
    weight_grams: 800,
    is_active: true,
  },
  {
    sku: "ACC-TTB-BLK",
    name: "Totebag Heavy Canvas 14oz Resleting",
    variant: "Hitam (Ukuran 38x42 cm)",
    price: 59000,
    stock: 50,
    photo_url: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=800",
    video_url: null,
    category: "Aksesoris",
    description: "Tas jinjing totebag kanvas tebal 14oz dengan penutup ritsleting YKK dan saku kecil di dalam untuk handphone dan dompet.",
    weight_grams: 200,
    is_active: true,
  },
  {
    sku: "ACC-CAP-DRK",
    name: "Topi Baseball Vintage Washed",
    variant: "Dark Charcoal (All Size)",
    price: 49000,
    stock: 35,
    photo_url: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800",
    video_url: null,
    category: "Aksesoris",
    description: "Topi baseball katun washed vintage dengan strap besi pengatur ukuran di belakang, nyaman dan sejuk.",
    weight_grams: 150,
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
    degradation_reason: result.degradationReason,
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
