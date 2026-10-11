import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Webhook idempotency ledger (chapter 16).
 *
 * Every provider webhook is recorded under a unique `event_key` before any side
 * effect runs. A duplicate delivery hits the unique constraint and is reported as
 * a duplicate instead of being processed twice.
 *
 * NOTE on `createMany({ skipDuplicates })`: it cannot also return the created rows
 * on PostgreSQL, so we use a create/try-catch and then read back. That is the only
 * shape that both enforces the constraint and tells the caller which case it hit.
 */

export type ClaimResult =
  | { claimed: true; eventId: string }
  | { claimed: false; eventId: string | null; reason: "duplicate" };

export async function claimWebhookEvent(params: {
  provider: string;
  eventKey: string;
  eventType?: string;
  payload: unknown;
}): Promise<ClaimResult> {
  try {
    const created = await prisma.webhookEvent.create({
      data: {
        provider: params.provider,
        event_key: params.eventKey,
        event_type: params.eventType ?? null,
        payload: (params.payload ?? {}) as Prisma.InputJsonValue,
      },
    });
    return { claimed: true, eventId: created.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await prisma.webhookEvent.findUnique({
        where: { event_key: params.eventKey },
        select: { id: true },
      });
      return { claimed: false, eventId: existing?.id ?? null, reason: "duplicate" };
    }
    throw err;
  }
}

export async function markWebhookProcessed(
  eventId: string,
  extra?: { orderId?: string }
): Promise<void> {
  await prisma.webhookEvent.update({
    where: { id: eventId },
    data: {
      processed: true,
      ...(extra?.orderId ? { order_id: extra.orderId } : {}),
    },
  });
}

export async function recentWebhookEvents(limit = 25): Promise<
  {
    id: string;
    provider: string;
    event_key: string;
    event_type: string | null;
    processed: boolean;
    created_at: string;
  }[]
> {
  const rows = await prisma.webhookEvent.findMany({
    orderBy: { created_at: "desc" },
    take: limit,
    select: {
      id: true,
      provider: true,
      event_key: true,
      event_type: true,
      processed: true,
      created_at: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    event_key: r.event_key,
    event_type: r.event_type,
    processed: r.processed,
    created_at: r.created_at.toISOString(),
  }));
}
