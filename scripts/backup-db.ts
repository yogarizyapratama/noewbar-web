/**
 * Automated Database Backup & Snapshot Script.
 *
 * Exports JSON snapshot of active tables into `data/backups/`.
 * Cleans up backups older than 14 days for storage hygiene.
 */

import fs from "fs";
import path from "path";
import prisma from "../src/lib/prisma";

const BACKUP_DIR = path.resolve(process.cwd(), "data/backups");
const RETENTION_DAYS = 14;

async function runBackup() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.json`);

  console.log(`[Backup] Starting database snapshot to: ${backupFile}`);

  try {
    // 1. Snapshot critical production tables
    const [tenants, conversations, orders, instances, subscriptions] = await Promise.all([
      prisma.tenant.findMany({
        select: { id: true, business_name: true, email: true, created_at: true },
      }),
      prisma.conversation.findMany({
        take: 1000,
        orderBy: { updated_at: "desc" },
      }),
      prisma.order.findMany({
        take: 1000,
        orderBy: { created_at: "desc" },
      }),
      prisma.waInstance.findMany(),
      prisma.subscription.findMany(),
    ]);

    const snapshot = {
      meta: {
        timestamp: new Date().toISOString(),
        version: "1.0",
        tenant_count: tenants.length,
        order_count: orders.length,
      },
      data: {
        tenants,
        conversations,
        orders,
        instances,
        subscriptions,
      },
    };

    fs.writeFileSync(backupFile, JSON.stringify(snapshot, null, 2), "utf-8");
    const stat = fs.statSync(backupFile);
    console.log(`[Backup] Snapshot complete: ${(stat.size / 1024).toFixed(2)} KB written.`);

    // 2. Retention cleanup (older than 14 days)
    const files = fs.readdirSync(BACKUP_DIR);
    const now = Date.now();
    const maxAge = RETENTION_DAYS * 24 * 60 * 60 * 1000;

    let removed = 0;
    for (const f of files) {
      if (!f.startsWith("backup-")) continue;
      const fp = path.join(BACKUP_DIR, f);
      const fstat = fs.statSync(fp);
      if (now - fstat.mtimeMs > maxAge) {
        fs.unlinkSync(fp);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[Backup] Cleaned up ${removed} old backup files older than ${RETENTION_DAYS} days.`);
    }

    console.log("[Backup] All backup operations completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("[Backup] Error during backup snapshot:", err);
    process.exit(1);
  }
}

runBackup();
