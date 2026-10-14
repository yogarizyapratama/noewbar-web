/**
 * AI Website Builder & Store Generator Types and Templates.
 *
 * Safe to import on both client and server (zero server dependencies).
 * Zero em-dash (U+2014) rule enforced.
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
  | "video_showcase"
  | "gallery_media"
  | "text_banner"
  | "countdown_promo"
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
            { icon: "ShieldCheck", title: "100% BPOM & Halal", desc: "Telah teruji klinis dan bersertifikasi resmi aman untuk ibu hamil & menyusui." },
            { icon: "Sparkles", title: "Bahan Alami Pilihan", desc: "Ekstrak tumbuhan kualitas premium tanpa merkuri atau hidrokuinon." },
            { icon: "HeartHandshake", title: "Konsultasi Gratis", desc: "Konsultasi masalah kulit langsung dengan beauty advisor kami via WA." },
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
          title: "Produk Unggulan Kami",
          subtitle: "Pilihan terbaik yang paling disukai ribuan pelanggan",
          limit: 6,
        },
        style: { bg_color: "#F9FAFB", padding: "md" },
        visibility: true,
      },
      {
        id: "sec-testi-1",
        type: "testimonials",
        position: 4,
        content: {
          title: "Kata Mereka yang Sudah Mencoba",
          items: [
            { name: "Siti Rahma", role: "Pelanggan Terverifikasi", text: "Baru pakai 2 minggu kulit terasa jauh lebih lembap dan noda bekas jerawat memudar!", rating: 5 },
            { name: "Dina Kartika", role: "Pelanggan Terverifikasi", text: "Teksturnya ringan banget, cepat meresap dan nggak lengket sama sekali di kulit berminyak.", rating: 5 },
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
            { q: "Apakah produk ini aman untuk bumil dan busui?", a: "Ya, seluruh produk kami diformulasikan aman tanpa bahan kimia keras berbahaya." },
            { q: "Berapa lama estimasi pengiriman?", a: "Pesanan diproses dalam 1x24 jam dengan estimasi tiba 2-4 hari kerja tergantung kota tujuan." },
            { q: "Apakah bisa bayar di tempat (COD)?", a: "Bisa! Kami melayani pembayaran COD untuk area tertentu melalui kurir rekanan." },
          ],
        },
        style: { bg_color: "#F0FDF4", padding: "md" },
        visibility: true,
      },
      {
        id: "sec-cta-1",
        type: "whatsapp_cta",
        position: 6,
        content: {
          title: "Dapatkan Kulit Impian Anda Hari Ini",
          subtitle: "Hubungi tim admin kami untuk rekomendasi paket yang paling tepat untuk jenis kulit Anda.",
          button_text: "Konsultasi & Pesan via WhatsApp",
        },
        style: { bg_color: "#059669", text_color: "#FFFFFF", padding: "lg" },
        visibility: true,
      },
      {
        id: "sec-foot-1",
        type: "footer",
        position: 7,
        content: {
          brand_name: "Glow Skin Official",
          tagline: "Kecantikan alami terpancar dari kulit yang sehat.",
          copyright: "Hak Cipta Dilindungi Undang-Undang.",
        },
        style: { bg_color: "#064E3B", text_color: "#A7F3D0", padding: "sm" },
        visibility: true,
      },
    ],
  },
  {
    id: "fashion-luxe",
    name: "Urban Minimalist",
    category: "Fashion & Apparel",
    description: "Tampilan modern, bold, dan bergaya streetwear/editorial untuk brand pakaian, aksesoris, sepatu, dan apparel modern.",
    preview_bg: "from-slate-100 to-zinc-100",
    theme: {
      primary_color: "#0F172A",
      accent_color: "#3B82F6",
      font: "Inter",
    },
    default_sections: [
      {
        id: "sec-hero-f1",
        type: "hero",
        position: 0,
        content: {
          badge: "New Season Collection",
          headline: "Gaya Minimalis dengan Kenyamanan Maksimal",
          subheadline: "Koleksi terbaru pakaian berkualitas tinggi dengan potongan presisi dan bahan premium yang tahan lama.",
          cta_primary_text: "Belanja Sekarang",
          cta_secondary_text: "Lihat Lookbook",
          image_url: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80",
        },
        style: { bg_color: "#F8FAFC", padding: "lg", accent_color: "#0F172A" },
        visibility: true,
      },
      {
        id: "sec-prod-f1",
        type: "product_grid",
        position: 1,
        content: {
          title: "Koleksi Terbaru",
          subtitle: "Temukan outfit terbaik untuk menunjang aktivitas harian Anda",
          limit: 8,
        },
        style: { bg_color: "#FFFFFF", padding: "md" },
        visibility: true,
      },
      {
        id: "sec-ben-f1",
        type: "benefits",
        position: 2,
        content: {
          title: "Keunggulan Bahan & Layanan",
          items: [
            { icon: "Truck", title: "Pengiriman Cepat", desc: "Dipacking rapi dan dikirim di hari yang sama untuk order sebelum 15.00." },
            { icon: "RefreshCw", title: "Garansi Tukar Ukuran", desc: "Salah pilih ukuran? Tukar mudah dalam 3 hari setelah barang diterima." },
            { icon: "Tag", title: "Harga Produsen Langsung", desc: "Kualitas garmen internasional tanpa markup berlebihan." },
          ],
        },
        style: { bg_color: "#F1F5F9", padding: "md" },
        visibility: true,
      },
      {
        id: "sec-cta-f1",
        type: "whatsapp_cta",
        position: 3,
        content: {
          title: "Punya Pertanyaan Seputar Ukuran?",
          subtitle: "Admin kami siap membantu mencocokkan size chart yang pas untuk postur tubuh Anda.",
          button_text: "Tanya Size via WhatsApp",
        },
        style: { bg_color: "#0F172A", text_color: "#FFFFFF", padding: "md" },
        visibility: true,
      },
      {
        id: "sec-foot-f1",
        type: "footer",
        position: 4,
        content: {
          brand_name: "Urban Label",
          tagline: "Timeless clothing for modern everyday life.",
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
 * Converts YouTube, Vimeo, or MP4 URLs into responsive embed player URLs.
 */
