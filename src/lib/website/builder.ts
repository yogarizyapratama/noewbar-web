import { chatWithFallback } from "@/lib/ai/gateway";

/**
 * AI Website Builder & Store Generator Engine.
 *
 * Provides:
 * 1. Curated Template Library with real renderable block sections.
 * 2. Structured Block-Based Section schemas (Hero, Products, Benefits, FAQ, CTA, etc.).
 * 3. AI Section Editing Engine with strict structured JSON output validation (no arbitrary code execution).
 * 4. AI Full-Site Generator from user prompts & business catalog.
 *
 * Rules:
 * - Zero em-dash (U+2014).
 * - Multi-tenant safe.
 */

export type SectionType =
  | "announcement"
  | "header"
  | "hero"
  | "product_grid"
  | "benefits"
  | "features"
  | "testimonials"
  | "faq"
  | "whatsapp_cta"
  | "footer";

export type WebsiteSection = {
  id: string;
  type: SectionType;
  position: number;
  content: Record<string, any>;
  style: {
    bg_color?: string;
    text_color?: string;
    padding?: "sm" | "md" | "lg";
    accent_color?: string;
  };
  visibility: boolean;
};

export type WebsiteTemplate = {
  id: string;
  name: string;
  category: "Skincare & Beauty" | "Fashion & Apparel" | "Makanan & Minuman" | "Elektronik & Gadget" | "UMKM & Toko Lokal";
  description: string;
  preview_bg: string;
  theme: {
    primary_color: string;
    accent_color: string;
    font: string;
  };
  default_sections: WebsiteSection[];
};

