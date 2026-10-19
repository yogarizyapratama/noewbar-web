import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { ok, fail } from "@/lib/http";
import { requireTenant } from "@/lib/auth";
import { getTenantSubscriptionInfo } from "@/lib/billing/subscription-guard";
import { waDaemon } from "@/lib/wa/daemon-client";
import { notifyTenant } from "@/lib/realtime/event-bus";

/**
 * Live chat + human takeover (chapter 10.B).
 *
 * The store owner can read conversations and take over. Taking over mutes the bot
 * for that buyer (`is_human_takeover = true`), which every reply path honours, and
 * replies sent from here are recorded as HUMAN_AGENT so the transcript stays honest
 * about who said what.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("takeover"),
    conversation_id: z.string().uuid(),
    enabled: z.boolean(),
  }),
  z.object({
    action: z.literal("send"),
    conversation_id: z.string().uuid(),
    message: z.string().min(1).max(2000),
  }),
]);

export async function POST(req: NextRequest) {
  const session = await requireTenant();
  if (!session) return fail("Unauthorized", 401);

  const subInfo = await getTenantSubscriptionInfo(session.sub);
  if (subInfo.isExpired) {
    return fail("Langganan Anda telah berakhir. Perbarui paket untuk menggunakan fitur ini.", 403);
  }

  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return fail("Aksi tidak valid", 422, parsed.error.issues);

  const body = parsed.data;

  const conversation = await prisma.conversation.findFirst({
    where: { id: body.conversation_id, tenant_id: session.sub },
  });
  if (!conversation) return fail("Conversation not found", 404);

  if (body.action === "takeover") {
    const updated = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        is_human_takeover: body.enabled,
        ...(body.enabled ? { pipeline_stage: "ESCALATED" } : {}),
      },
      select: { id: true, is_human_takeover: true, pipeline_stage: true },
    });

    // Resuming the bot does not silently drop a pending escalations marker.
    await prisma.chatMessage.create({
      data: {
        conversation_id: conversation.id,
        sender_type: "HUMAN_AGENT",
        message_type: "TEXT",
        content: body.enabled
          ? "[TAKEOVER] Pemilik toko mengambil alih percakapan ini."
          : "[TAKEOVER] Percakapan dikembalikan ke bot.",
      },
    });

    // SSE: takeover state changed -> any dashboard view of this thread refreshes.
    notifyTenant(session.sub, { type: "chat" });

    return ok({ action: "takeover", conversation: updated });
  }

  // send (manual reply from the dashboard)
  const instance = await prisma.waInstance.findFirst({
    where: { tenant_id: session.sub, connection_status: "CONNECTED" },
    select: { instance_key: true },
  });

  if (!instance) {
    return fail(
      "Tidak ada nomor WhatsApp yang terhubung. Hubungkan nomor toko dulu di menu Koneksi WhatsApp.",
      409
    );
  }

  const sent = await waDaemon.sendText({
    instanceKey: instance.instance_key,
    to: conversation.buyer_jid,
    message: body.message,
    simulateTyping: true,
  });

  await prisma.chatMessage.create({
    data: {
      conversation_id: conversation.id,
      sender_type: "HUMAN_AGENT",
      message_type: "TEXT",
      content: body.message,
    } satisfies Prisma.ChatMessageUncheckedCreateInput,
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      last_interaction: new Date(),
      is_human_takeover: true,
      pipeline_stage: "ESCALATED",
    },
  });

  notifyTenant(session.sub, { type: "chat" });

  return ok({
    action: "send",
    delivered: sent.ok,
    error: sent.ok ? null : sent.error,
  });
}

/** Conversation list (optionally with one conversation's transcript). */
export async function GET(req: NextRequest) {
  const session = await requireTenant();
  if (!session) return fail("Unauthorized", 401);

  const url = new URL(req.url);
  const conversationId = url.searchParams.get("conversation_id");

  if (conversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenant_id: session.sub },
      include: {
        chat_messages: { orderBy: { created_at: "asc" }, take: 200 },
        scheduled_nudges: { orderBy: { scheduled_time: "desc" }, take: 5 },
        orders: { orderBy: { created_at: "desc" }, take: 5, select: { id: true, order_number: true, order_status: true, payment_status: true, total_amount: true } },
      },
    });

    if (!conversation) return fail("Conversation not found", 404);

    return ok({
      conversation: {
        id: conversation.id,
        buyer_jid: conversation.buyer_jid,
        buyer_name: conversation.buyer_name,
        pipeline_stage: conversation.pipeline_stage,
        is_human_takeover: conversation.is_human_takeover,
        last_interaction: conversation.last_interaction.toISOString(),
      },
      messages: conversation.chat_messages.map((m) => ({
        id: m.id,
        sender_type: m.sender_type,
        message_type: m.message_type,
        content: m.content,
        media_url: m.media_url,
        created_at: m.created_at.toISOString(),
      })),
      nudges: conversation.scheduled_nudges.map((n) => ({
        id: n.id,
        status: n.status,
        scheduled_time: n.scheduled_time.toISOString(),
      })),
      orders: conversation.orders.map((o) => ({
        id: o.id,
        order_number: o.order_number,
        order_status: o.order_status,
        payment_status: o.payment_status,
        total_amount: Number(o.total_amount),
      })),
    });
  }

  const conversations = await prisma.conversation.findMany({
    where: { tenant_id: session.sub },
    orderBy: { last_interaction: "desc" },
    take: 50,
    include: {
      _count: { select: { chat_messages: true } },
    },
  });

  const counts = await prisma.conversation.groupBy({
    by: ["pipeline_stage"],
    where: { tenant_id: session.sub },
    _count: { _all: true },
  });

  return ok({
    conversations: conversations.map((c) => ({
      id: c.id,
      buyer_jid: c.buyer_jid,
      buyer_name: c.buyer_name,
      pipeline_stage: c.pipeline_stage,
      is_human_takeover: c.is_human_takeover,
      last_interaction: c.last_interaction.toISOString(),
      message_count: c._count.chat_messages,
    })),
    counts: counts.reduce<Record<string, number>>((acc, c) => {
      acc[c.pipeline_stage] = c._count._all;
      return acc;
    }, {}),
  });
}
