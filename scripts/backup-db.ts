/**
 * Automated Enterprise Database Backup Script (CLI entrypoint).
 *
 * Runs full PostgreSQL schema snapshot, gzip compresses, uploads to MinIO/S3 if available,
 * and maintains 14-day retention cycle.
 *
 * Usage:
 *   npm run db:backup
 */

import fs from "node:fs";
import path from "node:path";

function loadEnv(): void {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

loadEnv();

async function main() {
  console.log("==================================================");
  console.log("   NOEWBAR CS PRO - ENTERPRISE DATABASE BACKUP    ");
  console.log("==================================================");

  const { createDatabaseBackup } = await import("../src/lib/system/backup");
  const result = await createDatabaseBackup();

  if (!result.ok) {
    console.error("[Backup FAILED]:", result.error);
    process.exit(1);
  }

  const uncompressedKb = (result.size_bytes / 1024).toFixed(1);
  const compressedKb = (result.compressed_size_bytes / 1024).toFixed(1);
  const ratio = (100 - (result.compressed_size_bytes / result.size_bytes) * 100).toFixed(1);

  console.log(`[Backup File]   : ${result.filename}`);
  console.log(`[Disk Path]     : ${result.filepath}`);
  console.log(`[Raw Size]      : ${uncompressedKb} KB`);
  console.log(`[Compressed]    : ${compressedKb} KB (saved ${ratio}% with gzip)`);
  console.log(`[MinIO/S3 Sync] : ${result.uploaded_to_s3 ? `Uploaded (${result.s3_key})` : "Local only (S3 not configured)"}`);
  console.log("\n[Snapshot Tables Breakdown]:");
  for (const [table, count] of Object.entries(result.tables)) {
    console.log(`  - ${table.padEnd(16)} : ${count} baris`);
  }
  console.log("==================================================");
  console.log("[Status] Backup completed successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Backup fatal error:", err);
  process.exit(1);
});
