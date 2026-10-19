import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import prisma from "@/lib/prisma";
import { uploadObject } from "@/lib/storage/minio";

const BACKUP_DIR = path.resolve(process.cwd(), "data/backups");
const RETENTION_DAYS = 14;

export interface BackupResult {
  ok: boolean;
  filename: string;
  filepath: string;
  size_bytes: number;
  compressed_size_bytes: number;
  tables: Record<string, number>;
  uploaded_to_s3: boolean;
  s3_key?: string;
  error?: string;
  timestamp: string;
}

export async function createDatabaseBackup(): Promise<BackupResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}.json.gz`;

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const filepath = path.join(BACKUP_DIR, filename);

  try {
    // 1. Snapshot all production models
    const [
      tenants,
      catalogSettings,
      products,
      knowledgeDocs,
      orders,
      conversations,
      instances,
      subscriptions,
      websites,
    ] = await Promise.all([
      prisma.tenant.findMany(),
      prisma.catalogSetting.findMany(),
      prisma.product.findMany(),
      prisma.knowledgeDocument.findMany(),
      prisma.order.findMany({ take: 5000, orderBy: { created_at: "desc" } }),
      prisma.conversation.findMany({ take: 5000, orderBy: { updated_at: "desc" } }),
      prisma.waInstance.findMany(),
      prisma.subscription.findMany(),
      prisma.website.findMany(),
    ]);

    const snapshot = {
      meta: {
        timestamp: new Date().toISOString(),
        version: "2.0",
        engine: "PostgreSQL 16",
        tables: {
          tenants: tenants.length,
          catalogSettings: catalogSettings.length,
          products: products.length,
          knowledgeDocs: knowledgeDocs.length,
          orders: orders.length,
          conversations: conversations.length,
          instances: instances.length,
          subscriptions: subscriptions.length,
          websites: websites.length,
        },
      },
      data: {
        tenants,
        catalogSettings,
        products,
        knowledgeDocs,
        orders,
        conversations,
        instances,
        subscriptions,
        websites,
      },
    };

    const jsonString = JSON.stringify(snapshot, null, 2);
    const uncompressedBytes = Buffer.byteLength(jsonString, "utf8");
    const compressedGzip = zlib.gzipSync(Buffer.from(jsonString, "utf8"));

    // Write compressed snapshot to disk
    fs.writeFileSync(filepath, compressedGzip);

    // 2. Upload to MinIO S3 if available
    let uploadedToS3 = false;
    let s3Key: string | undefined;

    try {
      s3Key = `backups/${filename}`;
      const uploadRes = await uploadObject(s3Key, compressedGzip, "application/gzip");
      uploadedToS3 = Boolean(uploadRes && uploadRes.success);
    } catch {
      // S3 optional; continue without failing local backup
      uploadedToS3 = false;
    }

    // 3. Retention policy cleanup
    try {
      const files = fs.readdirSync(BACKUP_DIR);
      const now = Date.now();
      const maxAge = RETENTION_DAYS * 24 * 60 * 60 * 1000;

      for (const f of files) {
        if (!f.startsWith("backup-")) continue;
        const fp = path.join(BACKUP_DIR, f);
        const fstat = fs.statSync(fp);
        if (now - fstat.mtimeMs > maxAge) {
          fs.unlinkSync(fp);
        }
      }
    } catch {
      // cleanup failure is non-fatal
    }

    return {
      ok: true,
      filename,
      filepath,
      size_bytes: uncompressedBytes,
      compressed_size_bytes: compressedGzip.length,
      tables: snapshot.meta.tables,
      uploaded_to_s3: uploadedToS3,
      s3_key: s3Key,
      timestamp: snapshot.meta.timestamp,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      filename,
      filepath,
      size_bytes: 0,
      compressed_size_bytes: 0,
      tables: {},
      uploaded_to_s3: false,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}
