import { NextResponse } from "next/server";
import { getTenantSession } from "@/lib/auth";
import {
  uploadObject,
  validateUpload,
  tenantUsageBytes,
  TENANT_QUOTA_BYTES,
} from "@/lib/storage/minio";

/**
 * Direct Product Image Upload API (Supports single or multi-file up to 5 photos, max 5 MB each).
 * Uploads image files directly to MinIO and returns the public CDN URLs.
 *
 * Rules:
 * - Zero em-dash (U+2014).
 * - Multi-tenant isolated storage.
 * - Strict 5 MB max size per photo.
 * - Max 5 photos per product.
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

  const rawFiles = formData.getAll("files");
  const singleFile = formData.get("file");
  const files: File[] = [];

  if (rawFiles.length > 0) {
    for (const f of rawFiles) {
      if (f instanceof File) files.push(f);
    }
  } else if (singleFile instanceof File) {
    files.push(singleFile);
  }

  if (files.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Pilih minimal 1 berkas gambar foto." },
      { status: 400 }
    );
  }

  if (files.length > 5) {
    return NextResponse.json(
      { ok: false, error: "Maksimal 5 foto produk dapat diunggah." },
      { status: 400 }
    );
  }

  // Validate each file against 5 MB size limit & format
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        { ok: false, error: `Foto "${file.name}" (${sizeMb} MB) melebihi batas maksimal 5 MB.` },
        { status: 400 }
      );
    }
    const check = validateUpload("photo", file.size, file.name, file.type);
    if (!check.ok) {
      return NextResponse.json(
        { ok: false, error: `Foto "${file.name}" tidak valid: ${check.error}` },
        { status: 400 }
      );
    }
  }

  // Quota verification
  const totalUploadSize = files.reduce((acc, f) => acc + f.size, 0);
  const used = await tenantUsageBytes(session.sub);
  if (used + totalUploadSize > TENANT_QUOTA_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: "Kapasitas penyimpanan toko penuh (1 GB). Silakan bersihkan berkas lama.",
      },
      { status: 413 }
    );
  }

  const uploadedUrls: string[] = [];
  for (const file of files) {
    const check = validateUpload("photo", file.size, file.name, file.type) as { ok: true; ext: string };
    const buffer = Buffer.from(await file.arrayBuffer());
    const cleanName = file.name
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, "_")
      .replace(/\.[^/.]+$/, "");
    const key = `tenants/${session.sub}/products/${Date.now()}_${cleanName}.${check.ext}`;
    const uploaded = await uploadObject(key, buffer, file.type || "image/jpeg");
    uploadedUrls.push(uploaded.url);
  }

  return NextResponse.json({
    ok: true,
    url: uploadedUrls[0],
    urls: uploadedUrls,
  });
}
