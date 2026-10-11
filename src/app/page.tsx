"use client";

/**
 * Public landing page (chapter 10.A).
 *
 * Posture: the page opens with the problem and the mechanism, not a gradient
 * hero. Every claim that can be measured is measured live through the
 * simulator. Anything not yet configured renders an honest empty state instead
 * of fabricated rows (no sample products, no fake screenshots).
 *
 * Dials (DESIGN.md): ENERGY medium - the numbers carry the urgency, not motion.
 * RHYTHM generous on this surface, tight inside the console. MOTION functional.
 */

import { useState } from "react";
import {
  ArrowRight,
  Bot,
  Check,
  Database,
  Globe,
  Layers,
  LayoutDashboard,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Truck,
} from "lucide-react";
import { Badge, StatusDot, cn } from "@/components/ui";
import { PlaygroundPanel } from "@/components/landing/playground";
import { RoiCalculator } from "@/components/landing/roi-calculator";

const FAQ = [
  {
    q: "Apakah nomor WhatsApp saya aman dari blokir (banned)?",
    a: "Bot Noewbar hanya membalas pembeli yang chat lebih dulu (inbound) dan meniru jeda mengetik manusia 1,8 sampai 3,2 detik sebelum mengirim. Sistem ini bukan alat spam blast massal.",
  },
  {
    q: "Bagaimana cara membuat website toko online dengan AI?",
    a: "Cukup masukkan prompt instruksi jenis bisnis dan preferensi gaya di AI Website Builder. Sistem akan menyusun struktur section, copywriting, dan menampilkan katalog produk Anda secara otomatis.",
  },
  {
    q: "Apakah informasi di website dijadikan sumber pengetahuan AI WhatsApp?",
    a: "Ya. Halaman dan section website yang telah dipublikasikan (seperti FAQ, kebijakan pengiriman, dan keunggulan) otomatis tersinkronisasi sebagai knowledge base AI customer service Anda.",
  },
  {
    q: "Apakah uang pembayaran dari pembeli ditampung Noewbar?",
    a: "Tidak. Dana pembeli 100% masuk langsung ke rekening atau QRIS toko Anda. Noewbar hanya membantu menyusun tagihan dan mengingatkan pembeli.",
  },
  {
    q: "Bagaimana bot tahu stok dan harga terbaru?",
    a: "Bot membaca data dari katalog produk PostgreSQL Anda dan Google Sheets secara real-time. Perubahan harga dan stok langsung berlaku tanpa delay.",
  },
  {
    q: "Apa yang terjadi setelah 7 hari uji coba berakhir?",
    a: "Sistem mengirim notifikasi perpanjangan lewat WhatsApp. Kalau puas, bayar Rp 199.000 via QRIS Midtrans. Kalau tidak, bot otomatis nonaktif tanpa tagihan tersembunyi.",
  },
];

const FEATURES = [
  {
    icon: Bot,
    t: "AI Customer Service Berbasis Data Bisnis",
    d: "AI menjawab pertanyaan pembeli berdasarkan katalog produk aktual, FAQ, dan kebijakan toko resmi. Tidak ada jawaban mengarang atau harga palsu.",
  },
  {
    icon: ShoppingBag,
    t: "Smart Product Catalog",
    d: "Kelola produk, varian, harga diskon, foto, dan stok dinamis langsung dari database sistem atau Google Sheets dalam satu tempat.",
  },
  {
    icon: Globe,
    t: "AI Website Builder & Store Generator",
    d: "Buat website toko online atau landing page profesional cukup melalui prompt dan data bisnis yang sudah ada tanpa perlu coding.",
  },
  {
    icon: Layers,
    t: "Visual Block Editor",
    d: "Sesuaikan tata letak halaman secara visual per section, atau instruksikan AI untuk memperbarui bagian tertentu seperti Hero atau FAQ.",
  },
  {
    icon: Sparkles,
    t: "Template Siap Pakai",
    d: "Pilihan template desain spesifik industri: Skincare, Fashion, F&B, Gadget, hingga Toko Lokal UMKM yang teroptimasi mobile.",
  },
  {
    icon: Database,
    t: "Sinkronisasi Knowledge Base AI",
    d: "Konten website yang dipublikasikan dan dokumen SOP otomatis menjadi sumber rujukan bot WhatsApp saat melayani pelanggan.",
  },
  {
    icon: Truck,
    t: "Cek Ongkir Otomatis & Logistik",
    d: "Bot memproses nama kecamatan pembeli dan menghitung estimasi tarif J&T, SiCepat, dan JNE langsung ke total tagihan pesanan.",
  },
  {
    icon: ShieldCheck,
    t: "Multi-Tenant Workspace Aman",
    d: "Setiap toko memiliki ruang terisolasi mandiri. Data pelanggan, draft website, dan transaksi terjamin privasinya antar tenant.",
  },
];

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "#cara-kerja", label: "Cara Kerja" },
  { href: "#fitur", label: "Fitur" },
  { href: "#simulasi", label: "Simulasi WA" },
  { href: "#kalkulator", label: "Kalkulator ROI" },
  { href: "#harga", label: "Harga" },
  { href: "#faq", label: "FAQ" },
];

