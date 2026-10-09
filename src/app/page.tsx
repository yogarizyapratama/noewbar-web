'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  Radar,
  FileSpreadsheet,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  MessageSquare,
  ChevronDown,
} from 'lucide-react';

export default function HomePage() {
  // Calculator state
  const [dailyHours, setDailyHours] = useState(3);
  const [staffCount, setStaffCount] = useState(2);

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

  // FAQ state
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Calculated ROI
  const hoursSavedPerMonth = dailyHours * staffCount * 26;
  const estimatedRupiahSaved = hoursSavedPerMonth * 35000; // Asumsi biaya tenaga kerja Rp35rb/jam

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
        setStatusMessage('Permintaan konsultasi berhasil tercatat. Tim Noewbar akan segera menghubungi WhatsApp Anda dalam hitungan jam kerja.');
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
      setStatusMessage('Gagal terhubung ke server. Silakan hubungi nomor WhatsApp kami langsung.');
    }
  };

  const services = [
    {
      id: 'kasir-guard',
      title: 'Noewbar Kasir Guard',
      tagline: 'Verifikasi Bukti Transfer & Anti-Struk Palsu',
      badge: 'Grosir & Retail Fisik',
      icon: ShieldCheck,
      iconColor: 'text-emerald-400',
      problem: 'Kasir tertipu struk m-banking palsu hasil edit aplikasi saat antrean ramai, barang sudah terlanjur dibawa pembeli.',
      solution: 'Kasir foto struk ke bot WhatsApp toko. AI membaca nomor referensi & nominal lalu mencocokkan detik itu juga dengan mutasi rekening riil toko.',
      turnaround: 'Respon 3 detik di meja kasir',
      setupPrice: 'Rp2.000.000',
      monthlyPrice: 'Rp500.000 / bulan',
      features: [
        'Dukungan mutasi BCA, Mandiri, BRI & BNI',
        'Notifikasi status seketika (VALID / MUTASI TIDAK ADA)',
        'Mencegah kerugian nominal besar di muka kasir',
        'Tanpa perlu ganti sistem POS kasir yang sudah ada',
      ],
    },
    {
      id: 'radar-tender',
      title: 'Noewbar Radar Tender',
      tagline: 'Intelijen Dokumen Lelang & Pengadaan LPSE',
      badge: 'Kontraktor & Supplier B2B',
      icon: Radar,
      iconColor: 'text-amber-400',
      problem: 'Dokumen Kerangka Acuan Kerja (KAK) LPSE tebalnya 50–200 halaman PDF. Karyawan lelah membaca manual dan sering telat ajukan penawaran.',
      solution: 'Bot memantau LPSE target setiap jam 06.00 WIB. AI meringkas dokumen ratusan lembar menjadi 5 poin krusial langsung ke WhatsApp direktur.',
      turnaround: 'Notifikasi harian otomatis pkl 06.00 WIB',
      setupPrice: 'Rp2.500.000',
      monthlyPrice: 'Rp750.000 / bulan',
      features: [
        'Penyaringan otomatis proyek sesuai izin KBLI perusahaan',
        'Rangkuman Nilai HPS, syarat sertifikasi & batas waktu',
        'Deteksi proyek lelang baru di wilayah kabupaten/kota target',
        'Hemat waktu membaca dokumen ratusan lembar PDF',
      ],
    },
    {
      id: 'nota-vision',
      title: 'Noewbar Nota Vision',
      tagline: 'Konversi Nota Kertas Tulisan Tangan ke Excel',
      badge: 'Gudang & Logistik',
      icon: FileSpreadsheet,
      iconColor: 'text-blue-400',
      problem: 'Puluhan lembar nota kertas bertulisan pulpen menumpuk setiap sore. Admin menghabiskan 2–4 jam hanya untuk mengetik ulang ke komputer.',
      solution: 'Cukup foto nota kertas (meskipun tulisan miring/cakar ayam). Vision AI mengekstrak nama barang, kuantitas, harga, dan memasukkannya ke Google Sheets rapi.',
      turnaround: 'Konversi file dalam 5 detik',
      setupPrice: 'Rp1.500.000',
      monthlyPrice: 'Rp400.000 / bulan',
      features: [
        'Membaca tulisan tangan pulpen & nota nota toko bergaris',
        'Otomatis terhubung ke Google Sheets atau file Excel toko',
        'Ekstraksi: Tanggal, Nama Klien, Item, Qty, Harga & Total',
        'Audit verifikasi sebelum data dikunci permanen',
      ],
    },
  ];

  const faqs = [
    {
      q: 'Bagaimana cara kerja sistem Noewbar setelah dipasang?',
      a: 'Sistem Noewbar berjalan mandiri di server privat Anda. Anda dan staf Anda tidak perlu mengunduh aplikasi rumit baru; antarmuka utamanya cukup melalui WhatsApp yang sudah biasa digunakan sehari-hari.',
    },
    {
      q: 'Apakah data transaksi dan dokumen bisnis saya aman?',
      a: 'Sangat aman. Sistem dipasang di infrastruktur terisolasi dengan enkripsi standar industri. Kami tidak menjual atau membagikan data operasional bisnis Anda kepada pihak manapun.',
    },
    {
      q: 'Berapa lama proses pemasangan hingga sistem aktif?',
      a: 'Karena Noewbar menggunakan model Productized Service (solusi matang terstandar), proses setup konfigurasi dan pengujian biasanya selesai dalam waktu 24 hingga 48 jam.',
    },
    {
      q: 'Bagaimana jika terjadi kendala teknis saat operasional?',
      a: 'Biaya retainer bulanan mencakup pemeliharaan server, pembaruan integrasi sistem perbankan/ekspedisi, serta dukungan prioritas via WhatsApp dari tim Noewbar.',
    },
  ];

  return (
    <div className="flex-1 flex flex-col">
      {/* 1. Header / Navigation */}
      <header className="sticky top-0 z-50 bg-[#090D16]/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold font-mono">
              ☤
            </div>
            <a href="#" className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Noewbar <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-mono font-medium border border-slate-700">SOLUSI JADI</span>
            </a>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#solusi" className="hover:text-white transition-colors">Menu Solusi</a>
            <a href="#kalkulator" className="hover:text-white transition-colors">Kalkulator Hemat</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            <a href="#konsultasi" className="hover:text-white transition-colors">Konsultasi</a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="https://wa.me/628xxxxxxxxxx?text=Halo%20Tim%20Noewbar,%20saya%20tertarik%20konsultasi%20otomasi%20bisnis"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-amber-500 min-h-[44px]"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Konsultasi WhatsApp</span>
            </a>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 text-xs font-mono uppercase tracking-wider mb-8">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Sistem Otomasi Mandiri untuk Bisnis Riil
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight max-w-4xl mx-auto leading-tight sm:leading-tight mb-6">
          Otomasi Alur Bisnis Praktis Tanpa Beban Gaji Tim Teknis
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10">
          Noewbar memasang sistem otomasi cerdas siap pakai untuk pengamanan kasir toko, pemantauan tender LPSE, dan rekap nota gudang. Sekali pasang, aktif dalam 24 jam.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
          <a
            href="#solusi"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-6 py-3 rounded-lg text-sm transition-colors min-h-[44px]"
          >
            <span>Lihat 3 Menu Solusi Jadi</span>
            <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="#kalkulator"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-medium px-6 py-3 rounded-lg text-sm transition-colors min-h-[44px]"
          >
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Hitung Waktu Terbuang</span>
          </a>
        </div>

        {/* Value metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-4xl mx-auto text-left">
          <div className="bg-[#111827] border border-slate-800/80 p-5 rounded-xl">
            <div className="text-2xl font-bold font-mono text-white mb-1">24 Jam</div>
            <div className="text-xs text-slate-400 leading-normal">Pemasangan & pengujian hingga aktif</div>
          </div>
          <div className="bg-[#111827] border border-slate-800/80 p-5 rounded-xl">
            <div className="text-2xl font-bold font-mono text-emerald-400 mb-1">0 Aplikasi</div>
            <div className="text-xs text-slate-400 leading-normal">Cukup operasikan lewat WhatsApp rutin</div>
          </div>
          <div className="bg-[#111827] border border-slate-800/80 p-5 rounded-xl">
            <div className="text-2xl font-bold font-mono text-amber-400 mb-1">3 Detik</div>
            <div className="text-xs text-slate-400 leading-normal">Waktu deteksi & ekstraksi dokumen</div>
          </div>
          <div className="bg-[#111827] border border-slate-800/80 p-5 rounded-xl">
            <div className="text-2xl font-bold font-mono text-white mb-1">100%</div>
            <div className="text-xs text-slate-400 leading-normal">Data bisnis terisolasi di server mandiri</div>
          </div>
        </div>
      </section>

      {/* 3. Productized Solutions Grid */}
      <section id="solusi" className="py-20 bg-[#0D111C] border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-mono uppercase tracking-widest text-amber-400 mb-3">MENU TERSTANDARISASI</h2>
            <p className="text-2xl sm:text-4xl font-bold text-white tracking-tight mb-4">
              Bukan Jasa Custom yang Rumit. Pilih Solusi yang Langsung Dipasang.
            </p>
            <p className="text-sm sm:text-base text-slate-400">
              Setiap paket sudah teruji, dilengkapi SOP jelas, dan siap langsung mengamankan serta menghemat jam kerja bisnis Anda.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {services.map((svc) => {
              const Icon = svc.icon;
              return (
                <div
                  key={svc.id}
                  className="bg-[#111827] border border-slate-800 rounded-xl p-6 sm:p-8 flex flex-col justify-between hover:border-slate-700 transition-colors shadow-lg"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                        <Icon className={`w-6 h-6 ${svc.iconColor}`} />
                      </div>
                      <span className="text-xs font-mono font-medium px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {svc.badge}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-1">{svc.title}</h3>
                    <p className="text-xs font-medium text-amber-400/90 mb-5">{svc.tagline}</p>

                    <div className="space-y-4 mb-6 text-xs sm:text-sm">
                      <div className="bg-red-950/20 border border-red-900/40 p-3 rounded-lg">
                        <div className="flex items-center gap-1.5 text-red-400 font-medium mb-1 text-xs">
                          <AlertTriangle className="w-3.5 h-3.5" /> Masalah Nyata
                        </div>
                        <p className="text-slate-300 leading-relaxed text-xs">{svc.problem}</p>
                      </div>

                      <div className="bg-emerald-950/20 border border-emerald-900/40 p-3 rounded-lg">
                        <div className="flex items-center gap-1.5 text-emerald-400 font-medium mb-1 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Solusi Noewbar
                        </div>
                        <p className="text-slate-300 leading-relaxed text-xs">{svc.solution}</p>
                      </div>
                    </div>

                    <div className="border-t border-slate-800 pt-5 mb-6">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Cakupan Layanan:</div>
                      <ul className="space-y-2">
                        {svc.features.map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-300">
                            <span className="text-amber-400 mt-0.5">•</span>
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-5">
                    <div className="flex items-baseline justify-between mb-4">
                      <div>
                        <div className="text-xs text-slate-400">Setup Awal</div>
                        <div className="text-lg font-bold font-mono text-white">{svc.setupPrice}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Pemeliharaan</div>
                        <div className="text-sm font-semibold font-mono text-amber-400">{svc.monthlyPrice}</div>
                      </div>
                    </div>

                    <a
                      href="#konsultasi"
                      onClick={() => setFormData((prev) => ({ ...prev, serviceInterest: svc.title }))}
                      className="w-full inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors border border-slate-700 min-h-[44px]"
                    >
                      <span>Pilih Solusi Ini</span>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Interactive Calculator */}
      <section id="kalkulator" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 sm:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-amber-400 mb-2">
                <Sparkles className="w-4 h-4" /> SIMULASI EFISIENSI BISNIS
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-4">
                Berapa Banyak Uang & Waktu yang Terbuang Tanpa Otomasi?
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed mb-8">
                Tugas manual seperti mengetik ulang nota, mengecek mutasi satu per satu, atau membaca dokumen tender menyedot jam produktif staf yang seharusnya bisa fokus melayani pelanggan.
              </p>

              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2 font-medium">
                    <span className="text-slate-300">Jam staf terpakai untuk input manual per hari:</span>
                    <span className="font-mono text-amber-400">{dailyHours} Jam/Hari</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    value={dailyHours}
                    onChange={(e) => setDailyHours(parseInt(e.target.value))}
                    className="w-full accent-amber-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2 font-medium">
                    <span className="text-slate-300">Jumlah staf operasional yang mengerjakan:</span>
                    <span className="font-mono text-amber-400">{staffCount} Orang</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={staffCount}
                    onChange={(e) => setStaffCount(parseInt(e.target.value))}
                    className="w-full accent-amber-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#090D16] border border-slate-800 p-6 sm:p-8 rounded-xl flex flex-col justify-between">
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-6">
                  ESTIMASI PENGHEMATAN DENGAN NOEWBAR
                </div>

                <div className="mb-6">
                  <div className="text-3xl sm:text-4xl font-extrabold font-mono text-white mb-1">
                    {hoursSavedPerMonth} Jam
                  </div>
                  <div className="text-xs sm:text-sm text-slate-400">
                    Waktu staf yang diselamatkan setiap bulan untuk fokus ke pelayanan & penjualan.
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-6">
                  <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-400 mb-1">
                    Rp{estimatedRupiahSaved.toLocaleString('id-ID')}
                  </div>
                  <div className="text-xs sm:text-sm text-slate-400">
                    Perkiraan efisiensi beban biaya operasional & upah kerja per bulan.
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800">
                <a
                  href="#konsultasi"
                  className="w-full inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold py-3 px-5 rounded-lg text-sm transition-colors min-h-[44px]"
                >
                  <span>Mulai Otomasi Bisnis Anda</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Consultation & Lead Form */}
      <section id="konsultasi" className="py-20 bg-[#0D111C] border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-xs font-mono uppercase tracking-widest text-amber-400 mb-2">FORM KONSULTASI</h2>
            <p className="text-2xl sm:text-4xl font-bold text-white tracking-tight mb-3">
              Konsultasikan Masalah Alur Bisnis Anda
            </p>
            <p className="text-sm text-slate-400">
              Isi data di bawah ini. Tim Noewbar akan menganalisis alur toko/kantor Anda dan menghubungi via WhatsApp untuk demo langsung.
            </p>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 sm:p-10 shadow-xl">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Nama Pemilik / PIC <span className="text-amber-400">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Contoh: Budi Santoso"
                    className="w-full bg-[#090D16] border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 min-h-[44px]"
                  />
                </div>

                <div>
                  <label htmlFor="businessName" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Nama Usaha / Toko <span className="text-amber-400">*</span>
                  </label>
                  <input
                    id="businessName"
                    type="text"
                    required
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    placeholder="Contoh: TB Jaya Makmur"
                    className="w-full bg-[#090D16] border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 min-h-[44px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="whatsapp" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Nomor WhatsApp Aktif <span className="text-amber-400">*</span>
                  </label>
                  <input
                    id="whatsapp"
                    type="tel"
                    required
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    placeholder="Contoh: 081234567890"
                    className="w-full bg-[#090D16] border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 min-h-[44px]"
                  />
                </div>

                <div>
                  <label htmlFor="serviceInterest" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Pilihan Solusi Noewbar <span className="text-amber-400">*</span>
                  </label>
                  <select
                    id="serviceInterest"
                    value={formData.serviceInterest}
                    onChange={(e) => setFormData({ ...formData, serviceInterest: e.target.value })}
                    className="w-full bg-[#090D16] border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 min-h-[44px]"
                  >
                    <option value="Noewbar Kasir Guard (Anti-Struk Palsu)">Noewbar Kasir Guard (Anti-Struk Palsu)</option>
                    <option value="Noewbar Radar Tender (LPSE Alert)">Noewbar Radar Tender (LPSE Alert)</option>
                    <option value="Noewbar Nota Vision (Kertas ke Excel)">Noewbar Nota Vision (Kertas ke Excel)</option>
                    <option value="Konsultasi Alur Lain">Konsultasi Alur Khusus Lainnya</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="notes" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Ceritakan Kendala Operasional Saat Ini (Opsional)
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Contoh: Setiap hari kasir saya kewalahan cek mutasi karena ada 4 rekening bank berbeda saat toko ramai..."
                  className="w-full bg-[#090D16] border border-slate-700 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                ></textarea>
              </div>

              {statusMessage && (
                <div
                  className={`p-4 rounded-lg text-sm ${
                    formStatus === 'success'
                      ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-300'
                      : 'bg-red-950/40 border border-red-800 text-red-300'
                  }`}
                >
                  {statusMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={formStatus === 'loading'}
                className="w-full inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold py-3.5 px-6 rounded-lg text-sm transition-colors min-h-[44px]"
              >
                {formStatus === 'loading' ? (
                  <span>Mengirimkan Permintaan...</span>
                ) : (
                  <>
                    <span>Kirim Permintaan Konsultasi</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* 6. FAQ Section */}
      <section id="faq" className="py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-xs font-mono uppercase tracking-widest text-amber-400 mb-2">PERTANYAAN UMUM</h2>
          <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Transparansi Cara Kerja Noewbar
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between text-sm font-semibold text-slate-200 hover:text-white min-h-[44px]"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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

      {/* 7. Footer */}
      <footer className="mt-auto border-t border-slate-800 bg-[#090D16] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold font-mono text-sm">
              ☤
            </div>
            <div>
              <div className="text-white font-bold text-sm">Noewbar Platform</div>
              <div className="text-xs text-slate-500">Productized AI Automation Service</div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-400 font-medium">
            <a href="https://seco.dpdns.org/storage/public-assets/terms.html" target="_blank" rel="noopener noreferrer" className="hover:text-slate-200">
              Terms of Service
            </a>
            <a href="https://seco.dpdns.org/storage/public-assets/privacy.html" target="_blank" rel="noopener noreferrer" className="hover:text-slate-200">
              Privacy Policy
            </a>
            <a href="https://seco.dpdns.org" className="hover:text-slate-200">
              Status Server
            </a>
          </div>

          <div className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Noewbar. Hak Cipta Dilindungi.
          </div>
        </div>
      </footer>
    </div>
  );
}
