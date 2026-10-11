/**
 * AI Vision OCR for payment-proof media (chapter 8.C.4).
 *
 * Strict rule from the spec: OCR output is SUPPORTIVE INSIGHT ONLY. It can label
 * the receipt (amount, bank, confidence) but NEVER moves the order to a paid
 * state. The only path to VERIFIED is the store owner checking the real bank
 * statement and clicking verify. That boundary lives in orders.ts, not here.
 */

import { chatWithFallback } from "@/lib/ai/gateway";

export type OcrResult = {
  ok: boolean;
  amount: number | null;
  bank: string | null;
  confidence: number | null;
  raw: string;
  error?: string;
};

/**
 * The gateway downloads remote image URLs server-side, which fails for our
 * private MinIO origin (robots / origin checks). Passing the bytes inline as a
 * base64 data URL avoids any server-side fetch, so OCR always works.
 */
export type OcrImageInput = string | { bytes: Uint8Array; mime?: string };

function toImageUrl(input: OcrImageInput): string {
  if (typeof input === "string") return input;
  const mime = input.mime ?? "image/jpeg";
  const b64 = Buffer.from(input.bytes).toString("base64");
  return `data:${mime};base64,${b64}`;
}

const SYSTEM = [
  "Anda adalah pembaca bukti transfer perbankan Indonesia.",
  "Output JSON hanya dengan bidang: amount (angka Rupiah tanpa pemisah), bank, confidence (0-1).",
  "Jika gambar bukan bukti transfer atau tidak terbaca, kembalikan amount: null, bank: null, confidence: 0.",
  "DILARANG menebak. Jangan pernah mengarang nominal atau bank.",
].join(" ");

/** Sends the media bytes as a vision message; returns structured OCR insight. */
export async function analyzeProofMedia(image: OcrImageInput): Promise<OcrResult> {
  const imageUrl = toImageUrl(image);
  try {
    const { content: raw } = await chatWithFallback({
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: "Ekstrak informasi dari bukti transfer ini." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 300,
    });

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { ok: false, amount: null, bank: null, confidence: null, raw };

    const parsed = JSON.parse(match[0]);
    return {
      ok: true,
      amount: typeof parsed.amount === "number" ? parsed.amount : null,
      bank: typeof parsed.bank === "string" ? parsed.bank : null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
      raw,
    };
  } catch (err) {
    return {
      ok: false,
      amount: null,
      bank: null,
      confidence: null,
      error: err instanceof Error ? err.message : String(err),
      raw: "",
    };
  }
}