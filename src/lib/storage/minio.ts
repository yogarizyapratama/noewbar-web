import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { env, MINIO_BASE, MINIO_PUBLIC_BASE } from "@/lib/env";

/**
 * MinIO S3 client (specification chapter 8).
 * Bucket `noewbar-assets` with anonymous read policy.
 *
 * Object key convention:
 *   tenants/{tenant_id}/products/{sku}.{ext}
 *   tenants/{tenant_id}/qr/{instance_key}.png
 *   tenants/{tenant_id}/proofs/{conversation_id}/{message_id}.jpg
 */
export const s3Client = new S3Client({
  endpoint: MINIO_BASE,
  region: "us-east-1", // MinIO ignores the region but the SDK requires one
  credentials: {
    accessKeyId: env.MINIO_ACCESS_KEY,
    secretAccessKey: env.MINIO_SECRET_KEY,
  },
  forcePathStyle: true,
});

export const BUCKET = env.MINIO_BUCKET;

export function publicUrlFor(key: string): string {
  const base = (MINIO_PUBLIC_BASE || `${MINIO_BASE}/${BUCKET}`).replace(/\/$/, "");
  return `${base}/${key.replace(/^\//, "")}`;
}

export function tenantProductKey(tenantId: string, sku: string, ext = "jpg"): string {
  const clean = sku.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "-");
  return `tenants/${tenantId}/products/${clean}.${ext}`;
}

export function tenantQrisKey(tenantId: string): string {
  return `tenants/${tenantId}/qr/qris.png`;
}

export function tenantProofKey(tenantId: string, conversationId: string, id: string): string {
  return `tenants/${tenantId}/proofs/${conversationId}/${id}.jpg`;
}

export function tenantDocKey(tenantId: string, filename: string): string {
  const clean = filename.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  return `tenants/${tenantId}/docs/${Date.now()}_${clean}`;
}

export type UploadResult = { success: boolean; url: string; key: string; size: number };

export async function uploadObject(
  key: string,
  body: Buffer,
  contentType = "image/jpeg"
): Promise<UploadResult> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  return { success: true, url: publicUrlFor(key), key, size: body.byteLength };
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** Removes one object. Used by media management and by the gate cleanup steps. */
export async function deleteObject(key: string): Promise<boolean> {
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** Removes every object under a prefix. Returns how many are left behind. */
export async function deletePrefix(prefix: string): Promise<number> {
  const keys = await listPrefix(prefix, 1000);
  let remaining = 0;
  for (const k of keys) {
    if (!(await deleteObject(k))) remaining += 1;
  }
  return remaining;
}


export async function getObjectBuffer(key: string): Promise<Buffer | null> {
  try {
    const res = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    if (!res.Body) return null;
    if (typeof (res.Body as any).transformToByteArray === "function") {
      const bytes = await (res.Body as any).transformToByteArray();
      return Buffer.from(bytes);
    }
    const chunks: Uint8Array[] = [];
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch {
    return null;
  }
}

export async function listPrefix(prefix: string, max = 100): Promise<string[]> {
  try {
    const res = await s3Client.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, MaxKeys: max })
    );
    return (res.Contents ?? []).map((o) => o.Key!).filter(Boolean);
  } catch {
    return [];
  }
}

/** Storage quota guard: 1 GB per store (specification chapter 8.A). */
export const TENANT_QUOTA_BYTES = 1024 * 1024 * 1024;

export async function tenantUsageBytes(tenantId: string): Promise<number> {
  let total = 0;
  let token: string | undefined;
  try {
    do {
      const res = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: BUCKET,
          Prefix: `tenants/${tenantId}/`,
          ContinuationToken: token,
        })
      );
      for (const obj of res.Contents ?? []) total += obj.Size ?? 0;
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
  } catch {
    return 0;
  }
  return total;
}

export type MediaKind = "photo" | "video" | "pdf";

export const MAX_UPLOAD_BYTES: Record<MediaKind, number> = {
  photo: 5 * 1024 * 1024,
  video: 15 * 1024 * 1024,
  pdf: 10 * 1024 * 1024,
};

export const ALLOWED_MEDIA: Record<MediaKind, { mime: string[]; ext: string[] }> = {
  photo: {
    mime: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    ext: ["jpg", "jpeg", "png", "webp"],
  },
  video: { mime: ["video/mp4"], ext: ["mp4"] },
  pdf: { mime: ["application/pdf"], ext: ["pdf"] },
};

/**
 * Validates an upload against the max-file-size matrix before the bytes ever
 * reach MinIO. Returns the resolved extension on success.
 */
export function validateUpload(
  kind: MediaKind,
  sizeBytes: number,
  filename: string,
  mime: string
): { ok: true; ext: string } | { ok: false; error: string } {
  const limits = MAX_UPLOAD_BYTES[kind];
  if (sizeBytes > limits) {
    return {
      ok: false,
      error: `${kind} exceeds the ${Math.round(limits / 1024 / 1024)} MB limit`,
    };
  }

  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  const rules = ALLOWED_MEDIA[kind];
  if (!rules.ext.includes(ext) || !rules.mime.includes(mime.toLowerCase())) {
    return {
      ok: false,
      error: `${kind} must be one of: ${rules.ext.join(", ")}`,
    };
  }

  return { ok: true, ext };
}
