import { toFile } from "openai";
import { aiClient } from "@/lib/ai/gateway";

export type TranscriptionResult = {
  ok: boolean;
  text?: string;
  error?: string;
};

/**
 * Transcribe WhatsApp voice notes or audio messages using Whisper.
 * Optimised for Indonesian e-commerce conversations.
 */
export async function transcribeVoiceNote(params: {
  bytes: Uint8Array;
  mime?: string;
  filename?: string;
}): Promise<TranscriptionResult> {
  try {
    if (!params.bytes || params.bytes.length === 0) {
      return { ok: false, error: "Audio bytes empty" };
    }

    const mime = params.mime || "audio/ogg";
    const ext = mime.includes("mp4") ? "mp4" : mime.includes("mpeg") ? "mp3" : "ogg";
    const filename = params.filename || `voice-${Date.now()}.${ext}`;

    const file = await toFile(Buffer.from(params.bytes), filename, { type: mime });

    const resp = await aiClient.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "id",
      prompt: "Percakapan pembeli toko online menanyakan produk, ukuran, ongkir, diskon, atau pembayaran.",
    });

    const text = (resp.text || "").trim();
    if (!text) {
      return { ok: false, error: "Transkripsi menghasilkan teks kosong" };
    }

    return { ok: true, text };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[Whisper] Failed to transcribe voice note:", message);
    return { ok: false, error: message };
  }
}
