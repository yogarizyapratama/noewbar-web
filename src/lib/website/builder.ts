import { chatWithFallback, formatAiGatewayError } from "@/lib/ai/gateway";
import { TEMPLATES, type WebsiteSection } from "./types";

export * from "./types";

/**
 * AI Website Builder & Store Generator Engine.
 *
 * Provides:
 * 1. AI Section Editing Engine with strict structured JSON output validation (no arbitrary code execution).
 * 2. AI Full-Site Generator from user prompts & business catalog.
 *
 * Rules:
 * - Zero em-dash (U+2014).
 * - Multi-tenant safe.
 */

function extractJsonFromLlm(raw: string): any {
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const targetStr = codeBlockMatch ? codeBlockMatch[1].trim() : raw.trim();
  const braceMatch = targetStr.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (!braceMatch) throw new Error("Format JSON tidak ditemukan pada output AI");
  return JSON.parse(braceMatch[0]);
}

/**
 * AI Block Editing Engine:
 * Takes the current target section and user prompt, and requests a validated JSON
 * modification from the LLM without touching any other section.
 */
export async function editSectionWithAi(params: {
  section: WebsiteSection;
  userPrompt: string;
  businessName: string;
}): Promise<{ ok: boolean; updatedSection?: WebsiteSection; error?: string }> {
  const systemPrompt = `Anda adalah Website Block Editor AI profesional.
Tugas Anda adalah memperbarui SATU section website berdasarkan instruksi pengguna.
Target section saat ini bertipe: "${params.section.type}".
Nama bisnis: "${params.businessName}".

ATURAN WAJIB:
1. Keluarkan HANYA JSON murni yang valid tanpa awalan markdown seperti \`\`\`json.
2. Pertahankan properti 'id', 'type', dan 'position' yang sama persis.
3. Ubah HANYA field di dalam 'content' atau 'style' yang relevan dengan instruksi pengguna.
4. JANGAN mengarang harga, diskon palsu, atau klaim yang melanggar.
5. Format output yang WAJIB dipatuhi:
{
  "content": { ... },
  "style": { ... }
}`;

  const userMessage = `Berikut adalah section saat ini:
${JSON.stringify({ content: params.section.content, style: params.section.style }, null, 2)}

Instruksi pengguna untuk mengubah section ini:
"${params.userPrompt}"

Berikan JSON hasil pembaruan untuk content dan style:`;

  try {
    const { content: rawReply } = await chatWithFallback({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 1200,
    });

    const parsed = extractJsonFromLlm(rawReply);
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, error: "AI mengembalikan format yang tidak valid." };
    }

    const updatedSection: WebsiteSection = {
      ...params.section,
      content: {
        ...params.section.content,
        ...(parsed.content && typeof parsed.content === "object" ? parsed.content : {}),
      },
      style: {
        ...params.section.style,
        ...(parsed.style && typeof parsed.style === "object" ? parsed.style : {}),
      },
    };

    return { ok: true, updatedSection };
  } catch (err) {
    return {
      ok: false,
      error: formatAiGatewayError(err),
    };
  }
}

/**
 * Generates a complete tailored website from user prompt + business context.
 */
export async function generateWebsiteFromPrompt(params: {
  businessName: string;
  userPrompt: string;
  templateId?: string;
  productCount?: number;
}): Promise<{
  name: string;
  title: string;
  description: string;
  sections: WebsiteSection[];
}> {
  const baseTemplate = TEMPLATES.find((t) => t.id === params.templateId) || TEMPLATES[0];

  const systemPrompt = `Anda adalah AI Website Architect untuk e-commerce dan toko online.
Buat struktur konten landing page lengkap untuk bisnis: "${params.businessName}".
Instruksi pengguna: "${params.userPrompt}".

Tugas Anda:
Sesuaikan konten headline, subheadline, keunggulan (benefits), FAQ, dan ajakan bertindak (CTA) agar tepat sasaran dengan bisnis dan instruksi pengguna.

Keluarkan HANYA JSON murni dengan format:
{
  "name": "Nama Website Singkat",
  "title": "Title Tag SEO",
  "description": "Meta description singkat",
  "hero_headline": "Headline kuat dan menjual",
  "hero_subheadline": "Deskripsi singkat penjelas",
  "hero_badge": "Badge kecil di atas headline",
  "benefits": [
    { "title": "Keunggulan 1", "desc": "Penjelasan singkat" },
    { "title": "Keunggulan 2", "desc": "Penjelasan singkat" },
    { "title": "Keunggulan 3", "desc": "Penjelasan singkat" }
  ],
  "faq": [
    { "q": "Pertanyaan 1?", "a": "Jawaban 1" },
    { "q": "Pertanyaan 2?", "a": "Jawaban 2" },
    { "q": "Pertanyaan 3?", "a": "Jawaban 3" }
  ],
  "cta_title": "Judul CTA WhatsApp",
  "cta_subtitle": "Subjudul penjelas CTA"
}`;

  try {
    const { content: raw } = await chatWithFallback({
      messages: [{ role: "system", content: systemPrompt }],
      temperature: 0.4,
      max_tokens: 1500,
    });

    const data = extractJsonFromLlm(raw);

    // Apply the tailored content over the base template sections
    const newSections = baseTemplate.default_sections.map((sec) => {
      const copy = { ...sec, content: { ...sec.content } };
      if (sec.type === "hero" && data.hero_headline) {
        copy.content.headline = data.hero_headline;
        if (data.hero_subheadline) copy.content.subheadline = data.hero_subheadline;
        if (data.hero_badge) copy.content.badge = data.hero_badge;
      } else if (sec.type === "benefits" && Array.isArray(data.benefits) && data.benefits.length > 0) {
        copy.content.items = data.benefits;
      } else if (sec.type === "faq" && Array.isArray(data.faq) && data.faq.length > 0) {
        copy.content.items = data.faq;
      } else if (sec.type === "whatsapp_cta" && data.cta_title) {
        copy.content.title = data.cta_title;
        if (data.cta_subtitle) copy.content.subtitle = data.cta_subtitle;
      }
      return copy;
    });

    return {
      name: data.name || `${params.businessName} Online Store`,
      title: data.title || `${params.businessName} - Toko Online Resmi`,
      description: data.description || `Selamat datang di toko resmi ${params.businessName}. Belanja mudah dengan respon cepat WhatsApp.`,
      sections: newSections,
    };
  } catch {
    // Graceful fallback to default base template
    return {
      name: `${params.businessName} Online Store`,
      title: `${params.businessName} - Toko Online Resmi`,
      description: `Official online store untuk ${params.businessName}. Belanja mudah dan cepat melalui WhatsApp.`,
      sections: baseTemplate.default_sections,
    };
  }
}
