import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import prisma from "@/lib/prisma";
import { env } from "@/lib/env";
import { TOOL_SCHEMAS, executeTool } from "@/lib/ai/micro-tools";
import { buildSystemPrompt, fenceUntrusted, MAX_HISTORY_MESSAGES, MAX_TOOL_ROUNDS, SAFE_FALLBACK_REPLY } from "@/lib/ai/prompts";
import { recordToolTraces } from "@/lib/ai/micro-tools";
import type {
  OutboundMedia,
  ProductRow,
  TenantPromoTier,
  TenantShippingSchedule,
  TenantVoucher,
  ToolContext,
  ToolExecutionResult,
  ToolName,
} from "@/lib/ai/types";
import { TOOL_NAMES } from "@/lib/ai/types";
import { cancelPendingNudges } from "@/lib/queue/nudge-queue";
import { modelChain, chatWithFallback, TOOL_REQUEST_DEFAULTS, aiClient } from "@/lib/ai/gateway";
import { publicUrlFor } from "@/lib/storage/minio";
import { getActiveKnowledgeText } from "@/lib/knowledge/knowledge-store";

/**
 * AI orchestrator (chapter 6).
 *
 * Single contract endpoint: the whole platform talks to one model id (`combo-ai`)
 * on the self-hosted 9router gateway. Model rotation, key cycling and upstream
 * fallback all happen inside 9router, so this code never changes when the pool does.
 */

const client = aiClient;

/**
 * True when a gateway error means "this model refuses batched tool calls".
 * The routed upstream answers 400 with `This model only supports single
 * tool-calls at once!` when a turn requests more than one tool.
 */
export function isSingleToolCallError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /single tool[- ]?calls? at once/i.test(message);
}

export const MAX_TOOL_CALLS_PER_TURN = 8;

export type OrchestratorResult = {
  replyText: string;
  toolOutcomes: ToolExecutionResult[];
  media: OutboundMedia[];
  escalated: boolean;
  model: string;
  latencyMs: number;
  toolCalls: number;
  degraded: boolean;
  degradationReason?: string;
};

export type HandleInboundResult = OrchestratorResult & {
  conversationId: string;
  buyerJid: string;
  catalogSource: "sheet" | "cache";
  catalogWarning?: string;
  botMuted: boolean;
  botMutedReason?: string;
  persisted: boolean;
};

function isKnownTool(name: string): name is ToolName {
  return (TOOL_NAMES as string[]).includes(name);
}

/**
 * Extra deterministic guardrail that complements the system prompt: a reply may
 * not contain a Rupiah figure the tools never produced. This is the last line of
 * defence against invented prices.
 */
