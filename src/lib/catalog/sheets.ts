import type { ProductRow } from "@/lib/ai/types";
import prisma from "@/lib/prisma";

/**
 * Google Sheets catalog reader (specification chapter 2, USP 1: zero learning curve).
 *
 * The store owner keeps their own spreadsheet. We read the published CSV export so no
 * OAuth service account is required on the tenant side. The sheet must expose the
 * canonical header row documented in chapter 8.B:
 *
 *   SKU | Nama Produk | Varian / Warna | Harga | Stok | Link Foto | Link Video
 *
 * Everything is case/space tolerant. Indonesian number formats are normalised
 * ("Rp 185.000", "185000", "185.000,50").
 */

export type SheetFetchResult = {
  ok: true;
  rows: ProductRow[];
  headers: string[];
  fetchedAt: string;
} | {
  ok: false;
  error: string;
  headers: string[];
};

const HEADER_ALIASES: Record<keyof ProductRow, string[]> = {
  sku: ["sku", "kode", "kode produk", "kode barang"],
  name: ["nama produk", "nama", "produk", "product name"],
  variant: ["varian", "varian / warna", "varian/warna", "warna", "variant"],
  price: ["harga", "price", "harga jual"],
  stock: ["stok", "stock", "qty", "kuantitas", "jumlah"],
  photo_url: ["link foto", "foto", "link foto (minio)", "image", "photo", "url foto"],
  video_url: ["link video", "video", "link video (minio)", "url video"],
  description: ["deskripsi", "bahan", "detail", "keterangan", "description", "spesifikasi", "size chart"],
  category: ["kategori", "category", "jenis"],
  weight_grams: ["berat", "berat (gram)", "berat gram", "weight", "weight (gram)", "gram"],
  is_active: ["aktif", "status", "active", "is_active", "tersedia"],
};

