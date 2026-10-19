/**
 * Inbound media pipeline (chapter 8.B + 8.C.4).
 *
 * The daemon downloads WhatsApp media to a transient local file and forwards
 * `media_url`. This module pulls that file (secret-gated), uploads it into the
 * tenant's MinIO space, records a CHAT_MESSAGES row, and emits a realtime
 * event so the owner's dashboard updates instantly.
 *
 * For proof images the caller triggers the AI Vision OCR as supportive insight.
 */

import prisma from "@/lib/prisma";
import { env } from "@/lib/env";
import { uploadObject, publicUrlFor } from "@/lib/storage/minio";
import { notifyTenant } from "@/lib/realtime/event-bus";
import { safeFetchWithSecret } from "@/lib/wa/daemon-client";

export type IngestedMedia = {
  ok: boolean;
  mediaUrl?: string;
  mediaKey?: string;
  messageType?: string;
  /** The conversation the message was recorded under (created on demand). */
  conversationId?: string;
  /** Raw bytes + mime, so callers can feed the AI inline (no server-side fetch). */
  bytes?: Uint8Array;
  mime?: string;
  error?: string;
};

/**
 * Pull an inbound media file from the daemon and store it under the tenant's
 * MinIO namespace. Returns the public URL for storage + chat display.
 */
export async function ingestInboundMedia(params: {
  tenantId: string;
  instanceKey: string;
  conversationId: string | null;
  senderJid: string;
  senderName: string | null;
  daemonMediaUrl: string;
  kind: "image" | "video" | "document" | "audio";
  caption?: string;
  messageId?: string;
}): Promise<IngestedMedia> {
  try {
    // 1. Validate URL strictly targets the internal Whatsmeow daemon to avoid leaking secret or SSRF.
    const daemonBase = env.WHATSMEOW_URL.replace(/\/$/, "");
    const targetUrl = params.daemonMediaUrl.startsWith("/")
      ? `${daemonBase}${params.daemonMediaUrl}`
      : params.daemonMediaUrl;

    if (!targetUrl.startsWith(daemonBase)) {
      return { ok: false, error: "daemon media URL tidak valid / tidak terpercaya" };
    }

    const bytes = await safeFetchWithSecret(targetUrl, env.WHATSMEOW_SECRET);
    if (!bytes || bytes.length === 0) {
      return { ok: false, error: "daemon media kosong/tidak terbaca" };
    }

    // 2. Determine an extension from the kind.
    const ext =
      params.kind === "video"
        ? "mp4"
        : params.kind === "document"
          ? "pdf"
          : params.kind === "audio"
            ? "ogg"
            : "jpg";
    const mime =
      params.kind === "video"
        ? "video/mp4"
        : params.kind === "document"
          ? "application/pdf"
          : params.kind === "audio"
            ? "audio/ogg"
            : "image/jpeg";
    const id = params.messageId ?? `${Date.now()}`;
    const key = `tenants/${params.tenantId}/inbound/${id}.${ext}`;
    const up = await uploadObject(key, Buffer.from(bytes), mime);
    if (!up.success) return { ok: false, error: "upload MinIO gagal" };

    // 3. Record the message (IMAGE/VIDEO/DOCUMENT/AUDIO) for the conversation view.
    const conversationId = await resolveConversationId({
      tenantId: params.tenantId,
      buyerJid: params.senderJid,
      buyerName: params.senderName,
      existingId: params.conversationId,
    });

    const msg = await prisma.chatMessage.create({
      data: {
        conversation_id: conversationId,
        sender_type: "BUYER",
        message_type:
          params.kind === "video"
            ? "VIDEO"
            : params.kind === "document"
              ? "DOCUMENT"
              : params.kind === "audio"
                ? "AUDIO"
                : "IMAGE",
        content: params.caption ?? (params.kind === "audio" ? "[Pesan Suara]" : "[media]"),
        media_url: publicUrlFor(key),
      },
    });

    // 4. Emit a realtime "chat" event so dashboards refresh that thread.
    if (params.tenantId) {
      notifyTenant(params.tenantId, { type: "chat" });
    }

    return {
      ok: true,
      mediaUrl: publicUrlFor(key),
      mediaKey: key,
      messageType: msg.message_type,
      conversationId,
      bytes,
      mime,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Guarantees a valid conversation UUID for an inbound message. Reuses the
 * caller-supplied id when present, otherwise upserts the conversation row so the
 * chat-message foreign key is always satisfiable.
 */
async function resolveConversationId(params: {
  tenantId: string;
  buyerJid: string;
  buyerName: string | null;
  existingId: string | null;
}): Promise<string> {
  if (params.existingId) return params.existingId;

  const conversation = await prisma.conversation.upsert({
    where: { tenant_id_buyer_jid: { tenant_id: params.tenantId, buyer_jid: params.buyerJid } },
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
    select: { id: true },
  });

  return conversation.id;
}