export function findUnbackedPrices(
  replyText: string,
  toolOutcomes: ToolExecutionResult[],
  additionalBackedValues?: (string | number)[]
): string[] {
  const produced = new Set<string>();
  const backedNums = new Set<number>();

  const collect = (value: unknown): void => {
    if (typeof value === "number") {
      const n = Math.round(value);
      produced.add(String(n));
      if (n > 0) backedNums.add(n);
      return;
    }
    if (typeof value === "string") {
      const digits = value.replace(/[^0-9]/g, "");
      if (digits) {
        const n = parseInt(digits, 10);
        produced.add(String(n));
        if (n > 0) backedNums.add(n);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (value && typeof value === "object") {
      Object.values(value as Record<string, unknown>).forEach(collect);
    }
  };

  toolOutcomes.forEach((o) => collect(o.payload));
  if (additionalBackedValues) {
    additionalBackedValues.forEach((val) => collect(val));
  }

  // Honest arithmetic over tool-backed values must NOT be flagged as invented:
  // a reply may legitimately quote subtotal + ongkir (e.g. 185.000 + 11.000 =
  // 196.000) or a line total, where the sum itself never appears verbatim in a
  // payload. Allow exact sums of up to 3 backed numbers; anything else is still
  // treated as hallucinated (an invented Rp 999.000 will not match any sum).
  const pool = [...backedNums].slice(0, 40);
  const allowed = new Set<number>(pool);
  for (let i = 0; i < pool.length; i += 1) {
    for (let j = i; j < pool.length; j += 1) {
      allowed.add(pool[i] + pool[j]);
      for (let k = j; k < pool.length; k += 1) allowed.add(pool[i] + pool[j] + pool[k]);
    }
  }

  const mentioned = replyText.match(/(?:rp\.?\s*)([0-9][0-9.]*)/gi) ?? [];
  const unbacked: string[] = [];

  for (const raw of mentioned) {
    const digits = raw.replace(/[^0-9]/g, "");
    if (!digits) continue;
    const n = parseInt(digits, 10);
    // 3-digit numbers are unique codes; <= 100 are quantities/percentages.
    if (n <= 100) continue;
    if (n >= 100 && n <= 999 && !produced.has(String(n))) continue; // unique code range
    if (allowed.has(n)) continue; // literal value OR honest sum of backed values
    unbacked.push(raw.trim());
  }

  return unbacked;
}

/**
 * Chapter 8.C.1 / 16: the model may only echo the account number the store owner
 * saved in the dashboard. Any other long digit run in the reply (>= 10 digits,
 * excluding numbers that actually came out of a tool call) is treated as an
 * invented payment destination and blocks the reply.
 */
export function findUnbackedAccountNumbers(
  replyText: string,
  toolOutcomes: ToolExecutionResult[],
  payment: ToolContext["payment"]
): string[] {
  const bankDigits = (payment.bankAccountNumber || "").replace(/\D/g, "");
  const toolHaystack = JSON.stringify(toolOutcomes);
  const toolDigits = toolHaystack.replace(/\D/g, "");

  // Strip URLs so photo/video/web URLs with long numeric IDs are not misidentified as bank accounts.
  const textWithoutUrls = replyText.replace(/https?:\/\/[^\s]+/gi, "");
  const candidates = textWithoutUrls.match(/[0-9][0-9\-\s]{8,}[0-9]/g) ?? [];
  const unbacked: string[] = [];

  for (const raw of candidates) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 10) continue;
    if (bankDigits && bankDigits.includes(digits)) continue;
    if (toolHaystack.includes(digits) || toolDigits.includes(digits)) continue;
    unbacked.push(raw.trim());
  }

  return unbacked;
}

/**
 * Strips model thinking/reasoning blocks and artifact headers from the raw reply,
 * ensuring WhatsApp buyers and store owners receive pure, clean answer text.
 */