export const TEMPLATES: WebsiteTemplate[] = [
  {
    id: "skincare-glow",
    name: "Glow & Radiance",
    category: "Skincare & Beauty",
    description: "Desain bersih dan elegan untuk brand kecantikan, skincare organik, dan kosmetik dengan fokus testimoni serta keunggulan bahan.",
    preview_bg: "from-emerald-50 to-teal-50",
    theme: {
      primary_color: "#059669",
      accent_color: "#10B981",
      font: "Inter",
    },
    default_sections: [
      {
        id: "sec-ann-1",
        type: "announcement",
        position: 0,
        content: { text: "Gratis Ongkir ke seluruh Pulau Jawa untuk pembelian minimal Rp 200.000!" },
        style: { bg_color: "#065F46", text_color: "#ECFDF5", padding: "sm" },
        visibility: true,
      },
      {
        id: "sec-hero-1",
        type: "hero",
        position: 1,
        content: {
          badge: "Formula Alami & Teruji BPOM",
          headline: "Kulit Sehat Bercahaya Alami Tanpa Ketergantungan",
          subheadline: "Rawat kelembapan alami kulit wajah Anda dengan rangkaian skincare berbahan aktif botanikal yang aman untuk kulit sensitif.",
          cta_primary_text: "Pesan Sekarang via WA",
          cta_secondary_text: "Lihat Produk Unggulan",
          image_url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80",
        },
        style: { bg_color: "#F0FDF4", padding: "lg", accent_color: "#059669" },
        visibility: true,
      },
      {
        id: "sec-ben-1",
        type: "benefits",
        position: 2,
        content: {
          title: "Mengapa Memilih Kami?",
          subtitle: "Komitmen kami untuk kesehatan kulit Anda",
          items: [
            { title: "100% Terdaftar BPOM", desc: "Semua produk telah lulus uji klinis dan aman digunakan setiap hari." },
            { title: "Bahan Alami Pilihan", desc: "Bebas alkohol keras, paraben, dan pewangi buatan yang memicu iritasi." },
            { title: "Hasil Nyata dalam 14 Hari", desc: "Riset membuktikan 94% pengguna merasakan kelembapan kulit meningkat." },
          ],
        },
        style: { bg_color: "#FFFFFF", padding: "md" },
        visibility: true,
      },
      {
        id: "sec-prod-1",
        type: "product_grid",
        position: 3,
        content: {
          title: "Produk Unggulan",
          subtitle: "Pilihan terbaik yang paling banyak dicari",
          limit: 4,
        },
        style: { bg_color: "#F8FAFC", padding: "md" },
        visibility: true,
      },
      {
        id: "sec-testi-1",
        type: "testimonials",
        position: 4,
        content: {
          title: "Kata Mereka yang Sudah Membuktikan",
          items: [
            { name: "Anisa, Jakarta", text: "Teksturnya ringan banget, meresap cepat dan gak bikin minyakan. Jerawat hormonal juga cepat kempes!" },
            { name: "Dinda, Bandung", text: "Pelayanan via WhatsApp sangat ramah dan responsif, pengiriman cepat 1 hari langsung sampai." },
          ],
        },
        style: { bg_color: "#FFFFFF", padding: "md" },
        visibility: true,
      },
      {
        id: "sec-faq-1",
        type: "faq",
        position: 5,
        content: {
          title: "Pertanyaan yang Sering Diajukan",
          items: [
            { q: "Apakah aman untuk ibu hamil dan menyusui?", a: "Ya, formula kami bebas dari retinol dan asam keras sehingga aman untuk bumil dan busui." },
            { q: "Berapa lama estimasi pengiriman?", a: "Pengiriman Jabodetabek 1-2 hari kerja, luar kota 2-4 hari kerja via JNE dan J&T." },
            { q: "Bisa bayar via Transfer Bank dan QRIS?", a: "Tentu, kami menerima transfer rekening BCA, Mandiri, BRI, dan scan QRIS semua e-wallet." },
          ],
        },
        style: { bg_color: "#F8FAFC", padding: "md" },
        visibility: true,
      },
      {
        id: "sec-cta-1",
        type: "whatsapp_cta",
        position: 6,
        content: {
          title: "Konsultasi Kulit Gratis dengan CS Kami",
          subtitle: "Masih ragu memilih varian yang cocok? Chat WhatsApp sekarang dan dapatkan rekomendasi khusus.",
          button_text: "Chat WhatsApp Sekarang",
        },
        style: { bg_color: "#065F46", text_color: "#FFFFFF", padding: "lg" },
        visibility: true,
      },
      {
        id: "sec-foot-1",
        type: "footer",
        position: 7,
        content: {
          brand_name: "Noewbar Glow",
          tagline: "Kecantikan Alami dari Bahan Terbaik.",
          copyright: "Hak Cipta Dilindungi Undang-Undang.",
        },
        style: { bg_color: "#0F172A", text_color: "#E2E8F0", padding: "sm" },
        visibility: true,
      },
    ],
  },
  {
    id: "fashion-trendy",
    name: "Modern Atelier",
    category: "Fashion & Apparel",
    description: "Gaya visual monokrom modern dan tegas untuk toko pakaian, hijab, baju kasual, dan aksesoris.",
    preview_bg: "from-slate-100 to-zinc-200",
    theme: {
      primary_color: "#0F172A",
      accent_color: "#334155",
      font: "Inter",
    },
    default_sections: [
      {
        id: "sec-hero-f1",
        type: "hero",
        position: 0,
        content: {
          badge: "Koleksi Terbaru 2026",
          headline: "Pakaian Nyaman untuk Penampilan Berkelas Setiap Hari",
          subheadline: "Potongan presisi, bahan katun premium adem, dan jahitan rapi yang menjaga kepercayaan diri Anda di segala momen.",
          cta_primary_text: "Belanja Sekarang via WA",
          cta_secondary_text: "Katalog Lengkap",
          image_url: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80",
        },
        style: { bg_color: "#F8FAFC", padding: "lg", accent_color: "#0F172A" },
        visibility: true,
      },
      {
        id: "sec-prod-f1",
        type: "product_grid",
        position: 1,
        content: {
          title: "Koleksi Terpopuler",
          subtitle: "Model terlaris minggu ini yang siap kirim hari ini",
          limit: 6,
        },
        style: { bg_color: "#FFFFFF", padding: "md" },
        visibility: true,
      },
      {
        id: "sec-ben-f1",
        type: "benefits",
        position: 2,
        content: {
          title: "Kualitas yang Kami Jamin",
          items: [
            { title: "Bahan Katun Premium", desc: "Menyerap keringat, halus di kulit, dan tidak mudah berbulu setelah dicuci." },
            { title: "Garansi Tukar Ukuran", desc: "Kebesaran atau kekecilan? Bisa tukar size mudah dalam 3 hari setelah barang tiba." },
            { title: "Foto & Video Asli", desc: "Barang yang dikirim 100% sesuai dengan foto dan video produk yang ditampilkan." },
          ],
        },
        style: { bg_color: "#F8FAFC", padding: "md" },
        visibility: true,
      },
      {
        id: "sec-cta-f1",
        type: "whatsapp_cta",
        position: 3,
        content: {
          title: "Butuh Panduan Ukuran & Stok?",
          subtitle: "Hubungi Admin kami via WhatsApp untuk konfirmasi warna dan size sebelum kehabisan.",
          button_text: "Hubungi Admin via WA",
        },
        style: { bg_color: "#0F172A", text_color: "#FFFFFF", padding: "md" },
        visibility: true,
      },
      {
        id: "sec-foot-f1",
        type: "footer",
        position: 4,
        content: {
          brand_name: "Atelier Fashion",
          tagline: "Elegansi Nyata dalam Setiap Jahitan.",
          copyright: "Hak Cipta Dilindungi Undang-Undang.",
        },
        style: { bg_color: "#0F172A", text_color: "#94A3B8", padding: "sm" },
        visibility: true,
      },
    ],
  },
  {
    id: "umkm-juara",
    name: "Toko Lokal Juara",
    category: "UMKM & Toko Lokal",
    description: "Tata letak praktis dan bersahabat untuk toko online serba ada, produk lokal, dan UMKM dengan katalog produk lengkap.",
    preview_bg: "from-amber-50 to-orange-50",
    theme: {
      primary_color: "#D97706",
      accent_color: "#F59E0B",
      font: "Inter",
    },
    default_sections: [
      {
        id: "sec-ann-u1",
        type: "announcement",
        position: 0,
        content: { text: "Pesanan sebelum jam 15.00 WIB dikirim di hari yang sama!" },
        style: { bg_color: "#D97706", text_color: "#FFFFFF", padding: "sm" },
        visibility: true,
      },
      {
        id: "sec-hero-u1",
        type: "hero",
        position: 1,
        content: {
          badge: "Produk Asli & Berkualitas",
          headline: "Kebutuhan Toko Online Terpercaya & Pelayanan Cepat",
          subheadline: "Belanja produk kebutuhan harian dan pilihan terbaik dengan harga grosir serta jaminan sampai dengan aman.",
          cta_primary_text: "Pesan Langsung via WA",
          cta_secondary_text: "Daftar Produk",
        },
        style: { bg_color: "#FFFBEB", padding: "lg", accent_color: "#D97706" },
        visibility: true,
      },
      {
        id: "sec-prod-u1",
        type: "product_grid",
        position: 2,
        content: {
          title: "Katalog Produk Pilihan",
          subtitle: "Pilih produk favorit Anda dan pesan langsung melalui WhatsApp",
          limit: 8,
        },
        style: { bg_color: "#FFFFFF", padding: "md" },
        visibility: true,
      },
      {
        id: "sec-faq-u1",
        type: "faq",
        position: 3,
        content: {
          title: "Informasi Pembelian",
          items: [
            { q: "Bagaimana cara melakukan pemesanan?", a: "Cukup klik tombol Pesan via WA pada produk yang Anda inginkan, Anda akan langsung terhubung dengan admin." },
            { q: "Apakah ada nomor resi pelacakan?", a: "Ya, setelah paket diserahkan ke pihak ekspedisi, nomor resi resmi akan dikirimkan otomatis ke WhatsApp Anda." },
          ],
        },
        style: { bg_color: "#F8FAFC", padding: "md" },
        visibility: true,
      },
      {
        id: "sec-cta-u1",
        type: "whatsapp_cta",
        position: 4,
        content: {
          title: "Siap Melayani Kebutuhan Anda",
          subtitle: "Respon chat cepat 24 jam dengan asisten WhatsApp otomatis kami.",
          button_text: "Chat WhatsApp Toko",
        },
        style: { bg_color: "#D97706", text_color: "#FFFFFF", padding: "md" },
        visibility: true,
      },
      {
        id: "sec-foot-u1",
        type: "footer",
        position: 5,
        content: {
          brand_name: "Toko Lokal",
          tagline: "Sahabat Belanja Online Terpercaya.",
          copyright: "Hak Cipta Dilindungi Undang-Undang.",
        },
        style: { bg_color: "#1E293B", text_color: "#94A3B8", padding: "sm" },
        visibility: true,
      },
    ],
  },
];

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

    let cleaned = rawReply.trim();
    if (cleaned.startsWith("```json")) cleaned = cleaned.replace(/^```json\s*/i, "");
    if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```\s*/i, "");
    if (cleaned.endsWith("```")) cleaned = cleaned.replace(/```\s*$/i, "");
    cleaned = cleaned.trim();

    const parsed = JSON.parse(cleaned);
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
      error: err instanceof Error ? err.message : "Gagal memproses perubahan AI pada section.",
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

    let cleaned = raw.trim();
    if (cleaned.startsWith("```json")) cleaned = cleaned.replace(/^```json\s*/i, "");
    if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```\s*/i, "");
    if (cleaned.endsWith("```")) cleaned = cleaned.replace(/```\s*$/i, "");
    cleaned = cleaned.trim();

    const data = JSON.parse(cleaned);

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
