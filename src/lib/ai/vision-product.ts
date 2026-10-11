/**
 * AI Vision for inbound product inquiry photos sent by WhatsApp buyers.
 *
 * When a buyer sends a photo (e.g. "produk kaya gini ada ga kak?" or an image of apparel/goods),
 * this vision module analyzes the visual attributes (type, color, style, patterns) and produces a
 * concise description and targeted search query for the product catalog.
 */

import { chatWithFallback } from "@/lib/ai/gateway";
import type { OcrImageInput } from "@/lib/ai/vision-ocr";

export type ProductVisualInsight = {
  ok: boolean;
  isProduct: boolean;
  productType: string | null;
  color: string | null;
  styleOrPattern: string | null;
  suggestedSearchQuery: string | null;
  description: string;
  error?: string;
};

function toImageUrl(input: OcrImageInput): string {
  if (typeof input === "string") return input;
  const mime = input.mime ?? "image/jpeg";
  const b64 = Buffer.from(input.bytes).toString("base64");
  return `data:${mime};base64,${b64}`;
}

const SYSTEM = [
  "Anda adalah asisten visual AI untuk toko retail dan fashion e-commerce Indonesia.",
  "Tugas Anda menganalisis gambar produk yang dikirimkan oleh calon pembeli via WhatsApp.",
  "Output HANYA format JSON valid dengan field berikut:",
  "{",
  '  "isProduct": true/false,',
  '  "productType": "kategori barang (misal: kaos, kemeja, hoodie, celana, jaket, sepatu, topi, tas, dll)",',
  '  "color": "warna utama barang (misal: hitam, putih, sage green, navy, abu misty, marun)",',
  '  "styleOrPattern": "motif atau model potongan (misal: oversize, polos, flannel kotak, crewneck, slim fit)",',
  '  "suggestedSearchQuery": "kata kunci pencarian ringkas 2-4 kata untuk mencari barang ini di katalog toko (contoh: kaos oversize hitam, hoodie fleece abu, kemeja flannel navy)",',
  '  "description": "deskripsi singkat 1 kalimat dalam bahasa Indonesia mengenai barang di gambar"',
  "}",
  "Jika gambar merupakan bukti transfer bank, struk kasir, foto orang/selfie acak, dokumen, atau meme, set isProduct: false dan nilai lainnya null.",
  "DILARANG mengarang jika gambar tidak jelas.",
  "Balas HANYA string JSON tanpa awalan atau akhiran penjelasan markdown.",
].join(" ");

export async function analyzeProductInquiryMedia(image: OcrImageInput): Promise<ProductVisualInsight> {
  const imageUrl = toImageUrl(image);
  try {
    const { content: raw } = await chatWithFallback({
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: "Analisis produk pada gambar ini untuk pencarian katalog toko." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 300,
      temperature: 0.2,
    });

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      return {
        ok: false,
        isProduct: false,
        productType: null,
        color: null,
        styleOrPattern: null,
        suggestedSearchQuery: null,
        description: "",
      };
    }

    const parsed = JSON.parse(match[0]);
    return {
      ok: true,
      isProduct: Boolean(parsed.isProduct),
      productType: typeof parsed.productType === "string" ? parsed.productType : null,
      color: typeof parsed.color === "string" ? parsed.color : null,
      styleOrPattern: typeof parsed.styleOrPattern === "string" ? parsed.styleOrPattern : null,
      suggestedSearchQuery: typeof parsed.suggestedSearchQuery === "string" ? parsed.suggestedSearchQuery : null,
      description: typeof parsed.description === "string" ? parsed.description : "",
    };
  } catch (err) {
    return {
      ok: false,
      isProduct: false,
      productType: null,
      color: null,
      styleOrPattern: null,
      suggestedSearchQuery: null,
      description: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