export function sanitizeAgentReply(raw: string): string {
  if (!raw) return "";
  let text = raw;

  // 1. Remove paired think tags
  text = text.replace(/<think>[\s\S]*?<\/think>\s*/gi, "");
  // 2. Remove unclosed opening think tag
  text = text.replace(/<think>[\s\S]*$/gi, "");
  // 3. Remove orphaned closing think tag and everything preceding it
  text = text.replace(/^[\s\S]*?<\/think>\s*/gi, "");
  // 4. Remove paired or orphaned [thinking] tags
  text = text.replace(
    /\[(?:thinking|reasoning|pikirkan|analisis)\][\s\S]*?\[\/(?:thinking|reasoning|pikirkan|analisis)\]\s*/gi,
    ""
  );
  text = text.replace(/\[(?:thinking|reasoning|pikirkan|analisis)\][\s\S]*$/gi, "");
  text = text.replace(/^[\s\S]*?\[\/(?:thinking|reasoning|pikirkan|analisis)\]\s*/gi, "");
  // 5. Clean any leftover think tags
  text = text.replace(/<\/?think>/gi, "");

  // 6. Remove echoed <pesan_pembeli> blocks if model leaked them
  text = text.replace(/<pesan_pembeli>[\s\S]*?<\/pesan_pembeli>/gi, "");
  text = text.replace(/<\/?pesan_pembeli>/gi, "");

  // 7. Remove any leaked system or prompt delimiter blocks and leftover tags
  text = text.replace(/<(?:system|instruction|prompt|context|aturan_toko|developer_prompt)>[\s\S]*?<\/(?:system|instruction|prompt|context|aturan_toko|developer_prompt)>\s*/gi, "");
  text = text.replace(/<\/?(?:system|instruction|prompt|context|aturan_toko|developer_prompt)>/gi, "");

  // 8. Remove [JID pembeli: ...] lines if model leaked them
  text = text.replace(/\[JID pembeli:[^\]]*\]/gi, "");
  text = text.replace(/\[Konteks Gambar Produk[^\]]*\]/gi, "");
  text = text.replace(/\[Lokasi pembeli[^\]]*\]/gi, "");

  // 9. Remove leading artifact tags like [JAWABAN], [BALASAN], [RESPONSE], [ANSWER], [CHAT], [CS], etc.
  text = text.replace(/^\s*\[(?:jawaban|balasan|response|answer|chat|cs|pesan|draft)\]\s*:?\s*/i, "");

  // 10. Remove standalone [JAWABAN] or [BALASAN] anywhere if left behind
  text = text.replace(/\[(?:jawaban|balasan|response|answer|chat)\]/gi, "");

  // 11. Remove leaked prefix roles: "CS: ", "Admin: ", "Bot: ", "Assistant: "
  text = text.replace(/^(?:CS|Admin CS|Admin|Bot|Assistant|Asisten)\s*:\s*/i, "");

  // 12. Strip accidental markdown codeblock wrapper if whole message was wrapped in ``` ... ```
  if (/^```(?:markdown|text|json)?\s*[\s\S]*?```$/i.test(text.trim())) {
    text = text.trim().replace(/^```(?:markdown|text|json)?\s*/i, "").replace(/\s*```$/, "");
  }

  // 13. Strip accidental raw JSON string wrapper: {"reply": "..."} or {"message": "..."}
  if (text.trim().startsWith("{") && text.trim().endsWith("}")) {
    try {
      const parsed = JSON.parse(text.trim());
      if (typeof parsed?.reply === "string") text = parsed.reply;
      else if (typeof parsed?.message === "string") text = parsed.message;
      else if (typeof parsed?.content === "string") text = parsed.content;
    } catch {
      // ignore
    }
  }

  // 14. Remove accidental leaked CoT / internal monologue sentences (e.g. "Sekarang saya perlu mencari...")
  text = text.replace(/(?:Sekarang,?\s+)?saya\s+(?:perlu|harus|akan)\s+(?:mencari|mengecek|memanggil|menggunakan)[\s\S]*?(?:tool_[a-z_]+)[\s\S]*?\.\s*/gi, "");

  // 15. Normalize robotic AI self-identifications to natural human CS phrasing
  text = text.replace(/\bsebagai\s+(?:ai|kecerdasan buatan|model bahasa|llm|asisten virtual|bot)\b[,\s]*/gi, "sebagai tim CS toko, ");

  // 16. Replace em-dash and en-dash with standard comma or hyphen
  text = text.replace(/[\u2014\u2013]/g, ", ");

  return text.trim();
}

export type OrchestratorInput = {
  ctx: ToolContext;
  businessName: string;
  catalogSource: "sheet" | "cache";
  catalogWarning?: string;
  history: { role: "user" | "assistant"; content: string }[];
  incomingText: string;
  botName?: string;
  botTone?: string;
  customPersonaPrompt?: string;
};

/**
 * Runs the bounded tool-calling loop and returns the final reply plus every side
 * effect the tools produced (media to send, escalation).
 */
