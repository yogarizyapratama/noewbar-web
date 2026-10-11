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