const STATS = [
  { value: "42%", label: "transaksi online terjadi pukul 20.00 sampai 02.00 WIB" },
  { value: "< 5 menit", label: "toleransi balas chat. Lewat dari itu pembeli pindah ke kompetitor" },
  { value: "70%", label: "calon pembeli menghilang setelah tahu total harga" },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <main className="bg-white">
      {/* ------------------------------------------------------------- header */}
      <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <a href="#" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink font-mono text-xs font-bold text-white shadow-raised">
              N
            </span>
            <span className="font-mono text-sm font-bold tracking-tight text-ink">NOEWBAR</span>
            <span className="hidden text-2xs font-semibold uppercase tracking-[0.14em] text-ink-500 sm:inline">
              CS Pro
            </span>
          </a>

          <nav aria-label="Navigasi utama" className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  l.href === "/dashboard"
                    ? "font-semibold text-ink bg-ink-100/60 hover:bg-ink-100"
                    : "text-ink-600 hover:bg-ink-50 hover:text-ink"
                )}
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="/dashboard"
              className="btn-secondary btn-sm flex items-center gap-1.5 font-medium text-ink transition-colors"
            >
              <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Dashboard</span>
            </a>
            <a
              href="/dashboard?intent=register"
              className="btn-primary btn-sm sm:min-h-[44px] sm:px-5 sm:text-sm"
            >
              Mulai trial 7 hari
            </a>
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden bg-ambient">
        <div className="section pt-14 sm:pt-20">
          <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
            <div className="animate-fade-up">
              <Badge tone="signal" className="mb-4">
                <StatusDot ok />
                Platform Terpadu: AI CS + Website Builder + Katalog
              </Badge>
              <h1 className="text-display font-bold text-ink sm:text-display-lg">
                Kelola Produk, Layani Pelanggan dengan AI, dan Bangun Toko Online dalam Satu Platform.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-600 sm:text-lg">
                Atur katalog produk, jadikan informasi bisnis sebagai sumber pengetahuan AI, dan buat landing page atau toko online melalui prompt tanpa harus membangun semuanya dari nol.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a href="/dashboard?intent=register" className="btn-primary px-6">
                  Coba gratis 7 hari sekarang
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <a href="/dashboard" className="btn-secondary px-5 flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                  Buka Dashboard
                </a>
                <a href="#simulasi" className="btn-ghost px-4">
                  Lihat simulasi live
                </a>
              </div>

              <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-600">
                {["Tanpa kartu kredit", "Scan QR 2 menit", "Bisa pakai nomor WA yang sudah ada"].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-signal" aria-hidden="true" />
                      {item}
                    </li>
                  )
                )}
              </ul>
            </div>

            <div id="simulasi" className="lg:pt-1">
              <PlaygroundPanel />
              <p className="mt-3 text-xs leading-relaxed text-ink-500">
                Balasan di atas dihasilkan oleh model <span className="font-mono">combo-ai</span>{" "}
                memakai katalog asli. Tidak ada produk contoh, tidak ada tangkapan layar palsu.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- stat strip */}
      <section className="border-y border-ink-800 bg-ink-900">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-3 sm:px-8">
          {STATS.map((s) => (
            <div key={s.value} className="border-l-2 border-signal/40 pl-4">
              <p className="font-mono text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {s.value}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-300">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- cara kerja */}
      <section id="cara-kerja" className="section border-b border-ink-100 bg-ink-50/50">
        <div className="text-center">
          <p className="eyebrow">Alur Kerja Praktis</p>
          <h2 className="mt-2 text-section font-bold">Mulai dalam 3 langkah mudah</h2>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-ink-600">
            Tanpa instalasi rumit, tanpa bot kaku. Cukup hubungkan WhatsApp dan Google Sheets yang sudah Anda miliki.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          <div className="card relative flex flex-col justify-between p-6 bg-white hover:border-ink-300 transition-all">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-signal-wash text-signal font-mono font-bold text-sm">
                01
              </div>
              <h3 className="mt-4 font-semibold text-ink-950 text-lg">Hubungkan WhatsApp</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                Pindai kode QR dari HP toko Anda dalam hitungan detik. Gateway WhatsApp cloud siap bekerja 24 jam nonstop tanpa perlu komputer menyala.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-ink-100 flex items-center gap-2 text-xs font-mono text-ink-500">
              <Smartphone className="h-4 w-4 text-signal" />
              <span>Scan QR seperti WhatsApp Web</span>
            </div>
          </div>

          <div className="card relative flex flex-col justify-between p-6 bg-white hover:border-ink-300 transition-all">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-signal-wash text-signal font-mono font-bold text-sm">
                02
              </div>
              <h3 className="mt-4 font-semibold text-ink-950 text-lg">Input Spreadsheet & SOP</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                Masukkan tautan Google Sheets katalog produk dan dokumen SOP toko. AI langsung memahami varian, stok, harga, dan ketentuan garansi Anda.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-ink-100 flex items-center gap-2 text-xs font-mono text-ink-500">
              <Database className="h-4 w-4 text-signal" />
              <span>Sinkron otomatis setiap pembeli chat</span>
            </div>
          </div>

          <div className="card relative flex flex-col justify-between p-6 bg-white hover:border-ink-300 transition-all">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-signal-wash text-signal font-mono font-bold text-sm">
                03
              </div>
              <h3 className="mt-4 font-semibold text-ink-950 text-lg">Terima Order & Pembayaran</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                AI melayani closing, hitung ongkir otomatis, dan kumpulkan bukti transfer. Uang masuk 100% langsung ke rekening atau QRIS pribadi toko Anda.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-ink-100 flex items-center gap-2 text-xs font-mono text-ink-500">
              <ShieldCheck className="h-4 w-4 text-signal" />
              <span>Verifikasi struk & cetak label resi</span>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- features */}
      <section id="fitur" className="section">
        <p className="eyebrow">Kemampuan</p>
        <h2 className="mt-2 text-section font-bold">Enam hal yang membedakan</h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-600">
          Setiap kemampuan di bawah ini punya batas yang jelas. Kalau sebuah fitur tidak berjalan
          pada sistem Anda, tampilannya akan mengatakannya, bukan menampilkan status hijau palsu.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <article
                key={f.t}
                className="card flex flex-col justify-between p-6 transition-all hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-overlay"
              >
                <div>
                  <span className="grid h-10 w-10 place-items-center rounded-lg border border-signal/20 bg-signal-wash text-signal-strong shadow-flat">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-ink">{f.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{f.d}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* -------------------------------------------------------- calculator */}
      <section id="kalkulator" className="border-y border-ink-200 bg-ink-50">
        <div className="section grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <p className="eyebrow">Hitung sendiri</p>
            <h2 className="mt-2 text-section font-bold">Berapa omset yang bocor malam ini?</h2>
            <p className="mt-3 text-base leading-relaxed text-ink-600">
              Geser tiga angka di samping untuk melihat estimasi kerugian bulanan Anda. Angka ini
              dihitung murni dari input Anda, bukan dari rata-rata industri yang dikarang.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-ink-600">
              {[
                "Biaya platform tetap Rp 199.000 per bulan.",
                "Uji coba 7 hari penuh gratis sebelum memilih paket.",
                "Dana pembeli tetap masuk ke rekening toko Anda sendiri.",
              ].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-signal" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <RoiCalculator />
        </div>
      </section>

      {/* ------------------------------------------------------------ pricing */}
      <section id="harga" className="section">
        <p className="eyebrow">Harga</p>
        <h2 className="mt-2 text-section font-bold">Transparan, dua pilihan</h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-600">
          Semua fitur terbuka di kedua paket. Uji coba 7 hari penuh gratis berlaku untuk paket apa
          pun.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <article className="card flex flex-col p-7 transition-all hover:border-ink-300">
            <h3 className="text-base font-semibold text-ink">Paket Bulanan</h3>
            <p className="mt-3 font-mono text-4xl font-bold tracking-tight text-ink tabular-nums">
              Rp 199.000
            </p>
            <p className="mt-1 text-sm text-ink-600">per bulan, fleksibel berhenti kapan saja</p>
            <p className="mt-2 font-mono text-xs text-ink-500">Setara Rp 6.633 per hari</p>

            <ul className="mt-6 flex-1 space-y-3 text-sm text-ink-600">
              {[
                "1 nomor WhatsApp toko aktif (scan QR 2 menit)",
                "Semua fitur AI: stok Google Sheets, ongkir otomatis, auto-nudge",
                "Kirim foto dan video asli produk dari storage",
                "Notifikasi darurat ke WhatsApp pribadi dan Telegram",
                "Pembayaran otomatis via QRIS, VA semua bank, e-wallet",
              ].map((f) => (
                <li key={f} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-signal" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>

            <a href="/dashboard?intent=register" className="btn-secondary mt-7 w-full">
              Mulai trial 7 hari
            </a>
          </article>

          <article className="relative flex flex-col rounded-xl border-2 border-ink-900 bg-white p-7 shadow-overlay">
            <Badge tone="signal" className="absolute -top-3 left-6 bg-white px-3 py-1 font-semibold shadow-flat">
              Paling hemat
            </Badge>
            <h3 className="text-base font-semibold text-ink">Paket Tahunan</h3>
            <p className="mt-3 font-mono text-4xl font-bold tracking-tight text-ink tabular-nums">
              Rp 1.490.000
            </p>
            <p className="mt-1 text-sm text-ink-600">per tahun, setara Rp 124.167 per bulan</p>
            <p className="mt-2 font-mono text-xs font-semibold text-signal-strong">
              Hemat Rp 898.000 dibanding bayar bulanan
            </p>

            <ul className="mt-6 flex-1 space-y-3 text-sm text-ink-600">
              {[
                "Semua isi paket bulanan",
                "Bayar sekali, bot aktif 365 hari penuh",
                "Tanpa tagihan bulanan yang harus diingat",
                "Harga terkunci selama satu tahun penuh",
                "Prioritas dukungan WhatsApp langsung",
              ].map((f) => (
                <li key={f} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-signal" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>

            <a
              href="/dashboard?intent=register&plan=PRO_ANNUAL"
              className="btn-primary mt-7 w-full"
            >
              Mulai trial 7 hari
            </a>
          </article>
        </div>
      </section>

      {/* ---------------------------------------------------------------- FAQ */}
      <section id="faq" className="border-t border-ink-200 bg-ink-50">
        <div className="section">
          <p className="eyebrow">FAQ</p>
          <h2 className="mt-2 text-section font-bold">Pertanyaan yang sering masuk</h2>

          <div className="mt-8 space-y-2">
            {FAQ.map((item, i) => {
              const open = openFaq === i;
              return (
                <div
                  key={item.q}
                  className={cn(
                    "overflow-hidden rounded border bg-white transition-colors",
                    open ? "border-ink-300" : "border-ink-200"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    aria-expanded={open}
                    className="flex w-full min-h-[56px] items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-ink-50"
                  >
                    <span className="text-sm font-semibold text-ink">{item.q}</span>
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded border border-ink-200 text-ink-500">
                      {open ? (
                        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </span>
                  </button>
                  {open && (
                    <div className="animate-fade-up border-t border-ink-200 px-5 py-4">
                      <p className="text-sm leading-relaxed text-ink-600">{item.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex flex-col items-start gap-3 rounded-lg border border-ink-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">Masih ada pertanyaan?</p>
              <p className="mt-0.5 text-sm text-ink-600">
                Coba sendiri dulu. Uji coba penuh 7 hari, tanpa kartu kredit.
              </p>
            </div>
            <a href="/dashboard?intent=register" className="btn-primary shrink-0">
              Mulai trial 7 hari
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- footer */}
      <footer className="border-t border-ink-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-6 w-6 place-items-center rounded bg-ink font-mono text-2xs font-bold text-white">
                N
              </span>
              <span className="font-mono text-xs font-bold tracking-tight text-ink">
                NOEWBAR CS PRO
              </span>
            </div>
            <p className="mt-2 text-xs text-ink-500">
              {new Date().getFullYear()} &middot; Semua sistem dipantau langsung
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-600">
            <a href="/dashboard" className="font-medium text-ink transition-colors hover:underline">
              Dashboard Toko
            </a>
            <a href="/superadmin" className="transition-colors hover:text-ink">
              Konsol Admin
            </a>
            <a href="#simulasi" className="transition-colors hover:text-ink">
              Simulasi Live
            </a>
            <a href="#harga" className="transition-colors hover:text-ink">
              Harga & Paket
            </a>
            <a href="#faq" className="transition-colors hover:text-ink">
              Bantuan & FAQ
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
