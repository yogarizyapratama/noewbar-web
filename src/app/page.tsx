'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  ShieldCheck,
  Radar,
  FileSpreadsheet,
  Layers,
  Bot,
  ReceiptText,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  MessageSquare,
  ChevronDown,
  Check,
  Lock,
  RefreshCw,
  Send,
  Smartphone,
  Zap,
  BarChart3,
  CheckCheck,
} from 'lucide-react';

export default function HomePage() {
  // Calculator state
  const [dailyHours, setDailyHours] = useState(4);
  const [staffCount, setStaffCount] = useState(2);
  const [riskLoss, setRiskLoss] = useState(1500000); // Estimasi potensi rugi struk palsu/salah input per bulan

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    businessName: '',
    whatsapp: '',
    serviceInterest: 'Noewbar Kasir Guard (Anti-Struk Palsu)',
    notes: '',
  });
  const [formStatus, setFormStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // Interactive Simulator Tab state
  const [activeDemo, setActiveDemo] = useState<'kasir' | 'nota' | 'stock'>('kasir');
  const [simStep, setSimStep] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState(false);

  // FAQ state
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Calculated ROI
  const hoursSavedPerMonth = dailyHours * staffCount * 26;
  const staffCostSaved = hoursSavedPerMonth * 35000; // Asumsi biaya tenaga kerja Rp35rb/jam
  const totalSavings = staffCostSaved + riskLoss;

  const handleSelectService = (serviceTitle: string) => {
    setFormData((prev) => ({ ...prev, serviceInterest: serviceTitle }));
    const formElement = document.getElementById('konsultasi');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleRunSim = () => {
    setIsSimulating(true);
    setSimStep(1);
    setTimeout(() => {
      setSimStep(2);
      setIsSimulating(false);
    }, 1200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus('loading');
    setStatusMessage('');

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (res.ok) {
        setFormStatus('success');
        setStatusMessage(
          'Permintaan konsultasi berhasil tercatat. Tim teknis Noewbar akan segera menghubungi WhatsApp Anda dalam hitungan jam kerja untuk demo langsung.'
        );
        setFormData({
          name: '',
          businessName: '',
          whatsapp: '',
          serviceInterest: 'Noewbar Kasir Guard (Anti-Struk Palsu)',
          notes: '',
        });
      } else {
        setFormStatus('error');
        setStatusMessage(data.error || 'Terjadi kendala saat mengirim. Silakan coba lagi atau hubungi via WhatsApp.');
      }
    } catch {
      setFormStatus('error');
      setStatusMessage('Gagal terhubung ke server. Silakan hubungi nomor WhatsApp resmi kami langsung.');
    }
  };

  const services = [
    {
      id: 'kasir-guard',
      title: 'Noewbar Kasir Guard',
      tagline: 'Anti-Struk Palsu & Instant Mutasi Bank via WhatsApp',
      badge: 'Best Seller Retail',
      badgeColor: 'border-sky-500/30 text-sky-400 bg-sky-950/40',
      icon: ShieldCheck,
      iconColor: 'text-sky-400',
      category: 'Keuangan & Kasir',
      problem:
        'Kasir tertipu struk m-banking palsu hasil edit Canva saat antrean ramai. Barang sudah dibawa pembeli sebelum dana dicek.',
      solution:
        'Kasir foto struk ke bot WhatsApp toko. AI membaca nomor referensi & nominal lalu mencocokkan detik itu juga dengan mutasi rekening riil bank toko.',
      turnaround: 'Respon 3 detik di kasir',
      setupPrice: 'Rp2.000.000',
      monthlyPrice: 'Rp500.000 / bulan',
      features: [
        'Dukungan mutasi otomatis BCA, Mandiri, BRI, & BNI',
        'Notifikasi status seketika (✅ VALID / ❌ REKENING BELUM MASUK)',
        'Zero-Risk Security: Hanya hak baca mutasi (read-only), tanpa PIN/transfer',
        'Tanpa perlu ganti mesin kasir atau software POS yang ada',
      ],
    },
    {
      id: 'omnichannel-stock',
      title: 'Noewbar Stock Guard',
      tagline: 'Sinkronisasi Otomatis Shopee, TikTok Shop & Toko Fisik',
      badge: 'Pencegah Penalti',
      badgeColor: 'border-blue-500/30 text-blue-400 bg-blue-950/40',
      icon: Layers,
      iconColor: 'text-blue-400',
      category: 'Inventory Marketplace',
      problem:
        'Barang laku di toko fisik tapi admin lupa update stok di Shopee/TikTok Shop. Pembeli checkout online lalu toko kena penalti poin & pembatalan pesanan.',
      solution:
        'Begitu kasir scan barcode barang terjual di toko atau di 1 marketplace, bot otomatis memotong stok di platform lainnya dalam 10 detik secara real-time.',
      turnaround: 'Sinkronisasi tiap 10 detik',
      setupPrice: 'Rp2.500.000',
      monthlyPrice: 'Rp650.000 / bulan',
      features: [
        'Koneksi resmi API Shopee, TikTok Shop, & Tokopedia',
        'Mencegah overselling dan rating toko turun akibat pembatalan',
        'Notifikasi WhatsApp jika stok barang menipis (<5 pcs)',
        'Termasuk panduan pemetaan SKU produk yang rapi',
      ],
    },
    {
      id: 'nota-vision',
      title: 'Noewbar Nota Vision',
      tagline: 'OCR Bon Kertas Tulisan Tangan ke Excel & Sheets',
      badge: 'Grosir & Gudang',
      badgeColor: 'border-cyan-500/30 text-cyan-400 bg-cyan-950/40',
      icon: FileSpreadsheet,
      iconColor: 'text-cyan-400',
      category: 'Administrasi Toko',
      problem:
        'Bon penjualan toko bangunan/grosir masih ditulis tangan pulpen. Admin lembur 3-4 jam tiap malam mengetik ulang ke Excel dengan risiko salah angka.',
      solution:
        'Admin foto tumpukan nota dari kamera ponsel. AI OCR Noewbar mengekstrak nama barang, kuantiti, harga satuan, dan diskon ke tabel Excel terstruktur.',
      turnaround: 'Proses <10 detik per lembar',
      setupPrice: 'Rp2.000.000',
      monthlyPrice: 'Rp500.000 / bulan',
      features: [
        'Dukungan tulisan tangan latin & angka pena Indonesia',
        'Sinkronisasi otomatis ke Google Sheets / file Excel harian',
        'Deteksi selisih kalkulasi harga satuan x qty vs total nota',
        'Bisa diintegrasikan ke Accurate, Zahir, atau database ERP lokal',
      ],
    },
    {
      id: 'radar-tender',
      title: 'Noewbar Radar Tender',
      tagline: 'Intelijen Dokumen KAK Pengadaan LPSE se-Indonesia',
      badge: 'Kontraktor & Vendor',
      badgeColor: 'border-indigo-500/30 text-indigo-400 bg-indigo-950/40',
      icon: Radar,
      iconColor: 'text-indigo-400',
      category: 'B2B & Pengadaan',
      problem:
        'Dokumen Kerangka Acuan Kerja (KAK) LPSE tebalnya puluhan halaman PDF. Tim tender lelah membaca manual dan sering terlewat batas waktu sanggah/penawaran.',
      solution:
        'Bot memantau LPSE target setiap pkl 06.00 WIB. AI membedah isi KAK dan mengirimkan 5 poin krusial langsung ke WhatsApp direksi.',
      turnaround: 'Laporan harian pkl 06.00 WIB',
      setupPrice: 'Rp2.500.000',
      monthlyPrice: 'Rp750.000 / bulan',
      features: [
        'Penyaringan lelang otomatis sesuai izin KBLI & kapasitas modal',
        'Ringkasan HPS, syarat sertifikasi personil/alat & timeline',
        'Deteksi paket pengadaan baru di kabupaten/kota target',
        'Hemat puluhan jam membaca dokumen PDF teknis',
      ],
    },
    {
      id: 'reseller-dispatcher',
      title: 'Noewbar Reseller Bot',
      tagline: 'CS WhatsApp 24/7, Cek Ongkir Otomatis & Rekap Order',
      badge: 'Dropship & Supplier',
      badgeColor: 'border-emerald-500/30 text-emerald-400 bg-emerald-950/40',
      icon: Bot,
      iconColor: 'text-emerald-400',
      category: 'Customer Service',
      problem:
        'Ratusan reseller tanya ongkir tengah malam, tanya stok berulang kali, dan minta totalan saat admin sudah di luar jam kerja. Penjualan hilang ke kompetitor.',
      solution:
        'Bot WhatsApp cerdas melayani pertanyaan reseller 24 jam. Otomatis cek ongkir semua kurir (JNE, J&T, SiCepat), totalan belanja, dan instruksi bayar.',
      turnaround: 'Balas otomatis <2 detik',
      setupPrice: 'Rp2.200.000',
      monthlyPrice: 'Rp550.000 / bulan',
      features: [
        'Kalkulasi ongkir real-time ke seluruh kecamatan di Indonesia',
        'Pengecekan ketersediaan stok produk langsung dari database',
        'Pembuatan format rekap pesanan otomatis untuk tim packing',
        'Bisa dioperasikan bersamaan oleh CS manusia (human takeover)',
      ],
    },
    {
      id: 'tagihan-autopilot',
      title: 'Noewbar Tagihan Autopilot',
      tagline: 'Pengingat Piutang & Jatuh Tempo Sopan Berjenjang',
      badge: 'Cashflow Protection',
      badgeColor: 'border-amber-500/30 text-amber-400 bg-amber-950/40',
      icon: ReceiptText,
      iconColor: 'text-amber-400',
      category: 'Koleksi Piutang',
      problem:
        'Piutang toko/distributor macet karena staf sungkan menagih berulang kali, atau lupa tanggal jatuh tempo faktur pelanggan.',
      solution:
        'Sistem WhatsApp otomatis mengirim pengingat bertahap H-3, hari H, dan H+3 dengan bahasa bisnis santun, lampiran rincian nota, dan instruksi transfer.',
      turnaround: 'Jadwal otomatis harian',
      setupPrice: 'Rp1.800.000',
      monthlyPrice: 'Rp450.000 / bulan',
      features: [
        'Pengingat berjenjang otomatis tanpa rasa canggung personal',
        'Rincian nomor faktur, tanggal beli, dan sisa nominal belum lunas',
        'Meningkatkan angka pelunasan tempo tepat waktu hingga 85%',
        'Laporan rekap piutang tertagih terkirim harian ke pemilik toko',
      ],
    },
  ];

  const trustPillars = [
    {
      icon: ShieldCheck,
      title: 'Garansi 100% Uang Kembali (SLA 48 Jam)',
      desc: 'Sistem bot kami diuji bersama tim Anda hingga berjalan lancar. Jika dalam 7 hari tidak sesuai spesifikasi yang dijanjikan, biaya setup dikembalikan 100% tanpa potongan.',
    },
    {
      icon: Lock,
      title: 'Keamanan Rekening Zero-Access',
      desc: 'Bot kasir hanya menggunakan integrasi Read-Only Mutasi Statement. Kami tidak pernah meminta hak transfer, PIN m-banking, maupun akses transaksi keluar rekening Anda.',
    },
    {
      icon: Smartphone,
      title: 'Berjalan di WhatsApp Toko Sendiri',
      desc: 'Tidak ada aplikasi rumit baru yang harus diinstall di HP kasir yang membuat mereka bingung. Karyawan berinteraksi langsung di WhatsApp yang sudah mereka kenal setiap hari.',
    },
    {
      icon: RefreshCw,
      title: 'Uptime 99.8% & Pemeliharaan Server Penuh',
      desc: 'Biaya langganan bulanan mencakup biaya cloud hosting mandiri, pemeliharaan perubahan API bank/marketplace, dan tim engineer siaga jika terjadi kendala.',
    },
  ];

  const steps = [
    {
      num: '01',
      title: 'Konsultasi Alur Singkat (15 Menit)',
      desc: 'Kami mendengarkan alur manual bisnis Anda via telepon/WhatsApp untuk memastikan bot mana yang tepat dan tidak salah sasaran.',
    },
    {
      num: '02',
      title: 'Setup & Integrasi Server (24 Jam)',
      desc: 'Tim engineer Noewbar mengonfigurasi bot, integrasi webhook bank/marketplace, dan format balasan sesuai identitas brand Anda.',
    },
    {
      num: '03',
      title: 'Uji Coba Bersama Kasir / Admin',
      desc: 'Kami melakukan simulasi transaksi riil bersama staf Anda untuk memastikan bot mudah digunakan tanpa salah pengertian.',
    },
    {
      num: '04',
      title: 'Go-Live & Pendampingan Penuh',
      desc: 'Sistem aktif 24/7. Anda mendapatkan grup WhatsApp prioritas dengan tim teknis Noewbar untuk dukungan operasional.',
    },
  ];

  const faqs = [
    {
      q: 'Apakah bot Noewbar aman untuk rekening toko saya?',
      a: 'Sangat aman. Untuk Noewbar Kasir Guard, integrasi perbankan hanya menggunakan izin Read-Only Mutasi (membaca riwayat dana masuk). Noewbar tidak memiliki hak dan tidak akan pernah meminta kredensial transfer, PIN transaksi, atau OTP Anda. Uang Anda tetap 100% aman di kendali Anda.',
    },
    {
      q: 'Apakah kasir atau staf saya yang gaptek bisa menggunakannya?',
      a: 'Tentu. Filosofi Noewbar adalah Zero-Learning Curve. Kasir cukup mengirim foto struk ke kontak WhatsApp toko seperti mengirim foto ke teman. Bot akan membalas otomatis dalam hitungan 3 detik dengan status hijau/merah yang sangat jelas dipahami.',
    },
    {
      q: 'Berapa lama proses pemasangan sampai bot bisa digunakan?',
      a: 'Setelah konsultasi dan data rekening/toko disiapkan, bot siap digunakan dalam waktu 24 hingga 48 jam kerja. Kami memberikan garansi SLA penyiapan tepat waktu.',
    },
    {
      q: 'Bagaimana jika format nota toko kami unik atau tulisan tangan agak acak?',
      a: 'Noewbar Nota Vision dilatih menggunakan model visi berbasis OCR kontekstual. Sebelum go-live, kami meminta 10 sampel foto nota fisik toko Anda untuk penyesuaian (*fine-tuning*) agar akurasi pembacaan mencapai lebih dari 95%.',
    },
    {
      q: 'Apakah ada kontrak mengikat tahunan yang memberatkan?',
      a: 'Tidak ada. Kami menerapkan sistem Setup Awal + Retainer Bulanan tanpa komitmen kontrak tahunan yang mengikat. Anda bebas berhenti kapan saja jika merasa operasional tidak lagi membutuhkan layanan kami.',
    },
    {
      q: 'Bagaimana jika terjadi kendala teknis atau API bank berubah?',
      a: 'Biaya langganan bulanan menjamin Anda terbebas dari pusing teknis. Jika sistem bank mengubah format mutasi atau API marketplace melakukan update versi, tim engineer Noewbar yang akan memperbaiki kodenya di server secara berkala.',
    },
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#070A12] text-slate-100 selection:bg-sky-600 selection:text-white">
      {/* 1. Top Announcement Bar */}
      <div className="bg-gradient-to-r from-sky-950 via-slate-900 to-sky-950 border-b border-sky-800/30 text-xs py-2 px-4 text-center font-medium text-sky-200">
        <span className="inline-flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
          Garansi SLA 48 Jam Go-Live: Otomasi siap pakai tanpa risiko. Biaya setup kembali 100% jika bot tidak sesuai spesifikasi.
        </span>
      </div>

      {/* 2. Header / Navigation */}
      <header className="sticky top-0 z-50 bg-[#070A12]/95 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="#" className="flex items-center gap-3 group">
              <Image
                src="/logo.png"
                alt="Noewbar Automation"
                width={138}
                height={34}
                className="h-8 sm:h-9 w-auto object-contain transition-transform group-hover:scale-[1.02]"
                priority
              />
              <span className="text-[11px] px-2 py-0.5 rounded bg-sky-950/80 text-sky-300 font-mono font-semibold border border-sky-800/60 hidden sm:inline-block">
                SOLUSI JADI
              </span>
            </a>
          </div>

          <nav className="hidden lg:flex items-center gap-7 text-xs sm:text-sm font-medium text-slate-300">
            <a href="#solusi" className="hover:text-sky-400 transition-colors">6 Menu Bot</a>
            <a href="#demo-simulator" className="hover:text-sky-400 transition-colors">Live Demo</a>
            <a href="#kalkulator" className="hover:text-sky-400 transition-colors">Kalkulator Hemat</a>
            <a href="#kepercayaan" className="hover:text-sky-400 transition-colors">Garansi & Keamanan</a>
            <a href="#alur" className="hover:text-sky-400 transition-colors">Alur Kerja</a>
            <a href="#faq" className="hover:text-sky-400 transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="#konsultasi"
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold bg-sky-600 hover:bg-sky-500 text-white px-4 sm:px-5 py-2.5 rounded-lg transition-all shadow-lg shadow-sky-600/20 focus-visible:ring-2 focus-visible:ring-sky-400 min-h-[44px]"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Konsultasi Cepat</span>
            </a>
          </div>
        </div>
      </header>

      {/* 3. Hero Section */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        {/* Background glow tailored to brand electric blue */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-sky-600/10 blur-[120px] rounded-full pointer-events-none -z-10"></div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-sky-800/50 text-sky-300 text-xs font-mono uppercase tracking-wider mb-8">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
          Productized AI Automation untuk Bisnis Riil Indonesia
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight max-w-4xl mx-auto leading-[1.18] sm:leading-[1.15] mb-6">
          Hentikan Kebocoran Kas & Pangkas Jam Lembur dengan{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-sky-200 to-blue-400">
            Bot Otomasi Siap Pakai
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed mb-10">
          Noewbar memasang sistem otomasi cerdas terstandarisasi untuk pencegahan struk palsu, sinkronisasi stok marketplace, intelijen lelang LPSE, dan rekap nota otomatis via WhatsApp.
          <br className="hidden sm:inline" /> Sekali pasang, aktif dalam 24–48 jam tanpa perlu merekrut tim IT bergaji mahal.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
          <a
            href="#solusi"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold px-6 py-3.5 rounded-lg text-sm transition-all shadow-lg shadow-sky-600/25 min-h-[44px]"
          >
            <span>Pilih 6 Menu Bot Siap Pakai</span>
            <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="#demo-simulator"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 font-medium px-6 py-3.5 rounded-lg text-sm transition-colors min-h-[44px]"
          >
            <Smartphone className="w-4 h-4 text-sky-400" />
            <span>Coba Live Demo Bot</span>
          </a>
        </div>

        {/* Value Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-4xl mx-auto text-left">
          <div className="bg-[#0B0F19] border border-slate-800/80 p-5 rounded-xl">
            <div className="text-2xl font-bold font-mono text-white mb-1">24–48 Jam</div>
            <div className="text-xs text-slate-400 leading-normal">Waktu setup hingga aktif digunakan kasir/admin</div>
          </div>
          <div className="bg-[#0B0F19] border border-slate-800/80 p-5 rounded-xl">
            <div className="text-2xl font-bold font-mono text-emerald-400 mb-1">100% Garansi</div>
            <div className="text-xs text-slate-400 leading-normal">Uang kembali jika bot tidak sesuai janji spesifikasi</div>
          </div>
          <div className="bg-[#0B0F19] border border-slate-800/80 p-5 rounded-xl">
            <div className="text-2xl font-bold font-mono text-sky-400 mb-1">0 Aplikasi Baru</div>
            <div className="text-xs text-slate-400 leading-normal">Cukup operasikan lewat WhatsApp rutin toko Anda</div>
          </div>
          <div className="bg-[#0B0F19] border border-slate-800/80 p-5 rounded-xl">
            <div className="text-2xl font-bold font-mono text-slate-200 mb-1">3 Detik</div>
            <div className="text-xs text-slate-400 leading-normal">Kecepatan validasi mutasi real-time di meja kasir</div>
          </div>
        </div>
      </section>

      {/* 4. Interactive Live Bot Simulator Section (High Trust Proof) */}
      <section id="demo-simulator" className="py-20 bg-[#0A0E1A] border-y border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-sky-950 text-sky-400 text-xs font-mono font-medium mb-3 border border-sky-800/60">
              <Zap className="w-3.5 h-3.5" />
              SIMULASI INTERAKTIF
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Lihat Cara Kerja Bot di Layar WhatsApp
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Uji coba respons instan bot Noewbar secara interaktif sebelum Anda memutuskan memasangnya di toko.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Control Panel Tabs */}
            <div className="lg:col-span-5 space-y-3">
              <button
                type="button"
                onClick={() => {
                  setActiveDemo('kasir');
                  setSimStep(0);
                }}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  activeDemo === 'kasir'
                    ? 'bg-sky-950/40 border-sky-500/60 shadow-md shadow-sky-950'
                    : 'bg-[#0B0F19] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-sky-400" />
                    Kasir Guard (Anti-Struk Palsu)
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-900/60 text-sky-300">
                    Respon 3 Detik
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Kasir kirim foto bukti transfer pembeli. Bot membaca dan mencocokkan mutasi rekening BCA/Mandiri/BRI riil.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveDemo('stock');
                  setSimStep(0);
                }}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  activeDemo === 'stock'
                    ? 'bg-sky-950/40 border-sky-500/60 shadow-md shadow-sky-950'
                    : 'bg-[#0B0F19] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    Stock Guard (Sync Marketplace)
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-900/60 text-blue-300">
                    Sync Otomatis
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Kasir catat barang terjual di toko fisik. Bot otomatis potong stok di Shopee & TikTok Shop agar tidak overselling.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveDemo('nota');
                  setSimStep(0);
                }}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  activeDemo === 'nota'
                    ? 'bg-sky-950/40 border-sky-500/60 shadow-md shadow-sky-950'
                    : 'bg-[#0B0F19] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                    Nota Vision (OCR Bon ke Excel)
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-900/60 text-cyan-300">
                    Akurasi &gt;95%
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Foto bon kertas tulisan tangan pensil/pena langsung diubah menjadi baris spreadsheet Excel terformat rapi.
                </p>
              </button>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleRunSim()}
                  disabled={isSimulating}
                  className="w-full inline-flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white font-semibold py-3 px-4 rounded-lg text-sm transition-all"
                >
                  {isSimulating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-sky-200" />
                      <span>Bot Sedang Memverifikasi...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>
                        {activeDemo === 'kasir' && 'Kirim Contoh Struk (Rp450.000)'}
                        {activeDemo === 'stock' && 'Simulasi Transaksi Toko Fisik (1 Pcs)'}
                        {activeDemo === 'nota' && 'Simulasi Upload Bon Pensil'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Interactive WhatsApp Smartphone Mockup */}
            <div className="lg:col-span-7 flex justify-center">
              <div className="w-full max-w-md bg-[#0D121F] border-2 border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                {/* Phone Header */}
                <div className="bg-[#111928] px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-sky-600 flex items-center justify-center text-white font-bold text-sm">
                      N
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                        Noewbar Official Bot
                        <CheckCheck className="w-3.5 h-3.5 text-sky-400" />
                      </div>
                      <div className="text-[11px] text-emerald-400 font-mono">● Online 24 Jam</div>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">Server SG-1</span>
                </div>

                {/* WhatsApp Chat Canvas */}
                <div className="p-4 space-y-4 min-h-[340px] bg-[#070A12]/90 flex flex-col justify-end text-xs">
                  {/* Kasir Guard Demo Flow */}
                  {activeDemo === 'kasir' && (
                    <>
                      <div className="self-end bg-sky-700 text-white p-3 rounded-2xl rounded-br-none max-w-[85%] shadow-sm">
                        <div className="flex items-center gap-1.5 font-semibold text-[11px] mb-1">
                          <Smartphone className="w-3.5 h-3.5" /> Kasir Toko mengirim:
                        </div>
                        <div className="bg-sky-900/70 p-2 rounded border border-sky-600/50 text-[11px] font-mono mb-1">
                          📷 [Foto Struk M-Banking BCA.jpg]
                        </div>
                        <p className="text-[11px]">Cek min, pembeli bilang sudah transfer Rp450.000 atas nama Rian Pratama.</p>
                        <span className="text-[9px] text-sky-200 block text-right mt-1">18:14</span>
                      </div>

                      {simStep >= 1 && (
                        <div className="self-start bg-[#111827] border border-slate-800 text-slate-300 p-3 rounded-2xl rounded-bl-none max-w-[88%] shadow-sm">
                          {simStep === 1 ? (
                            <div className="flex items-center gap-2 text-sky-400 py-1 font-mono">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Membaca OCR & mencocokkan mutasi bank...</span>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="inline-flex items-center gap-1 text-emerald-400 font-bold font-mono text-xs">
                                <CheckCircle2 className="w-4 h-4" /> ✅ MUTASI VALID DITEMUKAN
                              </div>
                              <p className="text-slate-200 font-mono text-[11px] leading-relaxed">
                                • Bank: <b>BCA Bisnis (xxx-412)</b>
                                <br />• Nominal: <b>Rp450.000 (PAS)</b>
                                <br />• Pengirim: <b>RIAN PRATAMA</b>
                                <br />• No. Referensi: <b>20261009008271</b>
                                <br />• Waktu Masuk: <b>18:13:58 WIB</b>
                              </p>
                              <div className="p-1.5 rounded bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-[10px] font-medium">
                                👉 Kasir AMAN menyerahkan barang ke pelanggan.
                              </div>
                              <span className="text-[9px] text-slate-500 block text-right">18:14</span>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Stock Sync Demo Flow */}
                  {activeDemo === 'stock' && (
                    <>
                      <div className="self-end bg-sky-700 text-white p-3 rounded-2xl rounded-br-none max-w-[85%] shadow-sm">
                        <div className="font-semibold text-[11px] mb-1">Kasir Toko Fisik:</div>
                        <p className="text-[11px]">
                          Scan Barcode Penjualan: <b>Kemeja Oxford Navy (Size L)</b> terjual 1 pcs.
                        </p>
                        <span className="text-[9px] text-sky-200 block text-right mt-1">14:02</span>
                      </div>

                      {simStep >= 1 && (
                        <div className="self-start bg-[#111827] border border-slate-800 text-slate-300 p-3 rounded-2xl rounded-bl-none max-w-[88%] shadow-sm">
                          {simStep === 1 ? (
                            <div className="flex items-center gap-2 text-sky-400 py-1 font-mono">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Mengirim webhook pembaruan stok ke marketplace...</span>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="inline-flex items-center gap-1 text-sky-400 font-bold font-mono text-xs">
                                <CheckCircle2 className="w-4 h-4" /> 🔄 SYNC MARKETPLACE BERHASIL
                              </div>
                              <p className="text-slate-200 font-mono text-[11px] leading-relaxed">
                                • SKU: <b>KMJ-OXF-NVY-L</b>
                                <br />• Shopee: <b>Stok 5 ➔ 4</b> (Updated)
                                <br />• TikTok Shop: <b>Stok 5 ➔ 4</b> (Updated)
                                <br />• Tokopedia: <b>Stok 5 ➔ 4</b> (Updated)
                              </p>
                              <div className="p-1.5 rounded bg-sky-950/60 border border-sky-800/60 text-sky-300 text-[10px] font-medium">
                                🛡️ Mencegah dobel order & penalti pembatalan.
                              </div>
                              <span className="text-[9px] text-slate-500 block text-right">14:02</span>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Nota Vision Demo Flow */}
                  {activeDemo === 'nota' && (
                    <>
                      <div className="self-end bg-sky-700 text-white p-3 rounded-2xl rounded-br-none max-w-[85%] shadow-sm">
                        <div className="font-semibold text-[11px] mb-1">Admin Gudang:</div>
                        <div className="bg-sky-900/70 p-2 rounded border border-sky-600/50 text-[11px] font-mono mb-1">
                          📷 [Foto Nota Pensil Toko Bangunan.jpg]
                        </div>
                        <p className="text-[11px]">Tolong rekap nota belanjaan proyek Pak Hendra ya.</p>
                        <span className="text-[9px] text-sky-200 block text-right mt-1">16:45</span>
                      </div>

                      {simStep >= 1 && (
                        <div className="self-start bg-[#111827] border border-slate-800 text-slate-300 p-3 rounded-2xl rounded-bl-none max-w-[88%] shadow-sm">
                          {simStep === 1 ? (
                            <div className="flex items-center gap-2 text-cyan-400 py-1 font-mono">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Mengekstrak baris tulisan tangan ke tabel Excel...</span>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="inline-flex items-center gap-1 text-cyan-400 font-bold font-mono text-xs">
                                <CheckCircle2 className="w-4 h-4" /> 📊 REKAP NOTA TERSINKRONISASI
                              </div>
                              <p className="text-slate-200 font-mono text-[11px] leading-relaxed">
                                • Nota #: <b>0842 (Toko Sentosa)</b>
                                <br />1. Semen Padang 10 Sak @ 68rb = 680rb
                                <br />2. Cat Tembok Dulux 2 Pail = 480rb
                                <br />3. Paku 5cm 3 Kg = 60rb
                                <br /><b>Total: Rp1.220.000</b>
                              </p>
                              <div className="p-1.5 rounded bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 text-[10px] font-medium">
                                📁 Masuk otomatis ke Google Sheet harian toko.
                              </div>
                              <span className="text-[9px] text-slate-500 block text-right">16:45</span>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Phone Bottom Footer */}
                <div className="bg-[#111928] p-3 border-t border-slate-800 text-center">
                  <span className="text-[11px] text-slate-400">
                    Klik tombol <b>Simulasi</b> di sisi kiri untuk mencoba interaksi
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. 6 Productized Bot Services Grid */}
      <section id="solusi" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-sky-950 text-sky-400 text-xs font-mono font-medium mb-3 border border-sky-800/60">
            <Sparkles className="w-3.5 h-3.5" />
            KATALOG BOT TERSTANDARISASI
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            6 Pilihan Bot Otomasi Teruji
          </h2>
          <p className="text-base text-slate-400 mt-3">
            Bukan jasa konsultasi umum. Pilih paket solusi terdefinisi tegas dengan biaya setup sekali bayar dan pemeliharaan bulanan yang transparan.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((srv) => {
            const Icon = srv.icon;
            return (
              <div
                key={srv.id}
                className="bg-[#0B0F19] border border-slate-800 rounded-2xl p-6 sm:p-7 flex flex-col justify-between hover:border-sky-500/50 transition-all hover:shadow-xl hover:shadow-sky-950/30 group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-[11px] font-mono px-2.5 py-1 rounded-md border font-semibold ${srv.badgeColor}`}>
                      {srv.badge}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">{srv.category}</span>
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center group-hover:border-sky-500/40 transition-colors">
                      <Icon className={`w-5 h-5 ${srv.iconColor}`} />
                    </div>
                    <h3 className="text-lg font-bold text-white group-hover:text-sky-300 transition-colors">
                      {srv.title}
                    </h3>
                  </div>

                  <p className="text-xs font-medium text-slate-300 mb-6 leading-relaxed">
                    {srv.tagline}
                  </p>

                  {/* Problem vs Solution Card */}
                  <div className="space-y-3 mb-6 text-xs">
                    <div className="bg-rose-950/20 border border-rose-900/40 p-3 rounded-lg text-rose-200/90 leading-relaxed">
                      <span className="font-semibold text-rose-400 block mb-0.5">⚠️ Masalah Lapangan:</span>
                      {srv.problem}
                    </div>
                    <div className="bg-sky-950/20 border border-sky-900/40 p-3 rounded-lg text-sky-200/90 leading-relaxed">
                      <span className="font-semibold text-sky-400 block mb-0.5">💡 Solusi Noewbar:</span>
                      {srv.solution}
                    </div>
                  </div>

                  {/* Features List */}
                  <div className="space-y-2 mb-6">
                    {srv.features.map((feat, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                        <Check className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                        <span className="leading-normal">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pricing & Order CTA */}
                <div className="border-t border-slate-800/80 pt-5 mt-2">
                  <div className="flex items-baseline justify-between mb-4">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-mono">Setup Awal</span>
                      <span className="text-base font-bold text-white font-mono">{srv.setupPrice}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block uppercase font-mono">Retainer Server</span>
                      <span className="text-xs font-semibold text-sky-400 font-mono">{srv.monthlyPrice}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelectService(srv.title)}
                    className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-sky-600 text-slate-200 hover:text-white font-semibold py-2.5 px-4 rounded-lg text-xs transition-colors border border-slate-700 hover:border-sky-500 min-h-[44px]"
                  >
                    <span>Pasang Bot Ini</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. Interactive ROI & Cost Savings Calculator */}
      <section id="kalkulator" className="py-20 bg-[#090D18] border-y border-slate-800/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-sky-950 text-sky-400 text-xs font-mono font-medium mb-3 border border-sky-800/60">
              <BarChart3 className="w-3.5 h-3.5" />
              KALKULATOR PENGHEMATAN
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Hitung Berapa Biaya & Waktu yang Terbuang
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Bandingkan biaya tenaga kerja manual yang rawan kelalaian dengan biaya otomasi tetap Noewbar.
            </p>
          </div>

          <div className="bg-[#0B0F19] border border-slate-800 rounded-2xl p-6 sm:p-10 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            {/* Sliders */}
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-300 mb-2">
                  <span>Waktu Terbuang Input / Cek Manual per Hari</span>
                  <span className="text-sky-400 font-mono font-bold text-sm">{dailyHours} Jam / hari</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={dailyHours}
                  onChange={(e) => setDailyHours(Number(e.target.value))}
                  className="w-full accent-sky-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-300 mb-2">
                  <span>Jumlah Karyawan / Admin Terlibat</span>
                  <span className="text-sky-400 font-mono font-bold text-sm">{staffCount} Orang</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={staffCount}
                  onChange={(e) => setStaffCount(Number(e.target.value))}
                  className="w-full accent-sky-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-300 mb-2">
                  <span>Estimasi Risiko Kerugian Struk Bodong / Salah Input</span>
                  <span className="text-amber-400 font-mono font-bold text-sm">
                    Rp{riskLoss.toLocaleString('id-ID')} / bln
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5000000"
                  step="500000"
                  value={riskLoss}
                  onChange={(e) => setRiskLoss(Number(e.target.value))}
                  className="w-full accent-amber-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Calculations Output Card */}
            <div className="bg-gradient-to-br from-[#0F172A] to-[#0A0E1A] border border-sky-800/40 rounded-xl p-6 text-center space-y-4 shadow-xl">
              <div>
                <span className="text-xs text-slate-400 block mb-1">Jam Kerja Produktif Diselamatkan</span>
                <span className="text-3xl sm:text-4xl font-extrabold text-white font-mono">
                  {hoursSavedPerMonth}{' '}
                  <span className="text-sm font-sans font-normal text-slate-400">Jam / Bulan</span>
                </span>
              </div>

              <div className="border-t border-slate-800 pt-4">
                <span className="text-xs text-slate-400 block mb-1">Estimasi Efisiensi Finansial Bisnis</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">
                  Rp{totalSavings.toLocaleString('id-ID')}
                  <span className="text-xs font-sans font-normal text-slate-400"> / Bulan</span>
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed pt-2">
                Dengan biaya retainer Noewbar mulai dari <b>Rp500rb/bulan</b>, ROI positif tercapai langsung sejak bulan pertama pemakaian.
              </p>

              <a
                href="#konsultasi"
                className="inline-flex items-center justify-center gap-2 w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold py-3 px-4 rounded-lg text-xs transition-colors"
              >
                <span>Mulai Efisiensi Sekarang</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Pilar Kepercayaan & Garansi SLA (Trust & Reliability) */}
      <section id="kepercayaan" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-sky-950 text-sky-400 text-xs font-mono font-medium mb-3 border border-sky-800/60">
            <ShieldCheck className="w-3.5 h-3.5" />
            KEAMANAN & GARANSI KAMI
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Mengapa Pemilik Bisnis Percaya pada Noewbar
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Kami menghapus risiko implementasi teknis dengan kepatuhan keamanan dan komitmen garansi yang mengikat.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {trustPillars.map((p, idx) => {
            const Icon = p.icon;
            return (
              <div
                key={idx}
                className="bg-[#0B0F19] border border-slate-800 rounded-xl p-6 flex flex-col justify-between hover:border-sky-500/40 transition-colors"
              >
                <div>
                  <div className="w-10 h-10 rounded-lg bg-sky-950/60 border border-sky-800/60 flex items-center justify-center text-sky-400 mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-white mb-2 leading-snug">{p.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{p.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 8. Alur Kerja 4 Tahap Menuju Go-Live */}
      <section id="alur" className="py-20 bg-[#0A0E1A] border-y border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-sky-950 text-sky-400 text-xs font-mono font-medium mb-3 border border-sky-800/60">
              <Clock className="w-3.5 h-3.5" />
              IMPLEMENTASI CEPAT
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              4 Langkah Praktis Menuju Go-Live
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Tanpa rapat berminggu-minggu. Sistem Anda kami aktifkan dalam 24–48 jam.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((st, i) => (
              <div key={i} className="relative bg-[#0B0F19] border border-slate-800 p-6 rounded-xl">
                <div className="text-3xl font-extrabold font-mono text-sky-500/30 mb-3">{st.num}</div>
                <h3 className="font-bold text-sm text-white mb-2">{st.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{st.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Form Konsultasi & Pengambilan Tiket Setup */}
      <section id="konsultasi" className="py-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#0B0F19] border border-slate-800 rounded-3xl p-6 sm:p-12 shadow-2xl relative overflow-hidden">
          <div className="text-center max-w-xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-sky-950 text-sky-400 text-xs font-mono font-medium mb-3 border border-sky-800/60">
              <MessageSquare className="w-3.5 h-3.5" />
              KONSULTASI GRATIS 15 MENIT
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Siap Mengotomasi Operasional Toko Anda?
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
              Isi data singkat berikut. Engineer Noewbar akan menghubungi WhatsApp Anda untuk audit kelayakan alur dan menyiapkan demo gratis.
            </p>
          </div>

          {formStatus === 'success' ? (
            <div className="bg-emerald-950/40 border border-emerald-800/70 p-6 rounded-2xl text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h3 className="text-lg font-bold text-white">Permintaan Berhasil Dikirim!</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{statusMessage}</p>
              <button
                type="button"
                onClick={() => setFormStatus('idle')}
                className="mt-4 text-xs font-semibold text-sky-400 hover:text-sky-300 underline"
              >
                Kirim data konsultasi bisnis lain
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Nama Pemilik / Penanggung Jawab *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Budi Santoso"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-[#070A12] border border-slate-700/80 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Nama Usaha / Toko / CV *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Toko Bangunan Sentosa"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    className="w-full bg-[#070A12] border border-slate-700/80 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none min-h-[44px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Nomor WhatsApp Aktif *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="Contoh: 081234567890"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    className="w-full bg-[#070A12] border border-slate-700/80 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Pilihan Bot Automasi yang Diminati *
                  </label>
                  <select
                    value={formData.serviceInterest}
                    onChange={(e) => setFormData({ ...formData, serviceInterest: e.target.value })}
                    className="w-full bg-[#070A12] border border-slate-700/80 rounded-lg px-4 py-3 text-sm text-white focus:border-sky-500 focus:outline-none min-h-[44px]"
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.title}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Catatan Masalah atau Kebutuhan Khusus (Opsional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Ceritakan kendala operasional Anda saat ini..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-[#070A12] border border-slate-700/80 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                />
              </div>

              {formStatus === 'error' && (
                <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{statusMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={formStatus === 'loading'}
                className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white font-bold py-3.5 px-6 rounded-lg text-sm transition-all shadow-lg shadow-sky-600/25 flex items-center justify-center gap-2 min-h-[44px]"
              >
                {formStatus === 'loading' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Mendaftarkan Permintaan...</span>
                  </>
                ) : (
                  <>
                    <span>Jadwalkan Konsultasi & Demo Bot</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <span className="text-[11px] text-slate-500">
                  🔒 Data Anda terenkripsi aman. Kami tidak akan membagikan nomor kontak Anda kepada pihak ketiga.
                </span>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* 10. FAQ Section */}
      <section id="faq" className="py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-800/80">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Pertanyaan yang Sering Diajukan
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-2">
            Jawaban transparan untuk segala pertanyaan teknis dan hukum sebelum Anda berlangganan.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="bg-[#0B0F19] border border-slate-800 rounded-xl overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between text-sm font-semibold text-slate-200 hover:text-white min-h-[44px]"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-slate-400 border-t border-slate-800/60 pt-3 leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 11. Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-[#060810] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Noewbar"
              width={124}
              height={30}
              className="h-7 w-auto object-contain opacity-90 hover:opacity-100 transition-opacity"
            />
            <div className="border-l border-slate-800 pl-3">
              <div className="text-white font-bold text-sm">Noewbar Automation</div>
              <div className="text-xs text-slate-500">Productized AI Solutions for Indonesian Business</div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-400 font-medium">
            <a
              href="https://seco.dpdns.org/storage/public-assets/terms.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-200"
            >
              Terms of Service
            </a>
            <a
              href="https://seco.dpdns.org/storage/public-assets/privacy.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-200"
            >
              Privacy Policy
            </a>
            <a href="https://seco.dpdns.org" className="hover:text-slate-200">
              Server Status (99.8% SLA)
            </a>
          </div>

          <div className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Noewbar. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
