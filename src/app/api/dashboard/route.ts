import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { ok, fail } from "@/lib/http";
import { requireTenant } from "@/lib/auth";
import { fetchCatalog, verifyStructure, toCsvExportUrl } from "@/lib/catalog/sheets";
import { uploadObject, validateUpload, tenantProductKey, tenantQrisKey, publicUrlFor, objectExists, tenantUsageBytes, TENANT_QUOTA_BYTES, type MediaKind } from "@/lib/storage/minio";

/**
 * Catalog + media management for the logged-in store (chapter 10.B).
 *
 * "Setup Spreadsheet & Media": verify the sheet structure, then upload product files
 * to the tenant's own MinIO namespace.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set_sheet"),
    sheets_url: z.string().min(5),
    origin_subdistrict: z.string().min(2).optional(),
    nudge_delay_minutes: z.number().int().min(15).max(1440).optional(),
  }),
  z.object({
    action: z.literal("verify_sheet"),
    sheets_url: z.string().min(5),
  }),
  z.object({
    action: z.literal("catalog"),
  }),
  z.object({
    action: z.literal("usage"),
  }),
  z.object({
    action: z.literal("media_exists"),
    key: z.string().min(3),
  }),
  z.object({
    action: z.literal("save_payment"),
    bank_name: z.string().trim().max(80).optional(),
    bank_account_number: z.string().trim().max(40).optional(),
    bank_account_holder: z.string().trim().max(80).optional(),
    // Empty string clears the saved QRIS key.
    qris_object_key: z.string().trim().max(300).optional(),
  }),
  z.object({
    action: z.literal("save_persona"),
    bot_name: z.string().trim().max(60).optional(),
    bot_tone: z.string().trim().max(30).optional(),
    custom_persona_prompt: z.string().trim().max(3000).optional(),
    greeting_message: z.string().trim().max(1000).optional(),
  }),
]);

/**
 * Media + catalog summary for the dashboard shell.
 * Guarded exactly like POST/PUT so an unauthenticated caller gets a clean 401
 * instead of a 405 (which would leak that the route exists but is misused).
 */
export async function GET() {
  const session = await requireTenant();
  if (!session) return fail("Unauthorized", 401);

  const [settings, used, mediaUploads, pendingProofs] = await Promise.all([
    prisma.catalogSetting.findUnique({ where: { tenant_id: session.sub } }),
    tenantUsageBytes(session.sub),
    prisma.webhookEvent.count({
      where: { event_key: { startsWith: `media:${session.sub}:` }, event_type: "media_upload" },
    }),
    prisma.order.count({
      where: { tenant_id: session.sub, payment_status: { in: ["PROOF_SUBMITTED", "UNDER_REVIEW"] } },
    }),
  ]);

  return ok({
    catalog: {
      configured: Boolean(settings?.sheets_url),
      sheets_url: settings?.sheets_url ?? null,
      origin_subdistrict: settings?.origin_subdistrict ?? null,
      nudge_delay_minutes: settings?.nudge_delay_minutes ?? 120,
      auto_reply_enabled: settings?.auto_reply_enabled ?? true,
      last_synced_at: settings?.last_synced_at?.toISOString() ?? null,
      // USA CH18: a store sets its own payment destination in the dashboard.
      bank_name: settings?.bank_name ?? "",
      bank_account_number: settings?.bank_account_number ?? "",
      bank_account_holder: settings?.bank_account_holder ?? "",
      qris_key: settings?.qris_object_key
        ? { key: settings.qris_object_key, url: publicUrlFor(settings.qris_object_key) }
        : null,
      bot_name: settings?.bot_name ?? "Admin CS",
      bot_tone: settings?.bot_tone ?? "RAMAH",
      custom_persona_prompt: settings?.custom_persona_prompt ?? "",
      greeting_message: settings?.greeting_message ?? "",
    },
    persona: {
      bot_name: settings?.bot_name ?? "Admin CS",
      bot_tone: settings?.bot_tone ?? "RAMAH",
      custom_persona_prompt: settings?.custom_persona_prompt ?? "",
      greeting_message: settings?.greeting_message ?? "",
    },
    storage: {
      used_bytes: used,
      quota_bytes: TENANT_QUOTA_BYTES,
      used_percent: Math.round((used / TENANT_QUOTA_BYTES) * 1000) / 10,
    },
    media_uploads: mediaUploads,
    pending_proofs: pendingProofs,
  });
}

