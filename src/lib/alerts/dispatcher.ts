import prisma from "@/lib/prisma";
import { waDaemon } from "@/lib/wa/daemon-client";
import { sendTelegramAlert, telegramHealth, formatAlert } from "@/lib/alerts/telegram";

/**
 * Dual-channel emergency alert dispatcher (chapter 2.4).
 *
 * WhatsApp personal message to the store owner is the mandatory channel, because
 * the shop owner is not required to install Telegram. Telegram is optional.
 * Every channel is best-effort: a failure is reported, never thrown, so the buyer
 * always still gets a reply.
 */

export type DispatchResult = {
  whatsapp: { delivered: boolean; error?: string };
  telegram: { delivered: boolean; error?: string; skipped?: boolean };
};

export type EscalationInput = {
  tenantId: string;
  conversationId: string;
  buyerJid: string;
  buyerName: string | null;
  reason: string;
  summary: string;
  /** Optional extra lines, e.g. the transfer proof block of chapter 8.C.4 */
  detailLines?: string[];
  title?: string;
};

/** Provider-level labels so the operator sees why the hand-over fired. */
export const REASON_LABEL: Record<string, string> = {
  complaint: "Komplain pembeli",
  negotiation: "Negosiasi harga agresif",
  out_of_scope: "Pertanyaan di luar katalog",
  negative_sentiment: "Sentimen negatif terdeteksi",
  prompt_injection: "Upaya prompt injection",
  proof_of_payment: "Bukti transfer perlu diverifikasi manual",
  manual: "Permintaan pemilik toko",
};

function humanReason(reason: string): string {
  return REASON_LABEL[reason] ?? reason;
}

/**
 * Mutes the bot on the conversation, then notifies the owner on every enabled
 * channel. Returns the per-channel delivery outcome.
 */
export async function escalateToOwner(input: EscalationInput): Promise<DispatchResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    include: { catalog_settings: true, wa_instances: true },
  });

  const settings = tenant?.catalog_settings;
  const alertWhatsapp = settings?.alert_whatsapp_enabled ?? true;
  const alertTelegram = settings?.alert_telegram_enabled ?? false;

  // 1. Mute the AI on this conversation (chapter 2.4: bot goes silent).
  if (input.conversationId && input.conversationId !== "00000000-0000-0000-0000-000000000000") {
    await prisma.conversation
      .update({
        where: { id: input.conversationId },
        data: { is_human_takeover: true, pipeline_stage: "ESCALATED" },
      })
      .catch(() => null);
  }

  const lines = [
    `Pembeli: ${input.buyerName ?? "Tanpa nama"} (${input.buyerJid ? input.buyerJid.split("@")[0] : "-"})`,
    `Alasan: ${humanReason(input.reason)}`,
    "",
    `Ringkasan: ${input.summary}`,
    ...(input.detailLines?.length ? ["", ...input.detailLines] : []),
    "",
    "Bot sudah dinonaktifkan untuk pembeli ini. Silakan balas langsung dari WhatsApp Anda.",
  ];

  const ownerText = formatAlert({
    title: input.title ?? "PERLU TINDAKAN MANUAL",
    lines,
  });

  const result: DispatchResult = {
    whatsapp: { delivered: false },
    telegram: { delivered: false, skipped: !alertTelegram },
  };

  // 2a. Mandatory channel: WhatsApp from the store's own connected number.
  if (alertWhatsapp && tenant) {
    const ownerNumber = tenant.owner_whatsapp.replace(/[^0-9]/g, "");
    const instance = tenant.wa_instances.find((i) => i.connection_status === "CONNECTED");

    if (ownerNumber && instance) {
      const send = await waDaemon.sendText({
        instanceKey: instance.instance_key,
        to: ownerNumber,
        message: ownerText,
        simulateTyping: false,
      });
      result.whatsapp = send.ok
        ? { delivered: true }
        : { delivered: false, error: send.error };
    } else {
      result.whatsapp = {
        delivered: false,
        error: !ownerNumber
          ? "owner_whatsapp not set"
          : "no connected WhatsApp instance to send the alert from",
      };
    }
  } else if (!alertWhatsapp) {
    result.whatsapp = { delivered: false, error: "whatsapp alerts disabled for this store" };
  }

  // 2b. Optional channel: Telegram (store-specific chat id, falling back to the
  // platform emergency chat id).
  if (alertTelegram) {
    const tg = await sendTelegramAlert(
      `${ownerText}\n\nToko: ${tenant?.business_name ?? input.tenantId}`,
      tenant?.owner_telegram_chat_id || null
    );
    result.telegram = tg.delivered
      ? { delivered: true }
      : { delivered: false, error: tg.error };
  }

  // 3. Audit record on the tenant timeline.
  if (input.conversationId && input.conversationId !== "00000000-0000-0000-0000-000000000000") {
    await prisma.chatMessage
      .create({
        data: {
          conversation_id: input.conversationId,
          sender_type: "HUMAN_AGENT",
          message_type: "TEXT",
          content: `[ESCALATION] ${humanReason(input.reason)} :: ${input.summary}`,
        },
      })
      .catch(() => null);
  }

  return result;
}

export { telegramHealth };

/** Platform-level emergency alert (superadmin notifications). */
export async function platformAlert(title: string, lines: string[]): Promise<DispatchResult> {
  const tg = await sendTelegramAlert(formatAlert({ title, lines }));
  return {
    whatsapp: { delivered: false, error: "platform alerts use telegram only" },
    telegram: tg.delivered ? { delivered: true } : { delivered: false, error: tg.error },
  };
}
