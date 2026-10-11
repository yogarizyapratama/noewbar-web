import { NextResponse } from "next/server";
import { getTenantSession } from "@/lib/auth";
import {
  uploadObject,
  validateUpload,
  tenantUsageBytes,
  TENANT_QUOTA_BYTES,
} from "@/lib/storage/minio";

/**
 * Direct Product Image Upload API.
 * Uploads image files directly to MinIO and returns the public CDN URL.
 *
 * Rules:
 * - Zero em-dash (U+2014).
 * - Multi-tenant isolated storage.
 * - Quota & file type validation.
 */
export async function POST(req: Request) {
  const session = await getTenantSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json(
      { ok: false, error: "Expected multipart/form-data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "Berkas gambar (file) wajib disertakan." },
      { status: 400 }
    );
  }

  const check = validateUpload("photo", file.size, file.name, file.type);
  if (!check.ok) {
    return NextResponse.json({ ok: false, error: check.error }, { status: 400 });
  }

  // Quota verification
  const used = await tenantUsageBytes(session.sub);
  if (used + file.size > TENANT_QUOTA_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: "Kapasitas penyimpanan toko penuh (1 GB). Silakan bersihkan berkas lama.",
      },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const cleanName = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "_")
    .replace(/\.[^/.]+$/, "");
  const key = `tenants/${session.sub}/products/${Date.now()}_${cleanName}.${check.ext}`;

  const uploaded = await uploadObject(key, buffer, file.type || "image/jpeg");

  return NextResponse.json({
    ok: true,
    url: uploaded.url,
    key: uploaded.key,
    size: uploaded.size,
  });
}