export async function POST(req: NextRequest) {
  const session = await requireTenant();
  if (!session) return fail("Unauthorized", 401);

  const raw = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(raw);
  if (!parsed.success) return fail("Aksi tidak valid", 422, parsed.error.issues);
  const body = parsed.data;

  if (body.action === "verify_sheet") {
    const csvUrl = toCsvExportUrl(body.sheets_url);
    if (!csvUrl) return fail("Link Google Sheets tidak valid", 422);

    const fetched = await fetchCatalog(body.sheets_url);
    if (!fetched.ok) return ok({ valid: false, error: fetched.error, structure: null, sample: [] });

    const structure = verifyStructure(fetched.headers);

    return ok({
      valid: structure.valid,
      structure,
      headers: fetched.headers,
      total_rows: fetched.rows.length,
      sample: fetched.rows.slice(0, 5),
      error: structure.valid
        ? null
        : `Kolom wajib belum lengkap: ${structure.missing.join(", ")}. Diperlukan minimal: SKU, Nama Produk, Harga, Stok.`,
    });
  }

  if (body.action === "set_sheet") {
    const csvUrl = toCsvExportUrl(body.sheets_url);
    if (!csvUrl) return fail("Link Google Sheets tidak valid", 422);

    const fetched = await fetchCatalog(body.sheets_url);
    if (!fetched.ok) return fail(fetched.error, 422);

    const structure = verifyStructure(fetched.headers);
    if (!structure.valid) {
      return fail(
        `Struktur sheet belum sesuai. Kolom hilang: ${structure.missing.join(", ")}`,
        422,
        { headers: fetched.headers }
      );
    }

    const settings = await prisma.catalogSetting.upsert({
      where: { tenant_id: session.sub },
      create: {
        tenant_id: session.sub,
        sheets_url: body.sheets_url,
        origin_subdistrict: body.origin_subdistrict ?? "Jakarta Selatan",
        nudge_delay_minutes: body.nudge_delay_minutes ?? 120,
        last_synced_at: new Date(),
      },
      update: {
        sheets_url: body.sheets_url,
        ...(body.origin_subdistrict ? { origin_subdistrict: body.origin_subdistrict } : {}),
        ...(body.nudge_delay_minutes ? { nudge_delay_minutes: body.nudge_delay_minutes } : {}),
        last_synced_at: new Date(),
      },
    });

    return ok({
      action: "set_sheet",
      sheets_url: settings.sheets_url,
      origin_subdistrict: settings.origin_subdistrict,
      nudge_delay_minutes: settings.nudge_delay_minutes,
      total_rows: fetched.rows.length,
    });
  }

  if (body.action === "catalog") {
    const settings = await prisma.catalogSetting.findUnique({ where: { tenant_id: session.sub } });
    if (!settings?.sheets_url) {
      return ok({ configured: false, rows: [], headers: [], source: null, warning: "Spreadsheet belum diatur" });
    }

    const fetched = await fetchCatalog(settings.sheets_url);
    if (!fetched.ok) {
      return ok({ configured: true, rows: [], headers: [], source: null, warning: fetched.error });
    }

    await prisma.catalogSetting.update({
      where: { tenant_id: session.sub },
      data: { last_synced_at: new Date() },
    });

    return ok({
      configured: true,
      rows: fetched.rows,
      headers: fetched.headers,
      source: "sheet",
      total: fetched.rows.length,
      warning: null,
    });
  }

  if (body.action === "usage") {
    const used = await tenantUsageBytes(session.sub);
    return ok({
      action: "usage",
      used_bytes: used,
      quota_bytes: TENANT_QUOTA_BYTES,
      used_percent: Math.round((used / TENANT_QUOTA_BYTES) * 1000) / 10,
    });
  }

  if (body.action === "save_payment") {
    const data: Prisma.CatalogSettingUpdateInput = {};
    if (body.bank_name !== undefined) data.bank_name = body.bank_name;
    if (body.bank_account_number !== undefined) data.bank_account_number = body.bank_account_number;
    if (body.bank_account_holder !== undefined) data.bank_account_holder = body.bank_account_holder;
    if (body.qris_object_key !== undefined) {
      // A real key must exist in MinIO before we persist it.
      if (body.qris_object_key) {
        const exists = await objectExists(body.qris_object_key);
        if (!exists) return fail("Berkas QRIS belum ada di penyimpanan", 422);
      }
      data.qris_object_key = body.qris_object_key;
    }

    const updated = await prisma.catalogSetting.upsert({
      where: { tenant_id: session.sub },
      create: {
        tenant_id: session.sub,
        sheets_url: "",
        origin_subdistrict: "Jakarta Selatan",
        ...(body.bank_name !== undefined && { bank_name: body.bank_name }),
        ...(body.bank_account_number !== undefined && { bank_account_number: body.bank_account_number }),
        ...(body.bank_account_holder !== undefined && { bank_account_holder: body.bank_account_holder }),
        ...(body.qris_object_key !== undefined && { qris_object_key: body.qris_object_key }),
      },
      update: data,
    });

    return ok({
      action: "save_payment",
      bank_name: updated.bank_name,
      bank_account_number: updated.bank_account_number,
      bank_account_holder: updated.bank_account_holder,
      qris_key: updated.qris_object_key
        ? { key: updated.qris_object_key, url: publicUrlFor(updated.qris_object_key) }
        : null,
    });
  }

  if (body.action === "save_persona") {
    const data: Prisma.CatalogSettingUpdateInput = {};
    if (body.bot_name !== undefined) data.bot_name = body.bot_name;
    if (body.bot_tone !== undefined) data.bot_tone = body.bot_tone;
    if (body.custom_persona_prompt !== undefined) data.custom_persona_prompt = body.custom_persona_prompt;
    if (body.greeting_message !== undefined) data.greeting_message = body.greeting_message;

    const updated = await prisma.catalogSetting.upsert({
      where: { tenant_id: session.sub },
      create: {
        tenant_id: session.sub,
        sheets_url: "",
        origin_subdistrict: "Jakarta Selatan",
        bot_name: body.bot_name ?? "Admin CS",
        bot_tone: body.bot_tone ?? "RAMAH",
        custom_persona_prompt: body.custom_persona_prompt ?? "",
        greeting_message: body.greeting_message ?? "",
      },
      update: data,
    });

    return ok({
      action: "save_persona",
      persona: {
        bot_name: updated.bot_name,
        bot_tone: updated.bot_tone,
        custom_persona_prompt: updated.custom_persona_prompt,
        greeting_message: updated.greeting_message,
      },
    });
  }

  // media_exists
  const exists = await objectExists(body.key);
  return ok({ action: "media_exists", key: body.key, exists, url: publicUrlFor(body.key) });
}

