import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return fail("Unauthorized", 401);
  }

  const sessions = await prisma.supportChatSession.findMany({
    orderBy: { last_message_at: "desc" },
    include: {
      tenant: {
        select: {
          id: true,
          business_name: true,
          email: true,
          owner_name: true,
          owner_whatsapp: true,
          status: true,
        },
      },
      messages: {
        orderBy: { created_at: "desc" },
        take: 1,
      },
    },
  });

  // Calculate unread counts per session
  const unreadCounts = await prisma.supportChatMessage.groupBy({
    by: ["session_id"],
    where: {
      sender_type: "TENANT",
      read_by_superadmin: false,
    },
    _count: { id: true },
  });

  const unreadMap = new Map<string, number>();
  for (const item of unreadCounts) {
    unreadMap.set(item.session_id, item._count.id);
  }

  const sessionList = sessions.map((s) => {
    const unread = unreadMap.get(s.id) || 0;
    const lastMsg = s.messages[0];
    return {
      id: s.id,
      status: s.status,
      tenant: s.tenant,
      unread_count: unread,
      last_message_at: s.last_message_at.toISOString(),
      last_message: lastMsg
        ? {
            id: lastMsg.id,
            sender_type: lastMsg.sender_type,
            sender_name: lastMsg.sender_name,
            message: lastMsg.message,
            created_at: lastMsg.created_at.toISOString(),
          }
        : null,
    };
  });

  const totalUnread = sessionList.reduce((acc, curr) => acc + curr.unread_count, 0);

  return ok({
    sessions: sessionList,
    total_unread: totalUnread,
  });
}
