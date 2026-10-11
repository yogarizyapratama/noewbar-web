/**
 * Standalone maintenance scheduler (chapter 12).
 *
 *   npm run scheduler
 *
 * Run it as its own long-lived process: systemd, launchd, pm2, a container
 * sidecar, or a crontab entry calling the same npm script.
 *
 * WHY A SEPARATE PROCESS instead of a Next.js instrumentation hook: importing
 * Prisma + ioredis + bullmq from an instrumentation file pulls those native
 * modules into every webpack compilation context (including the Edge pass),
 * which fails `next build` with `Can't resolve 'crypto'`. Keeping the scheduler
 * outside the bundler keeps the web build clean while still guaranteeing the jobs
 * actually run, which was the real defect: the sweep functions existed but nothing
 * ever called them.
 *
 * The jobs live in src/lib/system/scheduler.ts, shared verbatim with
 * POST /api/maintenance so the two can never drift apart.
 */

import fs from "node:fs";
import path from "node:path";

/** Loads .env before importing anything that reads process.env at import time. */
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

const INTERVAL_MINUTES = Math.max(1, Number(process.env.NOEWBAR_SWEEP_INTERVAL_MINUTES ?? "1") || 1);
const NUDGE_LIMIT = Math.max(1, Number(process.env.NOEWBAR_SWEEP_NUDGE_LIMIT ?? "25") || 25);

let running = true;

async function main(): Promise<void> {
  const { runMaintenanceSweep } = await import("@/lib/system/scheduler");

  const tick = async (label: string): Promise<void> => {
    const startedAt = Date.now();
    const sweep = await runMaintenanceSweep({ nudgeLimit: NUDGE_LIMIT, reconcile: true });

    const parts = [
      `worker=${sweep.worker ? "up" : "down"}`,
      `nudges=${sweep.nudges.delivered ?? 0}${sweep.nudges.error ? ` (${sweep.nudges.error})` : ""}`,
      `reservations=${sweep.reservations.expired ?? 0}/${sweep.reservations.released ?? 0}${sweep.reservations.error ? ` (${sweep.reservations.error})` : ""}`,
      `subs=${sweep.subscriptions.checked}/${sweep.subscriptions.activated} grace=${sweep.subscriptions.grace} susp=${sweep.subscriptions.suspended}${sweep.subscriptions.error ? ` (${sweep.subscriptions.error})` : ""}`,
      `${Date.now() - startedAt}ms`,
    ];

    console.log(`[noewbar-scheduler] ${label} ${parts.join(" ")}`);
  };

  // First pass immediately so a restart recovers any work missed while down.
  await tick("initial");
  console.log(`[noewbar-scheduler] running every ${INTERVAL_MINUTES} min (pid ${process.pid})`);

  const timer = setInterval(() => {
    if (!running) return;
    // The sweep never throws, but guard anyway: an unexpected rejection in a
    // timer callback would otherwise take the whole process down.
    tick("sweep").catch((err) => {
      console.error(
        "[noewbar-scheduler] tick failed:",
        err instanceof Error ? err.message : err
      );
    });
  }, INTERVAL_MINUTES * 60_000);

  const shutdown = (signal: string): void => {
    if (!running) return;
    running = false;
    clearInterval(timer);
    console.log(`[noewbar-scheduler] ${signal} received, stopping`);
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[noewbar-scheduler] fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