/**
 * Media upload (multipart/form-data). Enforces the max-size matrix and the 1 GB
 * per-store quota before writing anything to MinIO.
 */
export async function PUT(req: NextRequest) {
  const session = await requireTenant();
  if (!session) return fail("Unauthorized", 401);

  const form = await req.formData().catch(() => null);
  if (!form) return fail("Expected multipart/form-data", 400);

  const file = form.get("file");
  const kindRaw = String(form.get("kind") ?? "photo");
  const sku = String(form.get("sku") ?? "").trim();
  const isQris = String(form.get("purpose") ?? "") === "qris";

  if (!(file instanceof File)) return fail("Field 'file' is required", 400);

  const kind = (["photo", "video", "pdf"] as MediaKind[]).includes(kindRaw as MediaKind)
    ? (kindRaw as MediaKind)
    : "photo";

  if (!isQris && !sku) return fail("Field 'sku' is required for product media", 400);

  const check = validateUpload(kind, file.size, file.name, file.type);
  if (!check.ok) return fail(check.error, 413);

  // Quota guard.
  const used = await tenantUsageBytes(session.sub);
  if (used + file.size > TENANT_QUOTA_BYTES) {
    return fail(
      `Kuota penyimpanan toko (1 GB) hampir penuh: terpakai ${(used / 1024 / 1024).toFixed(1)} MB. Hapus berkas lama sebelum mengunggah.`,
      413
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const key = isQris ? tenantQrisKey(session.sub) : tenantProductKey(session.sub, sku, check.ext);

  const uploaded = await uploadObject(key, buffer, file.type || "application/octet-stream");

  await prisma.webhookEvent.create({
    data: {
      provider: "WHATSMEOW",
      event_key: `media:${session.sub}:${key}:${Date.now()}`,
      event_type: "media_upload",
      payload: {
        key,
        size: uploaded.size,
        content_type: file.type,
        purpose: isQris ? "qris" : "product",
      } as Prisma.InputJsonValue,
    },
  });

  return ok({
    uploaded: true,
    key: uploaded.key,
    url: uploaded.url,
    size: uploaded.size,
    kind,
    purpose: isQris ? "qris" : "product",
  });
}
