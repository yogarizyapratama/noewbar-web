/**
 * Periodic maintenance sweep (chapter 12).
 *
 * The platform needs three recurring jobs that nothing was running:
 *   - deliver due anti-ghosting nudges
 *   - expire stale stock reservations
 *   - reconcile subscriptions whose webhook never arrived
 *
 * They live here as ONE function so the standalone scheduler process
 * (scripts/scheduler.ts) and the manual `POST /api/maintenance` endpoint share
 * exactly one implementation and can never drift apart. The sweep is idempotent:
 * every underlying operation is safe to run twice.
 *
 * This module is deliberately NOT imported from next.config/instrumentation: it
 * pulls Prisma + ioredis + bullmq, and reaching those from an instrumentation
 * file drags them into the webpack Edge pass, failing the build.
 */

import { ensureNudgeWorker, sweepDueNudges, nudgeQueueStats } from "@/lib/queue/nudge-queue";
import { expireStaleReservations } from "@/lib/orders/orders";
import { reconcileSubscriptions } from "@/lib/billing/midtrans";

export type SweepResult = {
  nudges: { delivered: number; error?: string };
  reservations: { expired: number; released: number; error?: string };
  subscriptions: { checked: number; activated: number; grace: number; suspended: number; error?: string };
  worker: boolean;
};

export type MaintenanceSweepOptions = {
  /** Max nudges to deliver in one pass. */
  nudgeLimit?: number;
  /** Start the BullMQ worker if it is not running yet. */
  startWorker?: boolean;
  /**
   * Run the platform-wide subscription reconciliation. Off for tenant-scoped
   * callers: that job scans every tenant, so a single store's dashboard must not
   * be able to trigger platform-wide work.
   */
  reconcile?: boolean;
};

/**
 * Runs one full maintenance pass. Never throws: each job is isolated so a failure
 * in one (e.g. Redis down) cannot stop the others or kill the caller.
 */
export async function runMaintenanceSweep(options: MaintenanceSweepOptions = {}): Promise<SweepResult> {
  const { nudgeLimit = 25, startWorker = true } = options;
  const { reconcile = true } = options;

  const worker = startWorker ? safeStartWorker() : false;

  const nudges = await isolate(async () => ({ delivered: await sweepDueNudges(nudgeLimit) }));
  const reservations = await isolate(() => expireStaleReservations());
  const subscriptions = reconcile
    ? await isolate(() => reconcileSubscriptions())
    : { checked: 0, activated: 0, grace: 0, suspended: 0, skipped: true };

  return { nudges, reservations, subscriptions, worker };
}

function safeStartWorker(): boolean {
  try {
    return ensureNudgeWorker();
  } catch {
    // A missing Redis must not abort the sweep: the DB sweeper still covers nudges.
    return false;
  }
}

/** Runs one job and converts any throw into an `error` field instead of a crash. */
async function isolate<T extends object>(job: () => Promise<T>): Promise<T & { error?: string }> {
  try {
    return await job();
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) } as T & { error?: string };
  }
}

type WorkerGlobal = typeof globalThis & { __noewbarWorkerStarted?: boolean };

/** How often the scheduler process runs a sweep, in minutes. */
export const SWEEP_INTERVAL_MINUTES = 1;

/**
 * Read-only snapshot of queue + worker health for the dashboard status strip.
 * `worker_started` reflects whether the BullMQ worker is running in THIS process,
 * so on the web server it is normally false (the worker is owned by the
 * standalone scheduler process).
 */
export async function schedulerHealth() {
  return {
    worker_started: Boolean((globalThis as WorkerGlobal).__noewbarWorkerStarted),
    queue: await nudgeQueueStats().catch(() => null),
    interval_minutes: SWEEP_INTERVAL_MINUTES,
  };
}