export async function runAgent(input: OrchestratorInput): Promise<OrchestratorResult> {
  const started = Date.now();
  const toolOutcomes: ToolExecutionResult[] = [];
  const media: OutboundMedia[] = [];
  let escalated = false;
  let modelUsed = env.AI_MODEL;
  let degraded = false;
  let degradationReason: string | undefined;

  const knowledgeBaseContext = await getActiveKnowledgeText(input.ctx.tenantId).catch(() => "");

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: buildSystemPrompt({
        businessName: input.businessName,
        originSubdistrict: input.ctx.originSubdistrict,
        catalogSource: input.catalogSource,
        catalogWarning: input.catalogWarning,
        knowledgeBaseContext,
        botName: input.botName,
        botTone: input.botTone,
        customPersonaPrompt: input.customPersonaPrompt,
        buyerJid: input.ctx.buyerJid,
        promoRules: input.ctx.promoRules,
        voucherRules: input.ctx.voucherRules,
        shippingSchedule: input.ctx.shippingSchedule,
        freeShipping: input.ctx.freeShipping,
        isFirstMessage: (input.history?.length ?? 0) === 0,
      }),
    },
    // History is already windowed by the query in handleInboundMessage
    // (`take: MAX_HISTORY_MESSAGES`), so it is replayed as-is.
    ...input.history.map<ChatCompletionMessageParam>((m) => ({
      role: m.role,
      content: m.role === "user" ? fenceUntrusted(m.content) : m.content,
    })),
    {
      role: "user",
      content: fenceUntrusted(input.incomingText),
    },
  ];

  let toolCallCounter = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    let msg: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } | undefined;
    let gatewayErr: unknown = null;

    // Model fallback: a gateway upstream can answer 200 with empty content
    // ("in_progress"). Walk the chain until one model returns content or tools.
    for (const model of modelChain()) {
      try {
        const completion = await client.chat.completions.create({
          model,
          messages,
          tools: TOOL_SCHEMAS,
          tool_choice: "auto",
          temperature: 0.3,
          max_tokens: 900,
          // CRITICAL: the routed upstream rejects a turn that asks for more than one
          // tool at a time (400 "This model only supports single tool-calls at
          // once!"). Without this flag the reply degrades intermittently whenever
          // the model decides to batch its calls.
          ...TOOL_REQUEST_DEFAULTS,
        });

        modelUsed = completion.model || model;
        const candidate = completion.choices[0]?.message;
        const hasToolCalls = (candidate?.tool_calls?.length ?? 0) > 0;
        const hasContent = Boolean(candidate?.content && candidate.content.trim());

        if (candidate && (hasToolCalls || hasContent)) {
          msg = candidate;
          break;
        }
        // Empty upstream answer -> try the next model.
      } catch (err) {
        gatewayErr = err;
        // A model that refuses batched tool calls will refuse again; move on to
        // the next model instead of burning the retry budget on the same one.
        if (isSingleToolCallError(err)) continue;
      }
    }

    if (!msg) {
      degraded = true;
      degradationReason =
        gatewayErr instanceof Error
          ? `AI gateway error: ${gatewayErr.message}`
          : "AI gateway returned an empty response from every model";
      break;
    }

    // The routed upstream (9router -> combo-ai/combo-free) accepts at most ONE
    // tool call per assistant turn. `parallel_tool_calls: false` is advisory: the
    // upstream can still emit a batch, and a history containing a batched
    // assistant turn is then rejected on EVERY later turn, including the final
    // composition turn that sends no tools at all (400 "This model only supports
    // single tool-calls at once!"). So the history we build is forced to one call
    // per round; any remaining calls the model asked for are offered again on the
    // next round, which MAX_TOOL_ROUNDS covers.
    const requested = (msg.tool_calls ?? []).slice(0, 1).map((tc) => {
      const clean = (tc.id || "").replace(/[^a-zA-Z0-9]/g, "");
      const idxStr = String(toolCallCounter++).padStart(3, "0");
      const prefix = clean.slice(-6).padStart(6, "c");
      const safeId = (prefix + idxStr).slice(-9);
      return { ...tc, id: safeId };
    });

    if (requested.length === 0) {
      const rawContent = msg.content ?? "";
      const isDangling =
        round < 2 &&
        /(?:(?:saya|kami)\s+(?:bantu\s+)?(?:cekkan|cek|lihat|periksa|hitung|carikan)\s*(?:dulu|sebentar|stok|ongkir)?|(?:tunggu|mohon tunggu|sebentar|bentar)\s*(?:sebentar|dulu|ya\s+kak|kak)|sedang\s+(?:kami|saya)\s+(?:cek|hitung))/i.test(
          rawContent
        ) &&
        !rawContent.includes("Rp");

      if (isDangling) {
        messages.push({
          role: "assistant",
          content: rawContent,
        });
        const wantsCheckout = /(?:ongkir|kirim|tujuan|kecamatan|kabupaten|kota|total|rekening|checkout|bungkus|bayar)/i.test(
          input.incomingText
        );
        messages.push({
          role: "user",
          content: wantsCheckout
            ? "Jangan menunda atau membalas menggantung. Tolong langsung panggil tool_cek_ongkir dan/atau tool_cari_produk sekarang juga dan berikan rincian harga, ongkir, serta total yang harus dibayar kepada pembeli."
            : "Jangan menunda atau membalas menggantung. Jawab langsung pertanyaan pembeli secara ramah dan to the point tanpa kalimat penundaan.",
        });
        continue;
      }

      messages.push({
        role: "assistant",
        content: rawContent,
      });
      break;
    }

    messages.push({
      role: "assistant",
      content: msg.content || "",
      tool_calls: requested.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      })),
    });

    for (const call of requested) {
      if (toolOutcomes.length >= MAX_TOOL_CALLS_PER_TURN) break;

      const name = call.function.name;
      let args: Record<string, unknown> = {};

      try {
        args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        args = {};
      }

      if (!isKnownTool(name)) {
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ error: `Tool ${name} tidak tersedia` }),
        });
        continue;
      }

      const outcome = await executeTool(name, input.ctx, args);
      toolOutcomes.push(outcome);
      media.push(...outcome.media);
      if (outcome.escalated) escalated = true;

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(outcome.toolPayload).slice(0, 4000),
      });
    }

    if (toolOutcomes.length >= MAX_TOOL_CALLS_PER_TURN) {
      // Insert next to the leading system prompt, never appended at the tail: a
      // system message placed after an assistant/tool turn is rejected by strict
      // OpenAI-compatible upstreams (400 "Unexpected role 'system' after role
      // 'assistant'").
      messages.splice(1, 0, {
        role: "system",
        content:
          "Batas pemanggilan tool tercapai. Susun balasan final untuk pembeli SEKARANG tanpa memanggil tool lagi, berdasarkan data yang sudah ada.",
      });
    }
  }

  let replyText = "";

  // 1. Check if the loop already produced a final assistant answer
  const lastMsg = messages[messages.length - 1];
  if (lastMsg && lastMsg.role === "assistant" && typeof lastMsg.content === "string" && lastMsg.content.trim()) {
    replyText = lastMsg.content;
  }

  const isDangling =
    /(?:(?:saya|kami)\s+(?:bantu\s+)?(?:cekkan|cek|lihat|periksa|hitung|carikan)\s*(?:dulu|sebentar|stok|ongkir)?|(?:tunggu|mohon tunggu|sebentar|bentar)\s*(?:sebentar|dulu|ya\s+kak|kak)|sedang\s+(?:kami|saya)\s+(?:cek|hitung))/i.test(
      replyText
    ) && !replyText.includes("Rp");
  if (isDangling && toolOutcomes.length > 0) {
    replyText = "";
  }

  // 2. If tools were executed but no final text reply was produced, run composition turn
  if (!replyText && toolOutcomes.length > 0) {
    const finalMessages: ChatCompletionMessageParam[] = [
      ...messages.slice(0, 1),
      {
        role: "system",
        content:
          "Susun balasan final untuk pembeli. Jangan memanggil tool lagi. Jangan menyebut harga/stok yang tidak ada di data tool di atas.",
      },
      ...messages.slice(1).filter((m) => m.role !== "assistant" || (m.role === "assistant" && m.tool_calls)),
    ];

    try {
      const { content: composed, model: composedModel } = await chatWithFallback({
        messages: finalMessages,
        temperature: 0.3,
        max_tokens: 900,
      });
      replyText = composed;
      if (composedModel) modelUsed = composedModel;
    } catch (err) {
      degraded = true;
      degradationReason =
        err instanceof Error ? `Final composition failed: ${err.message}` : "Final composition failed";
    }
  }

  replyText = sanitizeAgentReply(replyText);

  if (!replyText) {
    replyText = degraded ? SAFE_FALLBACK_REPLY : "Baik Kak, saya catat dulu ya 🙏";
  }

  const catalogAndHistoryPrices: number[] = [];
  (input.history ?? []).forEach((h) => {
    const matches = h.content.match(/(?:rp\.?\s*)([0-9][0-9.]*)/gi) ?? [];
    matches.forEach((m) => {
      const num = parseInt(m.replace(/[^0-9]/g, ""), 10);
      if (num > 100) catalogAndHistoryPrices.push(num);
    });
  });
  (input.ctx.catalog ?? []).forEach((item) => {
    if (item.price > 0) catalogAndHistoryPrices.push(item.price);
  });
  if (input.ctx.freeShipping?.minAmount && input.ctx.freeShipping.minAmount > 0) {
    catalogAndHistoryPrices.push(input.ctx.freeShipping.minAmount);
  }
  if (input.ctx.shippingSchedule?.free_shipping_min_amount && input.ctx.shippingSchedule.free_shipping_min_amount > 0) {
    catalogAndHistoryPrices.push(input.ctx.shippingSchedule.free_shipping_min_amount);
  }
  (input.ctx.voucherRules ?? []).forEach((v) => {
    if (v.discount_amount && v.discount_amount > 0) catalogAndHistoryPrices.push(v.discount_amount);
  });

  const unbacked = findUnbackedPrices(replyText, toolOutcomes, catalogAndHistoryPrices);
  if (unbacked.length > 0) {
    degraded = true;
    degradationReason = `Blocked unbacked price(s) in reply: ${unbacked.join(", ")}`;
    replyText = SAFE_FALLBACK_REPLY;
  }

  // Chapter 8.C.1: never let an invented account number reach the buyer.
  const unbackedAccounts = findUnbackedAccountNumbers(replyText, toolOutcomes, input.ctx.payment);
  if (unbackedAccounts.length > 0) {
    degraded = true;
    degradationReason = `Blocked unbacked account number(s) in reply: ${unbackedAccounts.length} match(es)`;
    replyText = SAFE_FALLBACK_REPLY;
    escalated = true;
  }

  return {
    replyText,
    toolOutcomes,
    media,
    escalated,
    model: modelUsed,
    latencyMs: Date.now() - started,
    toolCalls: toolOutcomes.length,
    degraded,
    degradationReason,
  };
}

