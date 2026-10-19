import { env } from "@/lib/env";

/**
 * Emergency alert dispatcher (chapter 2.4, dual channel).
 *
 * WhatsApp personal alert is mandatory; Telegram is optional. Both calls are
 * best-effort and never throw: an alert failure must not break the buyer reply.
 */

export type AlertChannelResult = { channel: "whatsapp" | "telegram"; delivered: boolean; error?: string };

export type AlertPayload = {
  title: string;
  lines: string[];
};

export function formatAlert(payload: AlertPayload): string {
  return [`*${payload.title}*`, "", ...payload.lines].join("\n");
}

export async function sendTelegramAlert(
  text: string,
  chatIdOverride?: string | null
): Promise<AlertChannelResult> {
  const chatId = (chatIdOverride || env.TELEGRAM_ADMIN_CHAT_ID || "").trim();
  const token = env.TELEGRAM_BOT_TOKEN.trim();

  if (!token || !chatId) {
    return { channel: "telegram", delivered: false, error: "Telegram not configured" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    let res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
      cache: "no-store",
    });

    let json = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;

    // Fallback: If Markdown parsing fails due to unescaped characters, retry as plain text
    if (!res.ok && json?.description?.toLowerCase().includes("parse entities")) {
      res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        }),
        cache: "no-store",
      });
      json = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    }

    if (!res.ok || !json?.ok) {
      return {
        channel: "telegram",
        delivered: false,
        error: json?.description ?? `HTTP ${res.status}`,
      };
    }
    return { channel: "telegram", delivered: true };
  } catch (err) {
    return {
      channel: "telegram",
      delivered: false,
      error: err instanceof Error ? err.message : "unknown error",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Verifies the bot token and returns the bot identity. Used by the superadmin
 * console health panel so the operator sees a real reachability result.
 */
export async function telegramHealth(): Promise<{ ok: boolean; username?: string; error?: string }> {
  const token = env.TELEGRAM_BOT_TOKEN.trim();
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN not set" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: controller.signal,
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as
      | { ok?: boolean; result?: { username?: string }; description?: string }
      | null;

    if (!res.ok || !json?.ok) {
      return { ok: false, error: json?.description ?? `HTTP ${res.status}` };
    }
    return { ok: true, username: json.result?.username };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown error" };
  } finally {
    clearTimeout(timer);
  }
}
