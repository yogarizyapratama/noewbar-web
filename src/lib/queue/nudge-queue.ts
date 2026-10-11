import { Queue, Worker, type Job } from "bullmq";
import IORedis, { type Redis } from "ioredis";
import prisma from "@/lib/prisma";
import { env } from "@/lib/env";
import { waDaemon } from "@/lib/wa/daemon-client";

/**
 * BullMQ anti-ghosting nudge scheduler (chapters 4, 6, 8.C.3).
 *
 * Design constraints:
 *   - Redis is the primary scheduler (delayed jobs).
 *   - Redis being down must NOT lose a nudge: every job is mirrored in the
 *     `scheduled_nudges` table, and a DB sweeper can deliver anything still
 *     PENDING past its time. This is the chapter 12 degradation path.
 *   - Every inbound buyer message cancels PENDING nudges for that conversation
 *     (chapter 14.3: auto-cancel nudge).
 */

export const NUDGE_QUEUE = "noewbar-nudge";

type GlobalWithQueue = typeof globalThis & {
  __noewbarRedis?: Redis;
  __noewbarNudgeQueue?: Queue;
  __noewbarNudgeWorker?: Worker;
  __noewbarWorkerStarted?: boolean;
};

const g = globalThis as GlobalWithQueue;

function redisOptions() {
  return {
    maxRetriesPerRequest: null as null,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 500, 2000)),
  };
}

/** Lazily creates the shared Redis connection. Returns null when unavailable. */
export function getRedis(): Redis | null {
  if (g.__noewbarRedis) return g.__noewbarRedis;
  try {
    const client = new IORedis(env.REDIS_URL, redisOptions());
    // Never let an unhandled 'error' event crash the Next.js process.
    client.on("error", () => {});
    g.__noewbarRedis = client;
    return client;
  } catch {
    return null;
  }
}

export async function redisHealthy(): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;
  try {
    if (client.status === "wait" || client.status === "end") await client.connect();
    const pong = await client.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}

function getQueue(): Queue | null {
  if (g.__noewbarNudgeQueue) return g.__noewbarNudgeQueue;
  const connection = getRedis();
  if (!connection) return null;
  try {
    const queue = new Queue(NUDGE_QUEUE, { connection });
    g.__noewbarNudgeQueue = queue;
    return queue;
  } catch {
    return null;
  }
}

export type NudgeJob = {
  nudgeId: string;
  conversationId: string;
  tenantId: string;
  buyerJid: string;
  instanceKey: string;
  message: string;
};

/**
 * Schedules one nudge. Writes the durable DB row first, then enqueues the
 * delayed Redis job. If Redis is unavailable the DB row remains PENDING and the
 * sweeper picks it up.
 */
export async function scheduleNudge(params: {
  conversationId: string;
  tenantId: string;
  buyerJid: string;
  instanceKey: string;
  delayMinutes: number;
  message: string;
  quotedAmount?: number;
}): Promise<{ nudgeId: string; queued: boolean; scheduledFor: string }> {
  const scheduledFor = new Date(Date.now() + params.delayMinutes * 60 * 1000);

  const payload = JSON.stringify({
    kind: "ANTI_GHOSTING_NUDGE",
    quoted_amount: params.quotedAmount ?? null,
    text: params.message,
  });

  // Cancel any other pending nudge for this conversation so a buyer never
  // receives two follow-ups for the same quote.
  await cancelPendingNudges(params.conversationId);

  const nudge = await prisma.scheduledNudge.create({
    data: {
      conversation_id: params.conversationId,
      scheduled_time: scheduledFor,
      status: "PENDING",
      message_payload: payload,
    },
  });

  const queue = getQueue();
  let queued = false;

  if (queue) {
    try {
      await queue.add(
        "deliver-nudge",
        {
          nudgeId: nudge.id,
          conversationId: params.conversationId,
          tenantId: params.tenantId,
          buyerJid: params.buyerJid,
          instanceKey: params.instanceKey,
          message: params.message,
        } satisfies NudgeJob,
        {
          delay: params.delayMinutes * 60 * 1000,
          jobId: nudge.id, // idempotent: one Redis job per DB row
          removeOnComplete: 500,
          removeOnFail: 1000,
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
        }
      );
      queued = true;
    } catch {
      queued = false;
    }
  }

  return { nudgeId: nudge.id, queued, scheduledFor: scheduledFor.toISOString() };
}

/**
 * Chapter 14.3: a returning buyer cancels the pending follow-up.
 * Returns the number of rows cancelled.
 */