export type InboundParams = {
  tenantId: string;
  buyerJid: string;
  buyerName: string | null;
  incomingText: string;
  instanceKey: string | null;
  catalog: ProductRow[];
  catalogSource: "sheet" | "cache";
  catalogWarning?: string;
  /** When false the caller only wants a dry preview (playground, no persistence). */
  persist?: boolean;
};

/**
 * Loads tenant context, resolves the conversation, cancels stale nudges, runs the
 * agent and persists the exchange.
 */
export async function handleInboundMessage(params: InboundParams): Promise<HandleInboundResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: params.tenantId },
    include: { catalog_settings: true },
  });

  if (!tenant) {
    throw new Error(`Tenant ${params.tenantId} not found`);
  }

  const settings = tenant.catalog_settings;

  const conversation = await prisma.conversation.upsert({
    where: {
      tenant_id_buyer_jid: { tenant_id: params.tenantId, buyer_jid: params.buyerJid },
    },
    create: {
      tenant_id: params.tenantId,
      buyer_jid: params.buyerJid,
      buyer_name: params.buyerName,
      pipeline_stage: "INQUIRY",
      last_interaction: new Date(),
    },
    update: {
      last_interaction: new Date(),
      ...(params.buyerName ? { buyer_name: params.buyerName } : {}),
    },
  });

  const promoRules = Array.isArray(settings?.promo_rules)
    ? (settings.promo_rules as unknown as TenantPromoTier[])
    : undefined;
  const voucherRules = Array.isArray(settings?.voucher_rules)
    ? (settings.voucher_rules as unknown as TenantVoucher[])
    : undefined;
  const shippingSchedule: TenantShippingSchedule = {
    cut_off_hour: settings?.shipping_cut_off_hour ?? 15,
    open_hour: settings?.shipping_open_hour ?? 8,
    close_hour: settings?.shipping_close_hour ?? 21,
    free_shipping_enabled: settings?.free_shipping_enabled ?? false,
    free_shipping_min_amount: settings?.free_shipping_min_amount ? Number(settings.free_shipping_min_amount) : 200000,
  };

  const freeShipping = {
    enabled: settings?.free_shipping_enabled ?? false,
    minAmount: settings?.free_shipping_min_amount ? Number(settings.free_shipping_min_amount) : 200000,
  };

  const ctx: ToolContext = {
    tenantId: params.tenantId,
    conversationId: conversation.id,
    buyerJid: params.buyerJid,
    buyerName: params.buyerName,
    instanceKey: params.instanceKey,
    originSubdistrict: settings?.origin_subdistrict ?? "Jakarta Selatan",
    nudgeDelayMinutes: settings?.nudge_delay_minutes ?? 120,
    catalog: params.catalog,
    catalogSource: params.catalogSource,
    payment: {
      bankName: settings?.bank_name ?? "",
      bankAccountNumber: settings?.bank_account_number ?? "",
      bankAccountHolder: settings?.bank_account_holder ?? "",
      qrisUrl: settings?.qris_object_key ? publicUrlFor(settings.qris_object_key) : null,
    },
    promoRules,
    voucherRules,
    shippingSchedule,
    freeShipping,
  };

  const persist = params.persist ?? true;

  // Chapter 14.3: the buyer is back, so cancel the pending follow-up.
  if (persist) {
    await cancelPendingNudges(conversation.id);
  }

  // Chapter 2.4 / acceptance criteria: honour human takeover and the store kill switch.
  if (conversation.is_human_takeover) {
    if (persist) {
      await prisma.chatMessage.create({
        data: {
          conversation_id: conversation.id,
          sender_type: "BUYER",
          message_type: "TEXT",
          content: params.incomingText,
        },
      });
    }
    return {
      conversationId: conversation.id,
      buyerJid: params.buyerJid,
      catalogSource: params.catalogSource,
      catalogWarning: params.catalogWarning,
      botMuted: true,
      botMutedReason: "human_takeover",
      persisted: persist,
      replyText: "",
      toolOutcomes: [],
      media: [],
      escalated: false,
      model: env.AI_MODEL,
      latencyMs: 0,
      toolCalls: 0,
      degraded: false,
    };
  }

  if (settings && !settings.auto_reply_enabled) {
    return {
      conversationId: conversation.id,
      buyerJid: params.buyerJid,
      catalogSource: params.catalogSource,
      catalogWarning: params.catalogWarning,
      botMuted: true,
      botMutedReason: "auto_reply_disabled",
      persisted: persist,
      replyText: "",
      toolOutcomes: [],
      media: [],
      escalated: false,
      model: env.AI_MODEL,
      latencyMs: 0,
      toolCalls: 0,
      degraded: false,
    };
  }

  const historyRows = await prisma.chatMessage.findMany({
    where: {
      conversation_id: conversation.id,
      message_type: { in: ["TEXT", "IMAGE"] },
      sender_type: { in: ["BUYER", "BOT", "HUMAN_AGENT"] },
    },
    orderBy: { created_at: "desc" },
    take: MAX_HISTORY_MESSAGES,
    select: { sender_type: true, content: true },
  });

  const history = historyRows
    .reverse()
    .map((m) => ({
      role: m.sender_type === "BUYER" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));

  if (persist) {
    await prisma.chatMessage.create({
      data: {
        conversation_id: conversation.id,
        sender_type: "BUYER",
        message_type: "TEXT",
        content: params.incomingText,
      },
    });
  }

  const result = await runAgent({
    ctx,
    businessName: tenant.business_name,
    catalogSource: params.catalogSource,
    catalogWarning: params.catalogWarning,
    history,
    incomingText: params.incomingText,
    botName: settings?.bot_name ?? "Admin CS",
    botTone: settings?.bot_tone ?? "RAMAH",
    customPersonaPrompt: settings?.custom_persona_prompt ?? "",
  });

  if (persist) {
    if (result.replyText) {
      await prisma.chatMessage.create({
        data: {
          conversation_id: conversation.id,
          sender_type: "BOT",
          message_type: "TEXT",
          content: result.replyText,
        },
      });
    }

    for (const m of result.media) {
      await prisma.chatMessage.create({
        data: {
          conversation_id: conversation.id,
          sender_type: "BOT",
          message_type: m.kind === "video" ? "VIDEO" : "IMAGE",
          content: m.caption ?? "",
          media_url: m.url,
        },
      });
    }

    await recordToolTraces(conversation.id, result.toolOutcomes);

    if (result.toolOutcomes.some((o) => o.tool === "tool_atur_nudge")) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { pipeline_stage: "QUOTED" },
      });
    }
  }

  return {
    ...result,
    conversationId: conversation.id,
    buyerJid: params.buyerJid,
    catalogSource: params.catalogSource,
    catalogWarning: params.catalogWarning,
    botMuted: false,
    persisted: persist,
  };
}

