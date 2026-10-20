import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { notifyTenant } from "@/lib/realtime/event-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminSession();
  if (!admin) {
    return fail("Unauthorized", 401);
  }
  const ticketId = params.id;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
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
      tenant: ticket.tenant,
      created_at: ticket.created_at.toISOString(),
      updated_at: ticket.updated_at.toISOString(),
      resolved_at: ticket.resolved_at?.toISOString() ?? null,
      messages: ticket.messages.map((m) => ({
        id: m.id,
        sender_type: m.sender_type,
        sender_name: m.sender_name,
        message: m.message,
        attachments: m.attachments,
        is_internal: m.is_internal,
        created_at: m.created_at.toISOString(),
      })),
    },
  });
}

const updateTicketSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_TENANT", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assigned_to: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminSession();
  if (!admin) {
    return fail("Unauthorized", 401);
  }
  const ticketId = params.id;

  const raw = await req.json().catch(() => null);
  if (!raw) {
    return fail("Payload JSON tidak valid", 400);
  }

  const parsed = updateTicketSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(parsed.error.errors[0]?.message || "Validasi gagal", 400);
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
  });
  if (!ticket) {
    return fail("Tiket tidak ditemukan", 404);
  }

  const dataToUpdate: any = {
    updated_at: new Date(),
  };

  if (parsed.data.status) {
    dataToUpdate.status = parsed.data.status;
    if (parsed.data.status === "RESOLVED" || parsed.data.status === "CLOSED") {
      dataToUpdate.resolved_at = new Date();
    } else {
      dataToUpdate.resolved_at = null;
    }
  }

  if (parsed.data.priority) {
    dataToUpdate.priority = parsed.data.priority;
  }

  if (parsed.data.assigned_to !== undefined) {
    dataToUpdate.assigned_to = parsed.data.assigned_to;
  }

  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: dataToUpdate,
  });

  return ok({
    ticket: {
      id: updated.id,
      ticket_number: updated.ticket_number,
      status: updated.status,
      priority: updated.priority,
      assigned_to: updated.assigned_to,
      updated_at: updated.updated_at.toISOString(),
      resolved_at: updated.resolved_at?.toISOString() ?? null,
    },
  });
}

const postReplySchema = z.object({
  message: z.string().trim().min(1, "Pesan tidak boleh kosong"),
  is_internal: z.boolean().default(false),
  attachments: z.array(z.any()).optional().default([]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminSession();
  if (!admin) {
    return fail("Unauthorized", 401);
  }
  const ticketId = params.id;

  const raw = await req.json().catch(() => null);
  if (!raw) {
    return fail("Payload JSON tidak valid", 400);
  }

  const parsed = postReplySchema.safeParse(raw);
  if (!parsed.success) {
    return fail(parsed.error.errors[0]?.message || "Validasi gagal", 400);
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
  });
  if (!ticket) {
    return fail("Tiket tidak ditemukan", 404);
  }

  const message = await prisma.supportTicketMessage.create({
    data: {
      ticket_id: ticket.id,
      sender_type: "SUPERADMIN",
      sender_name: admin.email || "Support Noewbar",
      message: parsed.data.message,
      attachments: parsed.data.attachments,
      is_internal: parsed.data.is_internal,
    },
  });

  // If this is a public reply to the tenant, auto update ticket status to WAITING_TENANT
  let newStatus = ticket.status;
  if (!parsed.data.is_internal && (ticket.status === "OPEN" || ticket.status === "IN_PROGRESS")) {
    newStatus = "WAITING_TENANT";
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: newStatus,
        updated_at: new Date(),
      },
    });

    // Notify tenant real-time
    try {
      notifyTenant(ticket.tenant_id, {
        type: "ticket",
        detail: `Balasan baru dari tim support untuk tiket ${ticket.ticket_number}`,
      });
    } catch {
      // Non-blocking
    }
  }

  return ok({
    message: {
      id: message.id,
      sender_type: message.sender_type,
      sender_name: message.sender_name,
      message: message.message,
      attachments: message.attachments,
      is_internal: message.is_internal,
      created_at: message.created_at.toISOString(),
    },
    ticket_status: newStatus,
  });
}