export function getEmbedVideoUrl(url?: string): { isEmbed: boolean; url: string | null; isMp4: boolean } {
  if (!url || typeof url !== "string") {
    return { isEmbed: false, url: null, isMp4: false };
  }
  const trimmed = url.trim();

  // YouTube match
  const ytMatch = trimmed.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
  );
  if (ytMatch && ytMatch[1]) {
    return {
      isEmbed: true,
      url: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?rel=0&modestbranding=1`,
      isMp4: false,
    };
  }

  // Vimeo match
  const vimeoMatch = trimmed.match(
    /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)/i
  );
  if (vimeoMatch && vimeoMatch[3]) {
    return {
      isEmbed: true,
      url: `https://player.vimeo.com/video/${vimeoMatch[3]}`,
      isMp4: false,
    };
  }

  // Already embed url from trusted video providers
  if (trimmed.includes("/embed/")) {
    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();
      if (
        host === "www.youtube.com" ||
        host === "youtube.com" ||
        host === "www.youtube-nocookie.com" ||
        host === "youtube-nocookie.com" ||
        host === "player.vimeo.com"
      ) {
        return { isEmbed: true, url: trimmed, isMp4: false };
      }
    } catch {}
  }

  // MP4 or WebM video file
  if (trimmed.match(/\.(mp4|webm|ogg)(\?.*)?$/i)) {
    return { isEmbed: false, url: trimmed, isMp4: true };
  }

  return { isEmbed: false, url: null, isMp4: false };
}

/** Sanitizes public URLs to prevent javascript: and dangerous XSS schemes. */
export function sanitizeSafeUrl(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return null;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(mailto|tel):/i.test(trimmed)) return trimmed;
  return null;
}

export type SectionBlueprint = {
  type: SectionType;
  title: string;
  category: "Header & Hero" | "Media & Galeri" | "Promosi & Penawaran" | "Konten & Informasi" | "Pemesanan & Kontak";
  description: string;
  defaultSection: () => WebsiteSection;
};