export async function cancelPendingNudges(conversationId: string): Promise<number> {
  const pending = await prisma.scheduledNudge.findMany({
    where: { conversation_id: conversationId, status: "PENDING" },
    select: { id: true },
  });

  if (pending.length === 0) return 0;

  const res = await prisma.scheduledNudge.updateMany({
    where: { conversation_id: conversationId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });

  const queue = getQueue();
  if (queue) {
    for (const n of pending) {
      try {
        const job = await queue.getJob(n.id);
        if (job) await job.remove();
      } catch {
        // a delayed job already moved to active; the sweeper marks it CANCELLED
      }
    }
  }

  return res.count;
}

/** Delivers one nudge. Idempotent: a non-PENDING row is skipped. */
export async function deliverNudge(nudgeId: string): Promise<{ delivered: boolean; reason?: string }> {
  const nudge = await prisma.scheduledNudge.findUnique({
    where: { id: nudgeId },
    include: { conversation: true },
  });

  if (!nudge) return { delivered: false, reason: "nudge_not_found" };
  if (nudge.status !== "PENDING") return { delivered: false, reason: `already_${nudge.status}` };

  const conversation = nudge.conversation;
  if (conversation.is_human_takeover) {
    await prisma.scheduledNudge.update({ where: { id: nudgeId }, data: { status: "CANCELLED" } });
    return { delivered: false, reason: "human_takeover" };
  }

  const instance = await prisma.waInstance.findFirst({
    where: { tenant_id: conversation.tenant_id, connection_status: "CONNECTED" },
    select: { instance_key: true },
  });

  if (!instance) return { delivered: false, reason: "no_connected_instance" };

  let text: string;
  try {
    const parsed = JSON.parse(nudge.message_payload) as { text?: string };
    text = parsed.text ?? "Halo Kak, pesanannya masih kami amankan ya 🙏";
  } catch {
    text = "Halo Kak, pesanannya masih kami amankan ya 🙏";
  }

  const send = await waDaemon.sendText({
    instanceKey: instance.instance_key,
    to: conversation.buyer_jid,
    message: text,
    simulateTyping: true,
  });

  if (!send.ok) return { delivered: false, reason: send.error };

  await prisma.$transaction([
    prisma.scheduledNudge.update({ where: { id: nudgeId }, data: { status: "SENT" } }),
    prisma.chatMessage.create({
      data: {
        conversation_id: conversation.id,
        sender_type: "BOT",
        message_type: "TEXT",
        content: text,
      },
    }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: { last_interaction: new Date() },
    }),
  ]);

  return { delivered: true };
}

/**
 * DB sweeper: delivers PENDING nudges whose time has passed. Covers the case
 * where Redis was down when the job was scheduled.
 */
export async function sweepDueNudges(limit = 20): Promise<number> {
  const due = await prisma.scheduledNudge.findMany({
    where: { status: "PENDING", scheduled_time: { lte: new Date() } },
    orderBy: { scheduled_time: "asc" },
    take: limit,
    select: { id: true },
  });

  let delivered = 0;
  for (const n of due) {
    const res = await deliverNudge(n.id);
    if (res.delivered) delivered += 1;
  }
  return delivered;
}

/**
 * Lazily starts the in-process BullMQ worker. Guarded so that Next.js hot reload
 * or multiple route invocations never spawn duplicate workers.
 */
export function ensureNudgeWorker(): boolean {
  if (g.__noewbarWorkerStarted) return true;
  const connection = getRedis();
  if (!connection) return false;

  try {
    const worker = new Worker(
      NUDGE_QUEUE,
      async (job: Job<NudgeJob>) => {
        const res = await deliverNudge(job.data.nudgeId);
        return res;
      },
      { connection, concurrency: 5 }
    );
    worker.on("error", () => {});
    worker.on("failed", () => {});
    g.__noewbarNudgeWorker = worker;
    g.__noewbarWorkerStarted = true;
    return true;
  } catch {
    return false;
  }
}

export async function nudgeQueueStats(): Promise<{
  redis: boolean;
  waiting: number;
  delayed: number;
  active: number;
  failed: number;
  pendingInDb: number;
}> {
  const healthy = await redisHealthy();
  const queue = healthy ? getQueue() : null;

  const counts = queue
    ? await queue.getJobCounts("waiting", "delayed", "active", "failed")
    : { waiting: 0, delayed: 0, active: 0, failed: 0 };

  const pendingInDb = await prisma.scheduledNudge.count({ where: { status: "PENDING" } });

  return {
    redis: healthy,
    waiting: counts.waiting ?? 0,
    delayed: counts.delayed ?? 0,
    active: counts.active ?? 0,
    failed: counts.failed ?? 0,
    pendingInDb,
  };
}
