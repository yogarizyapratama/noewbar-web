import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import prisma from "@/lib/prisma";
import { env } from "@/lib/env";
import { TOOL_SCHEMAS, executeTool } from "@/lib/ai/micro-tools";
import { buildSystemPrompt, fenceUntrusted, MAX_HISTORY_MESSAGES, MAX_TOOL_ROUNDS, SAFE_FALLBACK_REPLY } from "@/lib/ai/prompts";
import { recordToolTraces } from "@/lib/ai/micro-tools";
import type {
  OutboundMedia,
  ProductRow,
  ToolContext,
  ToolExecutionResult,
  ToolName,
} from "@/lib/ai/types";
import { TOOL_NAMES } from "@/lib/ai/types";
import { cancelPendingNudges } from "@/lib/queue/nudge-queue";
import { modelChain, chatWithFallback, TOOL_REQUEST_DEFAULTS } from "@/lib/ai/gateway";
import { publicUrlFor } from "@/lib/storage/minio";
import { getActiveKnowledgeText } from "@/lib/knowledge/knowledge-store";

/**
 * AI orchestrator (chapter 6).
 *
 * Single contract endpoint: the whole platform talks to one model id (`combo-ai`)
 * on the self-hosted 9router gateway. Model rotation, key cycling and upstream
 * fallback all happen inside 9router, so this code never changes when the pool does.
 */

const client = new OpenAI({
  apiKey: env.AI_API_KEY || "not-set",
  baseURL: env.AI_GATEWAY_URL,
  timeout: 45_000,
  maxRetries: 1,
});

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
export function findUnbackedPrices(replyText: string, toolOutcomes: ToolExecutionResult[]): string[] {
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
  const candidates = replyText.match(/[0-9][0-9\-\s]{8,}[0-9]/g) ?? [];
  const unbacked: string[] = [];

  for (const raw of candidates) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 10) continue;
    if (bankDigits && bankDigits.includes(digits)) continue;
    if (toolHaystack.includes(digits)) continue;
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

  // 1. Remove closed and unclosed <think> blocks
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  text = text.replace(/<think>[\s\S]*$/gi, "");

  // 2. Remove [THINKING]...[/THINKING] or [REASONING] blocks
  text = text.replace(
    /\[(?:thinking|reasoning|pikirkan|analisis)\][\s\S]*?\[\/(?:thinking|reasoning|pikirkan|analisis)\]/gi,
    ""
  );
  text = text.replace(/\[(?:thinking|reasoning|pikirkan|analisis)\][\s\S]*$/gi, "");

  // 3. Remove leading artifact tags like [JAWABAN], [BALASAN], [RESPONSE], [ANSWER], [CHAT], etc.
  text = text.replace(/^\s*\[(?:jawaban|balasan|response|answer|chat|cs|pesan)\]\s*:?\s*/i, "");

  // 4. Remove standalone [JAWABAN] or [BALASAN] anywhere if left behind
  text = text.replace(/\[(?:jawaban|balasan|response|answer)\]/gi, "");

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
      }),
    },
    // History is already windowed by the query in handleInboundMessage
    // (`take: MAX_HISTORY_MESSAGES`), so it is replayed as-is.
    ...input.history.map<ChatCompletionMessageParam>((m) => ({
      role: m.role,
      content: m.content,
    })),
    {
      role: "user",
      content: `${fenceUntrusted(input.incomingText)}\n\n[JID pembeli: ${input.ctx.buyerJid}]`,
    },
  ];

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
          temperature: 0.4,
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
    const requested = (msg.tool_calls ?? []).slice(0, 1);

    if (requested.length === 0) {
      messages.push({
        role: "assistant",
        content: msg.content ?? "",
      });
      break;
    }

    messages.push({
      role: "assistant",
      content: msg.content ?? null,
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

  // Final composition turn: force a plain text answer with the data already gathered.
  // The directive rides with the leading system prompt for the same reason as above.
  const finalMessages: ChatCompletionMessageParam[] = [
    ...messages.slice(0, 1),
    {
      role: "system",
      content:
        "Susun balasan final untuk pembeli. Jangan memanggil tool lagi. Jangan menyebut harga/stok yang tidak ada di data tool di atas.",
    },
    ...messages.slice(1),
  ];

  try {
    const { content: composed, model: composedModel } = await chatWithFallback({
      messages: finalMessages,
      temperature: 0.4,
      max_tokens: 900,
    });
    replyText = composed;
    if (composedModel) modelUsed = composedModel;
  } catch (err) {
    degraded = true;
    degradationReason =
      err instanceof Error ? `Final composition failed: ${err.message}` : "Final composition failed";
  }

  replyText = sanitizeAgentReply(replyText);

  if (!replyText) {
    replyText = degraded ? SAFE_FALLBACK_REPLY : "Baik Kak, saya catat dulu ya 🙏";
  }

  const unbacked = findUnbackedPrices(replyText, toolOutcomes);
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