export const AVAILABLE_SECTION_TEMPLATES: SectionBlueprint[] = [
  {
    type: "hero",
    title: "Hero Banner",
    category: "Header & Hero",
    description: "Banner utama toko dengan headline memikat, foto/video produk, dan tombol beli.",
    defaultSection: () => ({
      id: `sec-hero-${Date.now()}`,
      type: "hero",
      position: 0,
      content: {
        badge: "Koleksi Terbaru 2026",
        headline: "Produk Berkualitas Terbaik untuk Anda",
        subheadline: "Belanja praktis, aman, dan bergaransi resmi dengan konfirmasi pesanan cepat via WhatsApp.",
        cta_primary_text: "Pesan Sekarang via WA",
        cta_secondary_text: "Lihat Katalog Produk",
        image_url: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80",
        video_url: "",
      },
      style: { bg_color: "#F8FAFC", padding: "lg", accent_color: "#059669" },
      visibility: true,
    }),
  },
  {
    type: "video_showcase",
    title: "Video Showcase",
    category: "Media & Galeri",
    description: "Tampilkan video review, unboxing, atau demonstrasi produk dari YouTube atau file MP4.",
    defaultSection: () => ({
      id: `sec-video-${Date.now()}`,
      type: "video_showcase",
      position: 0,
      content: {
        badge: "Tonton Review Produk",
        title: "Lihat Kualitas Nyata Produk Kami Secara Langsung",
        description: "Simak video unboxing dan panduan pemakaian produk unggulan kami untuk melihat detail aslinya.",
        video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        button_text: "Pesan Produk di Video Ini",
      },
      style: { bg_color: "#0F172A", text_color: "#FFFFFF", padding: "lg" },
      visibility: true,
    }),
  },
  {
    type: "gallery_media",
    title: "Galeri Foto & Media",
    category: "Media & Galeri",
    description: "Koleksi foto produk, lookbook, suasana toko, atau hasil pemakaian nyata pembeli.",
    defaultSection: () => ({
      id: `sec-gal-${Date.now()}`,
      type: "gallery_media",
      position: 0,
      content: {
        title: "Galeri Foto Produk Nyata",
        subtitle: "Foto produk asli tanpa filter berlebih dari sesi pemotretan kami",
        items: [
          {
            image_url: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=600&q=80",
            caption: "Tampilan Elegan",
          },
          {
            image_url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80",
            caption: "Kemasan Eksklusif",
          },
          {
            image_url: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=600&q=80",
            caption: "Bahan Pilihan",
          },
        ],
      },
      style: { bg_color: "#FFFFFF", padding: "md" },
      visibility: true,
    }),
  },
  {
    type: "text_banner",
    title: "Tentang Toko & Cerita Brand",
    category: "Konten & Informasi",
    description: "Ceritakan kisah brand Anda dengan foto pemilik/toko, visi produk, dan alasan memilih Anda.",
    defaultSection: () => ({
      id: `sec-story-${Date.now()}`,
      type: "text_banner",
      position: 0,
      content: {
        badge: "Cerita Kami",
        title: "Dibuat Sepenuh Hati untuk Kebutuhan Sehari-hari Anda",
        paragraph: "Kami memulai usaha ini dengan satu komitmen sederhana: menghadirkan produk berkualitas premium dengan harga yang masuk akal dan pelayanan jujur. Setiap produk telah melalui uji kualitas ketat sebelum sampai ke tangan Anda.",
        image_url: "https://images.unsplash.com/photo-1556742049-0a67c5574f73?auto=format&fit=crop&w=800&q=80",
        bullet_points: [
          "Bahan baku pilihan berstandar tinggi",
          "Pengiriman aman dengan garansi penggantian jika rusak",
          "Dukungan konsultasi langsung via WhatsApp",
        ],
        button_text: "Hubungi Owner Toko",
      },
      style: { bg_color: "#F8FAFC", padding: "lg" },
      visibility: true,
    }),
  },
  {
    type: "countdown_promo",
    title: "Promo Flash Sale & Countdown",
    category: "Promosi & Penawaran",
    description: "Ciptakan urgensi tinggi dengan promo potongan harga terbatas dan ajakan beli cepat.",
    defaultSection: () => ({
      id: `sec-promo-${Date.now()}`,
      type: "countdown_promo",
      position: 0,
      content: {
        badge: "FLASH SALE TERBATAS HARI INI",
        title: "Diskon Spesial Hingga 35% Hanya Pekan Ini!",
        subtitle: "Stok promo sangat terbatas. Amankan pesanan Anda sekarang sebelum kuota habis.",
        discount_tag: "HEMAT RP 50.000",
        countdown_hours: 12,
        button_text: "Klaim Promo via WhatsApp Sekarang",
      },
      style: { bg_color: "#065F46", text_color: "#FFFFFF", padding: "md" },
      visibility: true,
    }),
  },
  {
    type: "benefits",
    title: "Keunggulan & Layanan",
    category: "Konten & Informasi",
    description: "3 kartu keunggulan seperti garansi, pengiriman cepat, dan produk original.",
    defaultSection: () => ({
      id: `sec-ben-${Date.now()}`,
      type: "benefits",
      position: 0,
      content: {
        title: "Mengapa Berbelanja di Toko Kami?",
        subtitle: "Kenyamanan dan kepuasan Anda adalah prioritas utama kami",
        items: [
          { title: "100% Produk Asli", desc: "Jaminan original dengan garansi uang kembali jika terbukti tiruan." },
          { title: "Pengiriman Tercepat", desc: "Dipacking rapi dan dikirim pada hari yang sama untuk order sebelum jam 15.00." },
          { title: "Bisa Bayar COD", desc: "Tersedia pilihan bayar di tempat untuk kemudahan transaksi Anda." },
        ],
      },
      style: { bg_color: "#FFFFFF", padding: "md" },
      visibility: true,
    }),
  },
  {
    type: "product_grid",
    title: "Katalog Produk Pilihan",
    category: "Header & Hero",
    description: "Grid katalog produk terhubung database dengan tombol pesan WhatsApp otomatis.",
    defaultSection: () => ({
      id: `sec-prod-${Date.now()}`,
      type: "product_grid",
      position: 0,
      content: {
        title: "Katalog Produk Pilihan",
        subtitle: "Pilih produk favorit Anda dan pesan dengan respon otomatis 24 jam",
        limit: 6,
      },
      style: { bg_color: "#F8FAFC", padding: "md" },
      visibility: true,
    }),
  },
  {
    type: "testimonials",
    title: "Ulasan & Testimoni Pembeli",
    category: "Promosi & Penawaran",
    description: "Tampilkan kata pembeli puas untuk meningkatkan kepercayaan pengunjung.",
    defaultSection: () => ({
      id: `sec-testi-${Date.now()}`,
      type: "testimonials",
      position: 0,
      content: {
        title: "Apa Kata Pelanggan Setia Kami?",
        items: [
          { name: "Anisa Rahmawati", role: "Pelanggan Terverifikasi", text: "Barang sampai dengan cepat dan packingnya super aman berlapis bubble wrap. Kualitasnya juara!", rating: 5 },
          { name: "Budi Pratama", role: "Pelanggan Terverifikasi", text: "Pelayanan admin WhatsApp ramah sekali dan sangat responsif menjawab pertanyaan. Recommended seller!", rating: 5 },
        ],
      },
      style: { bg_color: "#FFFFFF", padding: "md" },
      visibility: true,
    }),
  },
  {
    type: "faq",
    title: "Tanya Jawab (FAQ)",
    category: "Konten & Informasi",
    description: "Daftar pertanyaan dan jawaban umum tentang pengiriman, retur, dan pembayaran.",
    defaultSection: () => ({
      id: `sec-faq-${Date.now()}`,
      type: "faq",
      position: 0,
      content: {
        title: "Pertanyaan yang Sering Diajukan",
        items: [
          { q: "Bagaimana cara memesan produk?", a: "Klik tombol Pesan via WhatsApp di produk yang diinginkan, admin kami akan langsung memproses pesanan Anda." },
          { q: "Berapa lama estimasi pengiriman?", a: "Pesanan diproses dalam 1x24 jam dengan estimasi tiba 2-4 hari kerja tergantung alamat tujuan." },
          { q: "Apakah ada garansi jika barang rusak?", a: "Ya! Kami memberikan garansi ganti baru jika barang yang Anda terima rusak atau tidak sesuai." },
        ],
      },
      style: { bg_color: "#F8FAFC", padding: "md" },
      visibility: true,
    }),
  },
  {
    type: "whatsapp_cta",
    title: "Ajakan Bertindak WhatsApp (CTA)",
    category: "Pemesanan & Kontak",
    description: "Banner penutup dengan tombol WhatsApp besar untuk konversi maksimal.",
    defaultSection: () => ({
      id: `sec-cta-${Date.now()}`,
      type: "whatsapp_cta",
      position: 0,
      content: {
        title: "Punya Pertanyaan atau Siap Memesan?",
        subtitle: "Konsultasikan kebutuhan Anda sekarang dengan tim kami melalui WhatsApp.",
        button_text: "Hubungi Kami via WhatsApp",
      },
      style: { bg_color: "#065F46", text_color: "#FFFFFF", padding: "lg" },
      visibility: true,
    }),
  },
  {
    type: "announcement",
    title: "Pengumuman Promo (Top Bar)",
    category: "Header & Hero",
    description: "Bar tipis di paling atas untuk mengabarkan gratis ongkir atau diskon musiman.",
    defaultSection: () => ({
      id: `sec-ann-${Date.now()}`,
      type: "announcement",
      position: 0,
      content: { text: "Gratis Ongkir ke seluruh Pulau Jawa untuk pembelian hari ini!" },
      style: { bg_color: "#065F46", text_color: "#ECFDF5", padding: "sm" },
      visibility: true,
    }),
  },
  {
    type: "footer",
    title: "Footer Toko",
    category: "Pemesanan & Kontak",
    description: "Bagian bawah halaman berisi identitas brand, slogan, dan hak cipta.",
    defaultSection: () => ({
      id: `sec-foot-${Date.now()}`,
      type: "footer",
      position: 0,
      content: {
        brand_name: "Toko Resmi Official",
        tagline: "Kualitas terbaik untuk kepuasan pelanggan setia.",
        copyright: "Hak Cipta Dilindungi Undang-Undang.",
      },
      style: { bg_color: "#0F172A", text_color: "#94A3B8", padding: "sm" },
      visibility: true,
    }),
  },
];

