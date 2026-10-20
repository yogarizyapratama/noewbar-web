import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireTenant } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { notifyAdmin } from "@/lib/realtime/event-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireTenant();
  if (!session) {
    return fail("Unauthorized", 401);
  }
  const tenantId = session.sub;
  const ticketId = params.id;

  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, tenant_id: tenantId },
    include: {
      messages: {
        where: { is_internal: false },
        orderBy: { created_at: "asc" },
      },
    },
  });

  if (!ticket) {
    return fail("Tiket tidak ditemukan", 404);
  }

  return ok({
    ticket: {
      id: ticket.id,
      ticket_number: ticket.ticket_number,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      assigned_to: ticket.assigned_to,
      created_at: ticket.created_at.toISOString(),
      updated_at: ticket.updated_at.toISOString(),
      resolved_at: ticket.resolved_at?.toISOString() ?? null,
      messages: ticket.messages.map((m) => ({
        id: m.id,
        sender_type: m.sender_type,
        sender_name: m.sender_name,
        message: m.message,
        attachments: m.attachments,
        created_at: m.created_at.toISOString(),
      })),
    },
  });
}

const replySchema = z.object({
  message: z.string().trim().min(1, "Pesan balasan tidak boleh kosong"),
  attachments: z.array(z.any()).optional().default([]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireTenant();
  if (!session) {
    return fail("Unauthorized", 401);
  }
  const tenantId = session.sub;
  const ticketId = params.id;

  const raw = await req.json().catch(() => null);
  if (!raw) {
    return fail("Payload JSON tidak valid", 400);
  }

  const parsed = replySchema.safeParse(raw);
  if (!parsed.success) {
    return fail(parsed.error.errors[0]?.message || "Pesan balasan tidak valid", 400);
  }

  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, tenant_id: tenantId },
    include: { tenant: { select: { business_name: true, owner_name: true } } },
  });

  if (!ticket) {
    return fail("Tiket tidak ditemukan", 404);
  }

  const senderName = ticket.tenant.business_name || ticket.tenant.owner_name || "Pemilik Toko";

  const message = await prisma.supportTicketMessage.create({
    data: {
      ticket_id: ticket.id,
      sender_type: "TENANT",
      sender_name: senderName,
      message: parsed.data.message,
      attachments: parsed.data.attachments,
      is_internal: false,
    },
  });

  // Reopen ticket to IN_PROGRESS if tenant replies on a resolved/waiting ticket
  const nextStatus = ticket.status === "RESOLVED" || ticket.status === "CLOSED" || ticket.status === "WAITING_TENANT"
    ? "IN_PROGRESS"
    : ticket.status;

  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: {
      status: nextStatus,
      resolved_at: nextStatus === "IN_PROGRESS" ? null : ticket.resolved_at,
      updated_at: new Date(),
    },
  });

  try {
    notifyAdmin({
      type: "ticket",
      detail: `Balasan tiket ${ticket.ticket_number} dari ${senderName}`,
    });
  } catch {
    // Non-blocking
  }

  return ok({
    message: {
      id: message.id,
      sender_type: message.sender_type,
      sender_name: message.sender_name,
      message: message.message,
      attachments: message.attachments,
      created_at: message.created_at.toISOString(),
    },
    ticket_status: nextStatus,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireTenant();
  if (!session) {
    return fail("Unauthorized", 401);
  }
  const tenantId = session.sub;
  const ticketId = params.id;

  const raw = await req.json().catch(() => null);
  const action = raw?.action;
  const status = raw?.status;

  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, tenant_id: tenantId },
  });

  if (!ticket) {
    return fail("Tiket tidak ditemukan", 404);
  }

  if (action === "resolve" || status === "RESOLVED") {
    const updated = await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: "RESOLVED",
        resolved_at: new Date(),
        updated_at: new Date(),
      },
    });

    await prisma.supportTicketMessage.create({
      data: {
        ticket_id: ticket.id,
        sender_type: "SYSTEM",
        sender_name: "Sistem",
        message: "Tiket telah ditandai selesai oleh pemilik toko.",
        is_internal: false,
      },
    });

    return ok({
      ok: true,
      status: updated.status,
      ticket: {
        id: updated.id,
        status: updated.status,
        resolved_at: updated.resolved_at?.toISOString() ?? null,
      },
    });
  }

  return fail("Aksi tidak didukung", 400);
}
