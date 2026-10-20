import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireTenant } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { notifyAdmin } from "@/lib/realtime/event-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createTicketSchema = z.object({
  subject: z.string().min(3, "Subjek tiket minimal 3 karakter").max(200, "Subjek maksimal 200 karakter"),
  category: z.enum(["GENERAL", "BILLING", "TECHNICAL", "WHATSAPP", "FEATURE_REQUEST"]).default("GENERAL"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  message: z.string().min(5, "Deskripsi kendala minimal 5 karakter"),
  attachments: z.array(z.any()).optional().default([]),
});

export async function GET(req: NextRequest) {
  const session = await requireTenant();
  if (!session) {
    return fail("Unauthorized", 401);
  }
  const tenantId = session.sub;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status")?.trim().toUpperCase();
  const category = searchParams.get("category")?.trim().toUpperCase();
  const search = searchParams.get("search")?.trim();

  const where: any = { tenant_id: tenantId };
  if (status && status !== "ALL") {
    where.status = status;
  }
  if (category && category !== "ALL") {
    where.category = category;
  }
  if (search) {
    where.OR = [
      { subject: { contains: search, mode: "insensitive" } },
      { ticket_number: { contains: search, mode: "insensitive" } },
    ];
  }

  const [tickets, totalCount, openCount, inProgressCount, resolvedCount] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: { updated_at: "desc" },
      include: {
        messages: {
          where: { is_internal: false },
          orderBy: { created_at: "desc" },
          take: 1,
        },
      },
    }),
    prisma.supportTicket.count({ where: { tenant_id: tenantId } }),
    prisma.supportTicket.count({ where: { tenant_id: tenantId, status: "OPEN" } }),
    prisma.supportTicket.count({ where: { tenant_id: tenantId, status: "IN_PROGRESS" } }),
    prisma.supportTicket.count({ where: { tenant_id: tenantId, status: { in: ["RESOLVED", "CLOSED"] } } }),
  ]);

  return ok({
    tickets: tickets.map((t) => ({
      id: t.id,
      ticket_number: t.ticket_number,
      subject: t.subject,
      category: t.category,
      priority: t.priority,
      status: t.status,
      assigned_to: t.assigned_to,
      created_at: t.created_at.toISOString(),
      updated_at: t.updated_at.toISOString(),
      resolved_at: t.resolved_at?.toISOString() ?? null,
      last_message: t.messages[0]
        ? {
            sender_type: t.messages[0].sender_type,
            sender_name: t.messages[0].sender_name,
            message: t.messages[0].message,
            created_at: t.messages[0].created_at.toISOString(),
          }
        : null,
    })),
    stats: {
      total: totalCount,
      open: openCount,
      in_progress: inProgressCount,
      resolved: resolvedCount,
    },
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

  const parsed = createTicketSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(parsed.error.errors[0]?.message || "Validasi gagal", 400);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { business_name: true, owner_name: true, email: true },
  });
  if (!tenant) {
    return fail("Tenant tidak ditemukan", 404);
  }

  // Generate unique human-readable ticket number (e.g. TKT-261020-4821)
  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const randPart = Math.floor(1000 + Math.random() * 9000);
  const ticketNumber = `TKT-${datePart}-${randPart}`;

  const ticket = await prisma.supportTicket.create({
    data: {
      tenant_id: tenantId,
      ticket_number: ticketNumber,
      subject: parsed.data.subject,
      category: parsed.data.category,
      priority: parsed.data.priority,
      status: "OPEN",
      messages: {
        create: {
          sender_type: "TENANT",
          sender_name: tenant.business_name || tenant.owner_name || "Pemilik Toko",
          message: parsed.data.message,
          attachments: parsed.data.attachments,
          is_internal: false,
        },
      },
    },
    include: {
      messages: true,
    },
  });

  // Notify superadmin via real-time SSE event bus
  try {
    notifyAdmin({
      type: "ticket",
      detail: `Tiket baru ${ticket.ticket_number} dari ${tenant.business_name}: ${ticket.subject}`,
    });
  } catch {
    // Non-blocking realtime signal
  }

  return ok({
    ticket: {
      id: ticket.id,
      ticket_number: ticket.ticket_number,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      created_at: ticket.created_at.toISOString(),
    },
  });
}
