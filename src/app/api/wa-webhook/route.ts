import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ok, fail, rateLimit } from "@/lib/http";
import { readCatalog } from "@/lib/catalog/sheets";
import { handleInboundMessage } from "@/lib/ai/orchestrator";
import { waDaemon } from "@/lib/wa/daemon-client";
import { isBotDisabled, recordBotSend } from "@/lib/system/killswitch";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { ingestInboundMedia } from "@/lib/media/inbound";
import { analyzeProofMedia } from "@/lib/ai/vision-ocr";
import { analyzeProductInquiryMedia } from "@/lib/ai/vision-product";
import { reverseGeocode } from "@/lib/geo/geocode";
import { notifyTenant } from "@/lib/realtime/event-bus";
import { submitPaymentProof } from "@/lib/orders/orders";

/**
 * Inbound WhatsApp webhook (chapter 4 + chapter 5).
 *
 * Flow: daemon -> this route -> tenant resolution -> catalog -> AI -> reply.
 *
 * Guardrails enforced here (not merely prompted for):
 *   1. Global kill-switch  -> drop immediately.
 *   2. Inbound focus       -> only buyer-initiated messages reach the model
 *                             (the daemon already ignores IsFromMe, and we re-check).
 *   3. Tenant isolation    -> the instance_key must belong to exactly one tenant.
 *   4. Anti-abuse trap     -> >120 sends / 3 min freezes the instance.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const webhookSchema = z.object({
  instance_key: z.string().min(1),
  sender_jid: z.string().min(1),
  sender_name: z.string().optional().default(""),
  body: z.string().optional().default(""),
  timestamp: z.string().optional(),
  /** Opaque id used for webhook idempotency; the daemon supplies message ids. */
  message_id: z.string().optional(),
  /** Inbound media (daemon downloads to /media/<file> and forwards the URL). */
  media_url: z.string().url().optional(),
  media_kind: z.enum(["image", "video", "document"]).optional(),
  media_mime: z.string().optional(),
  media_caption: z.string().optional().default(""),
  /** Share-Location pin (GPS coordinates). */
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  location_name: z.string().optional(),
});

function daemonAuthorized(req: NextRequest): boolean {
  // Fail-closed: when WHATSMEOW_SECRET is unset we refuse instead of accepting
  // everyone. An empty secret is a deployment misconfiguration, so it is better to fail
  // loudly (401) than to expose an unauthenticated webhook that spawns AI replies.
  const provided = req.headers.get("x-noewbar-secret") ?? "";
  if (!env.WHATSMEOW_SECRET) return false;
  return safeEqual(provided, env.WHATSMEOW_SECRET);
}

