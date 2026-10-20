import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return fail("Unauthorized", 401);
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status")?.trim().toUpperCase();
  const priority = searchParams.get("priority")?.trim().toUpperCase();
  const category = searchParams.get("category")?.trim().toUpperCase();
  const tenantId = searchParams.get("tenant_id")?.trim();
  const search = searchParams.get("search")?.trim();

  const where: any = {};
  if (status && status !== "ALL") {
    where.status = status;
  }
  if (priority && priority !== "ALL") {
    where.priority = priority;
  }
  if (category && category !== "ALL") {
    where.category = category;
  }
  if (tenantId && tenantId !== "ALL") {
    where.tenant_id = tenantId;
  }
  if (search) {
    where.OR = [
      { subject: { contains: search, mode: "insensitive" } },
      { ticket_number: { contains: search, mode: "insensitive" } },
      { tenant: { business_name: { contains: search, mode: "insensitive" } } },
      { tenant: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [tickets, totalCount, openCount, inProgressCount, waitingCount, resolvedCount] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: { updated_at: "desc" },
      include: {
        tenant: {
          select: {
            id: true,
            business_name: true,
            email: true,
            owner_whatsapp: true,
            status: true,
          },
        },
        messages: {
          orderBy: { created_at: "desc" },
          take: 1,
        },
      },
    }),
    prisma.supportTicket.count(),
    prisma.supportTicket.count({ where: { status: "OPEN" } }),
    prisma.supportTicket.count({ where: { status: "IN_PROGRESS" } }),
    prisma.supportTicket.count({ where: { status: "WAITING_TENANT" } }),
    prisma.supportTicket.count({ where: { status: { in: ["RESOLVED", "CLOSED"] } } }),
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
      tenant: t.tenant,
      created_at: t.created_at.toISOString(),
      updated_at: t.updated_at.toISOString(),
      resolved_at: t.resolved_at?.toISOString() ?? null,
      last_message: t.messages[0]
        ? {
            sender_type: t.messages[0].sender_type,
            sender_name: t.messages[0].sender_name,
            message: t.messages[0].message,
            is_internal: t.messages[0].is_internal,
            created_at: t.messages[0].created_at.toISOString(),
          }
        : null,
    })),
    stats: {
      total: totalCount,
      open: openCount,
      in_progress: inProgressCount,
      waiting_tenant: waitingCount,
      resolved: resolvedCount,
    },
  });
}
