import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireTenant } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { notifyAdmin } from "@/lib/realtime/event-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const postMessageSchema = z.object({
  message: z.string().trim().min(1, "Pesan tidak boleh kosong").max(4000, "Pesan maksimal 4000 karakter"),
});

export async function GET(_req: NextRequest) {
  const session = await requireTenant();
  if (!session) {
    return fail("Unauthorized", 401);
  }
  const tenantId = session.sub;

  // Find or create active session for this tenant
  let chatSession = await prisma.supportChatSession.findFirst({
    where: { tenant_id: tenantId, status: "OPEN" },
    orderBy: { updated_at: "desc" },
  });

  if (!chatSession) {
    chatSession = await prisma.supportChatSession.create({
      data: {
        tenant_id: tenantId,
        status: "OPEN",
      },
    });

    // Add welcoming system message
    await prisma.supportChatMessage.create({
      data: {
        session_id: chatSession.id,
        sender_type: "SYSTEM",
        sender_name: "Tim Support Noewbar",
        message: "Halo! Selamat datang di Live Chat Support Noewbar. Ada yang bisa kami bantu seputar integrasi WhatsApp, katalog, atau transaksi toko Anda?",
        read_by_tenant: true,
        read_by_superadmin: true,
      },
    });
  }

  // Fetch messages
  const messages = await prisma.supportChatMessage.findMany({
    where: { session_id: chatSession.id },
    orderBy: { created_at: "asc" },
  });

  // Mark unread messages from superadmin as read by tenant
  await prisma.supportChatMessage.updateMany({
    where: {
      session_id: chatSession.id,
      sender_type: "SUPERADMIN",
      read_by_tenant: false,
    },
    data: { read_by_tenant: true },
  });

  // Calculate unread count (if any)
  const unreadCount = messages.filter(
    (m) => m.sender_type === "SUPERADMIN" && !m.read_by_tenant
  ).length;

  return ok({
    session: {
      id: chatSession.id,
      status: chatSession.status,
      last_message_at: chatSession.last_message_at.toISOString(),
      created_at: chatSession.created_at.toISOString(),
    },
    unread_count: unreadCount,
    messages: messages.map((m) => ({
      id: m.id,
      sender_type: m.sender_type,
      sender_name: m.sender_name,
      message: m.message,
      read_by_superadmin: m.read_by_superadmin,
      read_by_tenant: m.read_by_tenant,
      created_at: m.created_at.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await requireTenant();
  if (!session) {
    return fail("Unauthorized", 401);
  }
  const tenantId = session.sub;

  const raw = await req.json().catch(() => null);
  if (!raw) {
    return fail("Payload JSON tidak valid", 400);
  }

  const parsed = postMessageSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(parsed.error.errors[0]?.message || "Pesan tidak valid", 400);
  }

  // Get tenant metadata
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { business_name: true, owner_name: true },
  });

  const senderName = tenant?.business_name || tenant?.owner_name || "Pemilik Toko";

  // Find or create active session
  let chatSession = await prisma.supportChatSession.findFirst({
    where: { tenant_id: tenantId, status: "OPEN" },
    orderBy: { updated_at: "desc" },
  });

  if (!chatSession) {
    chatSession = await prisma.supportChatSession.create({
      data: {
        tenant_id: tenantId,
        status: "OPEN",
      },
    });
  }

  const msg = await prisma.supportChatMessage.create({
    data: {
      session_id: chatSession.id,
      sender_type: "TENANT",
      sender_name: senderName,
      message: parsed.data.message,
      read_by_tenant: true,
      read_by_superadmin: false,
    },
  });

  await prisma.supportChatSession.update({
    where: { id: chatSession.id },
    data: {
      last_message_at: new Date(),
      updated_at: new Date(),
    },
  });

  try {
    notifyAdmin({
      type: "support_chat",
      detail: `[Live Chat] Pesan baru dari ${senderName}: ${parsed.data.message.slice(0, 60)}`,
    });
  } catch {
    // Non-blocking
  }

  return ok({
    message: {
      id: msg.id,
      session_id: msg.session_id,
      sender_type: msg.sender_type,
      sender_name: msg.sender_name,
      message: msg.message,
      read_by_superadmin: msg.read_by_superadmin,
      read_by_tenant: msg.read_by_tenant,
      created_at: msg.created_at.toISOString(),
    },
  });
}