/** Verifies the gateway is reachable and lists the models it advertises. */
export async function gatewayHealth(): Promise<{
  ok: boolean;
  models: string[];
  latencyMs: number;
  error?: string;
}> {
  const started = Date.now();
  try {
    const res = await client.models.list();
    const models = (res.data ?? []).map((m) => m.id);
    return { ok: true, models, latencyMs: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      models: [],
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : "unknown error",
    };
  }
}

/**
 * Resolves (creating when missing) the conversation row for a buyer, without
 * running the agent. Used by the inbound media pipeline so a buyer's FIRST
 * message can already carry a valid `conversation_id`: the column is a UUID with
 * a foreign key, so an empty string aborts the insert and the media is lost.
 */
export async function ensureConversation(params: {
  tenantId: string;
  buyerJid: string;
  buyerName?: string | null;
}): Promise<string> {
  const conversation = await prisma.conversation.upsert({
    where: {
      tenant_id_buyer_jid: { tenant_id: params.tenantId, buyer_jid: params.buyerJid },
    },
    create: {
      tenant_id: params.tenantId,
      buyer_jid: params.buyerJid,
      buyer_name: params.buyerName ?? null,
      pipeline_stage: "INQUIRY",
      last_interaction: new Date(),
    },
    update: {
      last_interaction: new Date(),
      ...(params.buyerName ? { buyer_name: params.buyerName } : {}),
    },
    select: { id: true },
  });
  return conversation.id;
}
