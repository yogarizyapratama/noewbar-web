import crypto from "crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { ok, fail, rateLimit } from "@/lib/http";
import { requireTenant } from "@/lib/auth";
import { readCatalog } from "@/lib/catalog/sheets";
import { runAgent } from "@/lib/ai/orchestrator";
import type { ProductRow, ToolContext } from "@/lib/ai/types";
import { publicUrlFor } from "@/lib/storage/minio";
import { isBotDisabled } from "@/lib/system/killswitch";

/**
 * Tenant WhatsApp AI Simulator.
 * Allows store owners to test their live AI bot in real-time with their real catalog,
 * active knowledge base documents, payment settings, and custom persona configuration.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  message: z.string().min(1).max(1000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(2500),
      })
    )
    .max(12)
    .default([]),
  persona_override: z
    .object({
      bot_name: z.string().trim().max(60).optional(),
      bot_tone: z.string().trim().max(30).optional(),
      custom_persona_prompt: z.string().trim().max(3000).optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  const session = await requireTenant();
  if (!session) return fail("Unauthorized", 401);

  const limiter = rateLimit(`simulator:${session.sub}`, 30, 60_000);
  if (!limiter.allowed) {
    return fail("Terlalu banyak permintaan simulasi. Tunggu sebentar sebelum mengirim lagi.", 429);
  }

  if (isBotDisabled()) {
    return fail("Bot sedang dinonaktifkan sementara oleh operator platform.", 503);
  }

  const raw = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("Pesan simulasi tidak valid", 422, parsed.error.issues);
  }
  const body = parsed.data;

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.sub },
    include: { catalog_settings: true },
  });
  if (!tenant) return fail("Toko tidak ditemukan", 404);

  const settings = tenant.catalog_settings;
  let catalogRows: ProductRow[] = [];
  let catalogSource: "sheet" | "cache" = "cache";
  let catalogWarning: string | undefined = undefined;

  if (settings?.sheets_url) {
    const cat = await readCatalog(tenant.id, settings.sheets_url);
    catalogRows = cat.rows;
    catalogSource = cat.source;
    catalogWarning = cat.warning;
  } else {
    catalogWarning = "Katalog Google Sheets belum diatur di tab Katalog & Media";
  }

  const payment = {
    bankName: settings?.bank_name ?? "",
    bankAccountNumber: settings?.bank_account_number ?? "",
    bankAccountHolder: settings?.bank_account_holder ?? "",
    qrisUrl: settings?.qris_object_key ? publicUrlFor(settings.qris_object_key) : null,
  };

  const simConvId = crypto.randomUUID();
  const ctx: ToolContext = {
    tenantId: tenant.id,
    conversationId: simConvId,
    buyerJid: "simulator-buyer@s.whatsapp.net",
    buyerName: "Penguji Toko",
    instanceKey: null,
    originSubdistrict: settings?.origin_subdistrict || "Jakarta Selatan",
    nudgeDelayMinutes: settings?.nudge_delay_minutes ?? 120,
    catalog: catalogRows,
    catalogSource,
    payment,
  };

  const botName = body.persona_override?.bot_name ?? settings?.bot_name ?? "Admin CS";
  const botTone = body.persona_override?.bot_tone ?? settings?.bot_tone ?? "RAMAH";
  const customPersonaPrompt =
    body.persona_override?.custom_persona_prompt ?? settings?.custom_persona_prompt ?? "";

  const result = await runAgent({
    ctx,
    businessName: tenant.business_name,
    catalogSource,
    catalogWarning,
    history: body.history,
    incomingText: body.message,
    botName,
    botTone,
    customPersonaPrompt,
  });

  return ok({
    reply: result.replyText,
    media: result.media,
    tool_calls: result.toolCalls,
    tools: result.toolOutcomes.map((t) => ({ tool: t.tool, summary: t.summary })),
    escalated: result.escalated,
    catalog_source: catalogSource,
    catalog_warning: catalogWarning ?? null,
    model: result.model,
    latency_ms: result.latencyMs,
  });
}