/**
 * Determines whether a background hex color is dark, so text and inner card styling
 * can dynamically adjust contrast for WCAG AA compliance and modern aesthetics.
 */
export function isDarkColor(color?: string): boolean {
  if (!color) return false;
  let hex = color.trim().replace("#", "");
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  if (hex.length !== 6) return false;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return false;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq < 145;
}

export function getCanvasPadding(padding?: string): string {
  if (padding === "sm") return "py-4 px-4 sm:px-5";
  if (padding === "lg") return "py-14 px-6 sm:px-10";
  return "py-8 px-5 sm:px-8";
}

export function getStorefrontPadding(padding?: string): string {
  if (padding === "sm") return "py-8 sm:py-12 px-5 sm:px-8";
  if (padding === "lg") return "py-20 sm:py-28 px-5 sm:px-8";
  return "py-14 sm:py-20 px-5 sm:px-8";
}

export interface SectionTheme {
  bg: string;
  text: string;
  mutedText: string;
  isDark: boolean;
  cardBg: string;
  cardBorder: string;
  cardText: string;
  cardMuted: string;
}

export function getSectionTheme(
  style?: WebsiteSection["style"],
  defaultBg = "#FFFFFF",
  defaultText?: string
): SectionTheme {
  const bg = style?.bg_color || defaultBg;
  const dark = isDarkColor(bg);

  const text = style?.text_color || defaultText || (dark ? "#FFFFFF" : "#0F172A");
  const mutedText = style?.text_color
    ? `${style.text_color}cc`
    : (dark ? "#CBD5E1" : "#64748B");

  const cardBg = dark ? "rgba(255, 255, 255, 0.08)" : "#FFFFFF";
  const cardBorder = dark ? "rgba(255, 255, 255, 0.15)" : "#E2E8F0";
  const cardText = dark ? "#FFFFFF" : "#0F172A";
  const cardMuted = dark ? "#CBD5E1" : "#64748B";

  return {
    bg,
    text,
    mutedText,
    isDark: dark,
    cardBg,
    cardBorder,
    cardText,
    cardMuted,
  };
}
