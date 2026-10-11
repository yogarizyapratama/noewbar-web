/**
 * Shared 9router AI-gateway client with model fallback.
 *
 * A gateway upstream can be unhealthy in a way that still returns HTTP 200, and
 * e.g. "finish_reason": "in_progress" with empty content. A single hard-coded
 * model therefore makes the whole platform mute. This helper keeps one client
 * and retries the same request against AI_FALLBACK_MODELS, returning the first
 * non-empty completion.
 */

import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { env } from "@/lib/env";

export const aiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.AI_API_KEY || env.AI_API_KEY || "not-set",
  baseURL: env.AI_GATEWAY_URL,
  timeout: 45_000,
  maxRetries: 1,
});

/**
 * Default request options that every tool-calling request must carry.
 *
 * `parallel_tool_calls: false` is REQUIRED, not cosmetic: the routed upstream
 * (9router -> combo-ai/combo-free) rejects a turn that requests more than one
 * tool at a time with `400 "This model only supports single tool-calls at
 * once!"`. Without this flag the whole reply degrades to the safe fallback
 * intermittently, depending on whether the model chooses to batch its calls.
 */
export const TOOL_REQUEST_DEFAULTS = {
  parallel_tool_calls: false,
} as const;

/** Ordered, de-duplicated list of models to try: primary first, then fallbacks. */
export function modelChain(): string[] {
  const extra = env.AI_FALLBACK_MODELS.split(",").map((m) => m.trim()).filter(Boolean);
  return [...new Set([env.AI_MODEL, ...extra])];
}

export type GatewayResult = {
  content: string;
  model: string;
  /** Models that returned empty content before the winning one, in order. */
  skipped: string[];
};

/**
 * Chat completion with model fallback. Tries each model in the chain until one
 * returns non-empty content. Throws only if every model fails (network error or
 * all-empty), so callers keep their own try/catch for the last resort.
 */
export async function chatWithFallback(
  body: Omit<Parameters<typeof aiClient.chat.completions.create>[0], "model">
): Promise<GatewayResult> {
  const skipped: string[] = [];
  let lastErr: unknown = null;

  for (const model of modelChain()) {
    try {
      const completion = await aiClient.chat.completions.create({
        ...TOOL_REQUEST_DEFAULTS,
        ...body,
        model,
      } as Parameters<typeof aiClient.chat.completions.create>[0]);

      // Non-streaming shape.
      const choice = (completion as { choices?: { message?: { content?: string | null } }[] }).choices?.[0];
      const content = choice?.message?.content?.trim() ?? "";
      if (content) return { content, model, skipped };

      skipped.push(model);
    } catch (err) {
      lastErr = err;
      skipped.push(model);
    }
  }

  if (lastErr) throw lastErr;
  return { content: "", model: skipped[skipped.length - 1] ?? env.AI_MODEL, skipped };
}

export type { ChatCompletionMessageParam };