function normaliseHeader(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isSafePublicUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname === "[::1]"
    ) {
      return false;
    }
    const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (match) {
      const o1 = Number(match[1]);
      const o2 = Number(match[2]);
      if (o1 === 127) return false;
      if (o1 === 10) return false;
      if (o1 === 172 && o2 >= 16 && o2 <= 31) return false;
      if (o1 === 192 && o2 === 168) return false;
      if (o1 === 169 && o2 === 254) return false;
      if (o1 === 0) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Converts a published Sheets URL into its CSV export endpoint. */
export function toCsvExportUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (!isSafePublicUrl(trimmed)) return null;

  // Already a CSV export or a raw CSV link.
  if (trimmed.includes("output=csv") || trimmed.endsWith(".csv")) return trimmed;

  const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;

  const gidMatch = trimmed.match(/[#&?]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "0";

  return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`;
}

/** Parses a full CSV document, honouring quoted fields with embedded newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\r") {
      // swallow, \r\n handled by the \n branch
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export function parseRupiah(raw: string): number {
  const cleaned = raw.replace(/[^0-9.,-]/g, "").trim();
  if (!cleaned) return 0;

  const hasDot = cleaned.includes(".");
  const hasComma = cleaned.includes(",");

  // Indonesian format: 185.000 (thousand dot) or 185.000,50 (comma decimal)
  if (hasDot && hasComma) {
    return parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
  }
  if (hasDot) {
    const parts = cleaned.split(".");
    // a single dot followed by exactly 3 digits is a thousands separator
    if (parts.length === 2 && parts[1].length === 3) {
      return parseFloat(parts.join("")) || 0;
    }
    return parseFloat(cleaned) || 0;
  }
  if (hasComma) {
    return parseFloat(cleaned.replace(",", ".")) || 0;
  }
  return parseFloat(cleaned) || 0;
}

export function parseStock(raw: string): number {
  const n = parseInt(raw.replace(/[^0-9-]/g, ""), 10);
  return Number.isNaN(n) ? 0 : n;
}

export function parseWeight(raw: string): number | null {
  if (!raw) return null;
  const num = parseFloat(raw.replace(/[^0-9.,]/g, "").replace(",", "."));
  return Number.isNaN(num) ? null : num;
}

export function parseActive(raw: string): boolean {
  if (!raw) return true; // default: aktif jika kolom tidak ada
  const v = raw.trim().toLowerCase();
  return !["tidak", "no", "false", "0", "nonaktif", "inactive"].includes(v);
}

/** Resolves canonical field indexes from an arbitrary header row. */
export function resolveColumns(headers: string[]): Partial<Record<keyof ProductRow, number>> {
  const normalised = headers.map(normaliseHeader);
  const map: Partial<Record<keyof ProductRow, number>> = {};

  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
    keyof ProductRow,
    string[],
  ][]) {
    const idx = normalised.findIndex((h) => aliases.includes(h));
    if (idx >= 0) map[field] = idx;
  }

  return map;
}

export type SheetStructureCheck = {
  valid: boolean;
  headers: string[];
  resolved: Partial<Record<keyof ProductRow, number>>;
  missing: string[];
};

export function verifyStructure(headers: string[]): SheetStructureCheck {
  const resolved = resolveColumns(headers);
  const required: (keyof ProductRow)[] = ["sku", "name", "price", "stock"];
  const missing = required.filter((r) => resolved[r] === undefined);

  return {
    valid: missing.length === 0,
    headers,
    resolved,
    missing: missing as string[],
  };
}

export function rowsFromCsv(text: string): { rows: ProductRow[]; headers: string[] } {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], headers: [] };

  const headers = table[0];
  const cols = resolveColumns(headers);
  const rows: ProductRow[] = [];

  for (let i = 1; i < table.length; i += 1) {
    const r = table[i];
    const get = (f: keyof ProductRow): string =>
      cols[f] !== undefined ? (r[cols[f]!] ?? "").trim() : "";

    const sku = get("sku");
    if (!sku) continue;

    rows.push({
      sku,
      name: get("name"),
      variant: get("variant"),
      price: parseRupiah(get("price")),
      stock: parseStock(get("stock")),
      photo_url: get("photo_url") || null,
      video_url: get("video_url") || null,
      description: get("description") || null,
      category: get("category") || null,
      weight_grams: parseWeight(get("weight_grams")),
      is_active: parseActive(get("is_active")),
    });
  }

  return { rows, headers };
}

/** Fetches and parses a tenant spreadsheet. Never throws. */
export async function fetchCatalog(
  sheetsUrl: string,
  timeoutMs = 8000
): Promise<SheetFetchResult> {
  const csvUrl = toCsvExportUrl(sheetsUrl);
  if (!csvUrl) {
    return { ok: false, error: "Sheet URL is not a valid Google Sheets link", headers: [] };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(csvUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "NoewbarCSPro/1.0 (catalog sync)" },
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        ok: false,
        error: `Sheet returned HTTP ${res.status}. Make sure the sheet is published to the web (File > Share > Publish to web).`,
        headers: [],
      };
    }

    const text = await res.text();
    if (text.trimStart().startsWith("<!DOCTYPE") || text.includes("<html")) {
      return {
        ok: false,
        error:
          "Sheet is not publicly readable. Publish it via File > Share > Publish to web > CSV.",
        headers: [],
      };
    }

    const { rows, headers } = rowsFromCsv(text);
    return { ok: true, rows, headers, fetchedAt: new Date().toISOString() };
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "Sheet request timed out"
        : `Sheet fetch failed: ${err instanceof Error ? err.message : "unknown error"}`;
    return { ok: false, error: message, headers: [] };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Local PostgreSQL cache fallback (chapter 12: Sheets down -> serve last cache,
// customer impact zero).
// ---------------------------------------------------------------------------

type CacheEntry = { rows: ProductRow[]; headers: string[]; at: number };
const catalogCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export function getCachedCatalog(tenantId: string): CacheEntry | undefined {
  const hit = catalogCache.get(tenantId);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    catalogCache.delete(tenantId);
    return undefined;
  }
  return hit;
}

export function setCachedCatalog(tenantId: string, rows: ProductRow[], headers: string[]): void {
  catalogCache.set(tenantId, { rows, headers, at: Date.now() });
}

export function clearCatalogCache(tenantId?: string): void {
  if (tenantId) catalogCache.delete(tenantId);
  else catalogCache.clear();
}

/**
 * Reads a tenant's catalog with graceful degradation:
 *   database products + fresh sheet -> cache -> (caller decides) hard failure.
 */
export async function readCatalog(
  tenantId: string,
  sheetsUrl: string
): Promise<{ rows: ProductRow[]; headers: string[]; source: "sheet" | "cache"; warning?: string }> {
  let dbRows: ProductRow[] = [];
  try {
    const dbProducts = await prisma.product.findMany({
      where: { tenant_id: tenantId, status: "ACTIVE" },
      orderBy: { created_at: "desc" },
    });
    if (dbProducts.length > 0) {
      dbRows = dbProducts.map((p) => {
        let variantStr = "";
        if (Array.isArray(p.variants) && p.variants.length > 0) {
          const first = p.variants[0];
          variantStr = typeof first === "string" ? first : (first as { name?: string }).name || "";
        }
        let photoUrl: string | null = null;
        if (Array.isArray(p.images) && p.images.length > 0) {
          photoUrl = String(p.images[0]);
        }
        const attrs = (p.attributes && typeof p.attributes === "object") ? p.attributes as Record<string, unknown> : {};
        const weight = typeof attrs.weight_grams === "number" ? attrs.weight_grams : 500;

        return {
          sku: p.sku,
          name: p.name,
          variant: variantStr,
          price: Number(p.discount_price ?? p.price),
          stock: p.stock,
          photo_url: photoUrl,
          video_url: null,
          description: p.description || null,
          category: p.category || null,
          weight_grams: weight,
          is_active: p.status === "ACTIVE",
        };
      });
    }
  } catch {
    // database fallback
  }

  const fresh = await fetchCatalog(sheetsUrl);

  if (fresh.ok) {
    const existingSkus = new Set(dbRows.map((r) => r.sku.toLowerCase()));
    const merged = [...dbRows, ...fresh.rows.filter((r) => !existingSkus.has(r.sku.toLowerCase()))];
    setCachedCatalog(tenantId, merged, fresh.headers);
    return { rows: merged, headers: fresh.headers, source: "sheet" };
  }

  if (dbRows.length > 0) {
    return { rows: dbRows, headers: ["sku", "name", "price", "stock"], source: "cache", warning: fresh.error };
  }

  const cached = getCachedCatalog(tenantId);
  if (cached) {
    return {
      rows: cached.rows,
      headers: cached.headers,
      source: "cache",
      warning: fresh.error,
    };
  }

  return { rows: [], headers: [], source: "cache", warning: fresh.error };
}
