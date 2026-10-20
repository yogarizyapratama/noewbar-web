import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { notifyTenant } from "@/lib/realtime/event-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const replySchema = z.object({
  message: z.string().trim().min(1, "Pesan tidak boleh kosong").max(4000, "Pesan maksimal 4000 karakter"),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return fail("Unauthorized", 401);
  }
  const sessionId = params.sessionId;

  // Mark tenant messages as read by superadmin
  await prisma.supportChatMessage.updateMany({
    where: {
      session_id: sessionId,
      sender_type: "TENANT",
      read_by_superadmin: false,
    },
    data: { read_by_superadmin: true },
  });

  const session = await prisma.supportChatSession.findUnique({
    where: { id: sessionId },
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
        orderBy: { created_at: "asc" },
      },
    },
  });

  if (!session) {
    return fail("Sesi live chat tidak ditemukan", 404);
  }

  return ok({
    session: {
      id: session.id,
      status: session.status,
      tenant: session.tenant,
      last_message_at: session.last_message_at.toISOString(),
      created_at: session.created_at.toISOString(),
    },
    messages: session.messages.map((m) => ({
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

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return fail("Unauthorized", 401);
  }
  const sessionId = params.sessionId;

  const raw = await req.json().catch(() => null);
  if (!raw) {
    return fail("Payload JSON tidak valid", 400);
  }

  const parsed = replySchema.safeParse(raw);
  if (!parsed.success) {
    return fail(parsed.error.errors[0]?.message || "Pesan tidak valid", 400);
  }

  const session = await prisma.supportChatSession.findUnique({
    where: { id: sessionId },
    select: { id: true, tenant_id: true, status: true },
  });

  if (!session) {
    return fail("Sesi live chat tidak ditemukan", 404);
  }

  const msg = await prisma.supportChatMessage.create({
    data: {
      session_id: session.id,
      sender_type: "SUPERADMIN",
      sender_name: "Tim Support Noewbar",
      message: parsed.data.message,
      read_by_superadmin: true,
      read_by_tenant: false,
    },
  });

  await prisma.supportChatSession.update({
    where: { id: session.id },
    data: {
      last_message_at: new Date(),
      updated_at: new Date(),
    },
  });

  try {
    notifyTenant(session.tenant_id, {
      type: "support_chat",
      detail: `[Support Live] Balasan baru dari Tim Support: ${parsed.data.message.slice(0, 60)}`,
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