export async function POST(req: NextRequest) {
  if (!daemonAuthorized(req)) {
    return fail("Unauthorized webhook caller", 401);
  }

  // 1. Global kill-switch.
  if (isBotDisabled()) {
    return ok({ accepted: false, reason: "bot_disabled_globally" });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("Body must be valid JSON", 400);
  }

  const parsed = webhookSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("Invalid webhook payload", 422, parsed.error.issues);
  }

  const payload = parsed.data;

  // Idempotency: the daemon may retry a delivery. A duplicate message id must not
  // produce a second AI reply.
  if (payload.message_id) {
    try {
      await prisma.webhookEvent.create({
        data: {
          provider: "WHATSMEOW",
          event_key: `wa:${payload.message_id}`,
          event_type: "message",
          payload: payload as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return ok({ accepted: false, reason: "duplicate_delivery" });
      }
      throw err;
    }
  }

  // 2. Resolve the tenant that owns this WhatsApp instance.
  const instance = await prisma.waInstance.findUnique({
    where: { instance_key: payload.instance_key },
    include: { tenant: { include: { catalog_settings: true, wa_instances: true } } },
  });

  if (!instance) {
    return fail(`Unknown instance_key ${payload.instance_key}`, 404);
  }

  const tenant = instance.tenant;

  // Suspended / expired tenants do not get bot replies.
  if (tenant.status === "SUSPENDED") {
    return ok({ accepted: false, reason: "tenant_suspended" });
  }

  await prisma.waInstance.update({
    where: { id: instance.id },
    data: { last_seen: new Date(), connection_status: "CONNECTED" },
  });

  // --- Inbound media pipeline (chapter 8.B / 8.C.4): photo/video/document. ---
  // The daemon forwards media_url for downloaded files. We pull it into MinIO,
  // record the chat message, notify the dashboard, and for images run the AI
  // Vision OCR for payment proofs or AI Vision product inquiry for catalog items.
  let visualProductContext: string | null = null;
  if (payload.media_url) {
    const conversation = await prisma.conversation.findUnique({
      where: { tenant_id_buyer_jid: { tenant_id: tenant.id, buyer_jid: payload.sender_jid } },
    });

    const ingest = await ingestInboundMedia({
      tenantId: tenant.id,
      instanceKey: payload.instance_key,
      conversationId: conversation?.id ?? null,
      senderJid: payload.sender_jid,
      senderName: payload.sender_name || null,
      daemonMediaUrl: payload.media_url,
      kind: payload.media_kind === "video" ? "video" : payload.media_kind === "document" ? "document" : "image",
      caption: payload.media_caption,
      messageId: payload.message_id,
    });

    // Proof image: AI OCR as SUPPORTIVE insight only. Bytes are passed inline
    // as a base64 data URL: the gateway fetches remote URLs server-side, which
    // would fail against the private MinIO origin.
    let ocr: Awaited<ReturnType<typeof analyzeProofMedia>> | null = null;
    if (ingest.ok && payload.media_kind === "image" && ingest.bytes) {
      ocr = await analyzeProofMedia({ bytes: ingest.bytes, mime: ingest.mime });
      await prisma.webhookEvent.create({
        data: {
          provider: "WHATSMEOW",
          event_key: `ocr:${payload.message_id ?? Date.now()}`,
          event_type: "proof_ocr",
          payload: { tenant_id: tenant.id, amount: ocr.amount, bank: ocr.bank, confidence: ocr.confidence } as Prisma.InputJsonValue,
        },
      });
      notifyTenant(tenant.id, { type: "proof" });
    }

    // Chapter 8.C.4 step 6: attach the image to the buyer's active order so the
    // owner's "Galeri Struk" fills automatically instead of staying empty until a
    // manual POST. HARD RULE preserved: `submitPaymentProof` can only ever reach
    // PROOF_SUBMITTED. OCR stays supportive insight and is never the verifier.
    let proof: { order_number: string; payment_status: string } | null = null;
    if (ingest.ok && ingest.mediaUrl && payload.media_kind !== "video") {
      const activeOrder = await prisma.order.findFirst({
        where: {
          tenant_id: tenant.id,
          buyer_jid: payload.sender_jid,
          payment_status: { in: ["UNPAID", "REJECTED"] },
          order_status: { in: ["PENDING_PAYMENT", "PENDING_CONFIRMATION"] },
        },
        orderBy: { created_at: "desc" },
        select: { id: true, order_number: true },
      });

      if (activeOrder) {
        const submitted = await submitPaymentProof({
          orderId: activeOrder.id,
          mediaUrl: ingest.mediaUrl,
          ocr: ocr ? { amount: ocr.amount, bank: ocr.bank, confidence: ocr.confidence } : {},
        });
        if (submitted.ok) {
          proof = { order_number: activeOrder.order_number, payment_status: submitted.paymentStatus };
          notifyTenant(tenant.id, { type: "proof" });

          // B-3 FIX: kirim konfirmasi tanda terima ke WhatsApp pembeli.
          const connectedInstance = tenant.wa_instances?.find(
            (i: { connection_status: string }) => i.connection_status === "CONNECTED"
          );
          if (connectedInstance) {
            await waDaemon.sendText({
              instanceKey: connectedInstance.instance_key,
              to: payload.sender_jid,
              message: `Terima kasih kak! Bukti transfer untuk pesanan *${activeOrder.order_number}* sudah kami terima dan sedang dalam proses verifikasi oleh admin toko kami ya 🙏\n\nKami akan segera konfirmasi setelah pembayaran dikonfirmasi.`,
              simulateTyping: true,
            });
          }
        }
      }
    }

    // AI Vision Product Inquiry: jika gambar bukan bukti pembayaran pesanan aktif,
    // analisa apakah ini foto contoh produk yang ditanyakan oleh pembeli.
    if (!proof && ingest.ok && payload.media_kind === "image" && ingest.bytes) {
      const productInsight = await analyzeProductInquiryMedia({ bytes: ingest.bytes, mime: ingest.mime });
      if (productInsight.ok && productInsight.isProduct && productInsight.description) {
        visualProductContext = `[Konteks Gambar Produk dari Pembeli: ${productInsight.description}${
          productInsight.suggestedSearchQuery
            ? ` (Kata kunci pencarian katalog yang disarankan: "${productInsight.suggestedSearchQuery}")`
            : ""
        }]`;

        // Jika pembeli mengirim gambar produk tanpa caption, sintesiskan pesan pertanyaan alami.
        if (!payload.body.trim()) {
          payload.body = `Halo Kak, produk seperti di foto ini (${productInsight.description}) apakah ready atau ada di katalog?`;
        }
      }
    }

    // B-2 FIX: jika ada caption/teks pada pesan bergambar, lanjut ke pipeline AI.
    // Hanya return di sini jika body benar-benar kosong (media-only tanpa keterangan atau produk terdeteksi).
    if (!payload.body.trim()) {
      return ok({
        accepted: true,
        replied: false,
        media_ingested: ingest.ok,
        media_url: ingest.mediaUrl ?? null,
        ocr: ocr
          ? { amount: ocr.amount, bank: ocr.bank, confidence: ocr.confidence, ok: ocr.ok }
          : null,
        proof_attached: proof,
        note: "Media-only inbound: stored, tidak ada caption atau produk terdeteksi.",
      });
    }
    // Ada teks/caption bersama gambar: teruskan ke pipeline AI di bawah.
  }

  // --- Share-Location (USP 2): GPS -> kecamatan -> ongkir. ---
  // The resolved subdistrict is carried INTO the text pipeline below, so the AI
  // actually answers with ongkir for the shared location instead of only the
  // dashboard being notified.
  let locationContext: string | null = null;
  if (payload.latitude != null && payload.longitude != null) {
    const geo = await reverseGeocode(Number(payload.latitude), Number(payload.longitude));
    notifyTenant(tenant.id, { type: "chat" });

    if (geo.ok && geo.subdistrict) {
      locationContext = `[Lokasi pembeli dari share-location GPS] ${geo.subdistrict}${geo.city ? `, ${geo.city}` : ""}`;
    }

    // B-1 FIX: jika tidak ada teks, inject teks sintetis agar AI tetap bisa
    // merespons dengan estimasi ongkir dari kecamatan yang diterima.
    if (!payload.body.trim()) {
      if (!geo.ok || !geo.subdistrict) {
        // Geocode gagal: tidak bisa berbuat banyak, minta pembeli kirim teks.
        return ok({
          accepted: true,
          replied: false,
          note: "Lokasi diterima tapi tidak bisa di-reverse-geocode.",
          geocode_error: geo.error ?? null,
        });
      }
      // Inject pertanyaan sintetis sehingga AI menghitung ongkir.
      payload.body = `Hitung ongkir ke ${geo.subdistrict}${geo.city ? `, ${geo.city}` : ""}`;
    }
  }

  if (!payload.body.trim()) {
    // Nothing to answer: no text, no media, no location.
    return ok({ accepted: false, reason: "empty_body" });
  }

  // 3. Tenant-scoped catalog read (graceful degradation to cache).
  const settings = tenant.catalog_settings;
  let catalog: Awaited<ReturnType<typeof readCatalog>>;

  if (settings?.sheets_url) {
    catalog = await readCatalog(tenant.id, settings.sheets_url);
    if (catalog.source === "sheet") {
      await prisma.catalogSetting.update({
        where: { tenant_id: tenant.id },
        data: { last_synced_at: new Date() },
      });
    }
  } else {
    catalog = { rows: [], headers: [], source: "cache", warning: "Spreadsheet belum diatur" };
  }

  // 4. Run the agent.
  const result = await handleInboundMessage({
    tenantId: tenant.id,
    buyerJid: payload.sender_jid,
    buyerName: payload.sender_name || null,
    incomingText: [locationContext, visualProductContext, payload.body].filter(Boolean).join("\n\n"),
    instanceKey: payload.instance_key,
    catalog: catalog.rows,
    catalogSource: catalog.source,
    catalogWarning: catalog.warning,
    persist: true,
  });

  if (result.botMuted) {
    return ok({ accepted: true, replied: false, reason: result.botMutedReason });
  }

  // 5. Anti-abuse trap before sending anything.
  const abuse = recordBotSend(payload.instance_key);
  if (abuse.exceeded) {
    await prisma.waInstance.update({
      where: { id: instance.id },
      data: { connection_status: "PAIRING" },
    });
    return ok({
      accepted: true,
      replied: false,
      reason: "anti_abuse_frozen",
      detail: `${abuse.count} messages in window (limit ${abuse.limit})`,
    });
  }

  const sends: { kind: string; ok: boolean; error?: string }[] = [];

  // 6. Send the text reply (human typing simulation).
  if (result.replyText) {
    const sent = await waDaemon.sendText({
      instanceKey: payload.instance_key,
      to: payload.sender_jid,
      message: result.replyText,
      simulateTyping: true,
    });
    sends.push(sent.ok ? { kind: "text", ok: true } : { kind: "text", ok: false, error: sent.error });
  }

  // 7. Send any media the tools resolved (real MinIO files, chapter 8.B).
  for (const m of result.media) {
    const sent = await waDaemon.sendMedia({
      instanceKey: payload.instance_key,
      to: payload.sender_jid,
      url: m.url,
      caption: m.caption,
      kind: m.kind,
      simulateTyping: true,
    });
    sends.push(
      sent.ok
        ? { kind: m.kind, ok: true }
        : { kind: m.kind, ok: false, error: sent.error }
    );
  }

  return ok({
    accepted: true,
    replied: sends.some((s) => s.ok),
    escalated: result.escalated,
    catalog_source: result.catalogSource,
    catalog_warning: result.catalogWarning ?? null,
    tool_calls: result.toolCalls,
    tools: result.toolOutcomes.map((t) => ({ tool: t.tool, summary: t.summary })),
    model: result.model,
    latency_ms: result.latencyMs,
    degraded: result.degraded,
    degradation_reason: result.degradationReason ?? null,
    sends,
  });
}

/** Health probe so the daemon can verify the webhook target before pairing. */
export async function GET(req: NextRequest) {
  const limiter = rateLimit(`webhook-health:${req.headers.get("x-forwarded-for") ?? "local"}`, 60, 60_000);
  if (!limiter.allowed) return fail("Too many requests", 429);

  return ok({
    status: "ok",
    service: "noewbar-wa-webhook",
    bot_enabled: !isBotDisabled(),
    time: new Date().toISOString(),
  });
}
