"use client";

/**
 * Dashboard & Ringkasan Toko (Chapter 10.B).
 *
 * Posture Anti-Slop:
 * - Menampilkan metrik bisnis nyata: Total Omzet, Pesanan Masuk, Antrean Bukti Bayar,
 *   dan Percakapan Aktif.
 * - Status operasional nyata hasil probe sistem: WhatsApp, AI Gateway, Katalog & SOP,
 *   Promosi & Pengiriman.
 * - Feed 5 transaksi pesanan terbaru langsung dari database PostgreSQL.
 * - Pusat kendali cepat ke seluruh alur kerja operasional.
 * - Tanpa data dummy, zero em-dash di seluruh teks.
 */

import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  Globe,
  MessageSquare,
  Package,
  Receipt,
  RefreshCw,
  Smartphone,
  Tag,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusDot,
  cn,
  rupiah,
  timeAgo,
} from "@/components/ui";

import type { ConversationRow, Health, OrderRow } from "./types";

export function PanelStatus({
  health,
  orders = [],
  counts = {},
  conversations = [],
  error,
  loading,
  onGoWhatsapp,
  onGoSimulator,
  onGoCatalog,
  onGoOrders,
  onGoChat,
  onGoProducts,
  onGoWebsite,
  onGoPromos,
  onRefresh,
}: {
  health: Health | null;
  orders?: OrderRow[];
  counts?: Record<string, number>;
  conversations?: ConversationRow[];
  error: string | null;
  loading: boolean;
  onGoWhatsapp: () => void;
  onGoSimulator?: () => void;
  onGoCatalog?: () => void;
  onGoOrders?: () => void;
  onGoChat?: () => void;
  onGoProducts?: () => void;
  onGoWebsite?: () => void;
  onGoPromos?: () => void;
  onRefresh: () => void;
}) {
  if (error) {
    return (
      <div className="page">
        <PageHeader eyebrow="Ringkasan Toko" title="Dashboard" />
        <ErrorState
          title="Tidak dapat membaca status toko"
          description={error}
          action={
            <Button variant="secondary" onClick={onRefresh}>
              Coba lagi
            </Button>
          }
        />
      </div>
    );
  }

  if (!health || loading) {
    return (
      <div className="page">
        <PageHeader eyebrow="Ringkasan Toko" title="Dashboard" />
        <LoadingState rows={4} />
      </div>
    );
  }

  // Hitung Metrik Bisnis Nyata dari Database
  const verifiedOrders = orders.filter((o) => o.payment_status === "VERIFIED");
  const totalRevenue = verifiedOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const pendingProofsCount =
    health.pending_proofs ||
    (counts.PROOF_SUBMITTED ?? 0) + (counts.UNDER_REVIEW ?? 0);
  const unpaidOrdersCount = counts.UNPAID ?? 0;
  const humanTakeoverCount = conversations.filter((c) => c.is_human_takeover).length;

  // Metrik Visual Sales Conversion Funnel
  const funnelChats = Math.max(conversations.length, orders.length);
  const funnelOrders = orders.length;
  const funnelProofs = (counts.PROOF_SUBMITTED ?? 0) + (counts.UNDER_REVIEW ?? 0) + verifiedOrders.length;
  const funnelPaid = verifiedOrders.length;

  const pctOrder = funnelChats > 0 ? Math.round((funnelOrders / funnelChats) * 100) : 0;
  const pctProof = funnelOrders > 0 ? Math.round((funnelProofs / funnelOrders) * 100) : 0;
  const pctPaid = funnelProofs > 0 ? Math.round((funnelPaid / (funnelProofs || 1)) * 100) : 0;
  const conversionOverall = funnelChats > 0 ? Math.round((funnelPaid / funnelChats) * 100) : 0;
  const recoveryRate = funnelOrders > 0 ? Math.round((funnelPaid / funnelOrders) * 100) : 0;

  const waOk = health?.whatsapp?.connection_status === "CONNECTED";
  const aiOk = Boolean(health?.ai?.gateway_ok);
  const catalogOk = Boolean(health?.catalog?.configured);
  const hasPendingProof = pendingProofsCount > 0;
  const promoRulesCount = health?.promos?.promo_rules?.length ?? 0;
  const voucherCount = health?.promos?.voucher_rules?.length ?? 0;
  const cutOffHour = health?.shipping?.cut_off_hour ?? 15;
  const readinessChecks = [
    waOk,
    aiOk,
    catalogOk,
    promoRulesCount > 0 || voucherCount > 0,
    !hasPendingProof,
  ];
  const readinessScore = readinessChecks.filter(Boolean).length;

  return (
    <div className="page space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-ink-100 pb-5">
        <div>
          <p className="eyebrow text-ink-500">Ringkasan Toko</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Dashboard Operasional
          </h1>
          <p className="mt-1 text-xs text-ink-600 sm:text-sm">
            Pantau performa penjualan, antrean bukti bayar, live chat, dan kesehatan sistem AI toko Anda.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button variant="secondary" size="sm" onClick={onRefresh} className="shadow-sm">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Segarkan
          </Button>
          {onGoSimulator && (
            <Button variant="primary" size="sm" onClick={onGoSimulator} className="shadow-sm">
              <Bot className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Uji Simulator WA
            </Button>
          )}
        </div>
      </div>

      {/* 4 Kartu KPI Finansial & Operasional Nyata */}
      {health.degraded && (
        <div
          role="status"
          className="rounded-xl border border-warn/30 bg-warn-wash px-4 py-3 text-xs leading-relaxed text-warn"
        >
          Database tidak terjangkau sesaat, data di bawah mungkin basi. Coba Segarkan dalam beberapa detik.
        </div>
      )}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500">
            Metrik Finansial & Penjualan
          </h2>
          <span className="text-2xs text-ink-400 font-mono">
            Data real-time dari PostgreSQL
          </span>
        </div>

        <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {/* KPI 1: Total Omzet Terverifikasi */}
          <Card className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-ink-500">
                Omzet Terverifikasi
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <Receipt className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3">
              <p className="font-mono text-2xl font-bold tracking-tight text-ink">
                Rp {rupiah(totalRevenue)}
              </p>
              <p className="mt-1 text-2xs text-ink-500">
                Dari {verifiedOrders.length} transaksi sukses terverifikasi
              </p>
            </div>
          </Card>

          {/* KPI 2: Total Pesanan Masuk */}
          <Card className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-ink-500">
                Total Pesanan Masuk
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-50 text-sky-700 border border-sky-200/80">
                <Package className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3">
              <p className="font-mono text-2xl font-bold tracking-tight text-ink">
                {orders.length} <span className="text-sm font-normal text-ink-500">pesanan</span>
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-2xs">
                <span className="text-emerald-700 font-semibold">{verifiedOrders.length} Lunas</span>
                <span className="text-ink-300">•</span>
                <span className="text-amber-700 font-semibold">{unpaidOrdersCount} Menunggu</span>
              </div>
            </div>
          </Card>

          {/* KPI 3: Antrean Bukti Transfer */}
          <Card
            className={cn(
              "p-4 flex flex-col justify-between transition-colors",
              hasPendingProof ? "border-amber-300 bg-amber-50/30" : ""
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-ink-500">
                Verifikasi Bukti Bayar
              </span>
              <span
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-lg border",
                  hasPendingProof
                    ? "bg-amber-100 text-amber-800 border-amber-300"
                    : "bg-ink-100 text-ink-600 border-ink-200"
                )}
              >
                <Wallet className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3">
              <p
                className={cn(
                  "font-mono text-2xl font-bold tracking-tight",
                  hasPendingProof ? "text-amber-900" : "text-ink"
                )}
              >
                {pendingProofsCount} <span className="text-sm font-normal text-ink-500">antrean</span>
              </p>
              <p className="mt-1 text-2xs text-ink-500">
                {hasPendingProof
                  ? "Perlu dicek pemilik toko sekarang"
                  : "Semua bukti bayar sudah diperiksa"}
              </p>
            </div>
          </Card>

          {/* KPI 4: Percakapan Chat & Pelanggan */}
          <Card className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-ink-500">
                Percakapan WhatsApp
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-100 text-ink-700 border border-ink-200">
                <MessageSquare className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3">
              <p className="font-mono text-2xl font-bold tracking-tight text-ink">
                {conversations.length} <span className="text-sm font-normal text-ink-500">chat</span>
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-2xs">
                <span className="text-ink-700 font-semibold">{conversations.length - humanTakeoverCount} Bot AI</span>
                {humanTakeoverCount > 0 && (
                  <>
                    <span className="text-ink-300">•</span>
                    <span className="text-warn font-semibold">{humanTakeoverCount} Takeover</span>
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Visual Sales Conversion Funnel */}
      <Card className="border-ink-200 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ink-100 pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                <TrendingUp className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-ink-800">
                  Funnel Konversi Penjualan WhatsApp
                </h2>
                <p className="text-2xs text-ink-500">
                  Pelacakan real-time dari pesan masuk sampai dana terverifikasi di rekening.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-ink-50 px-3.5 py-2 rounded-lg border border-ink-100">
            <div>
              <span className="text-2xs font-medium text-ink-500 block">Konversi Akhir (Paid)</span>
              <span className="font-mono text-base font-bold text-signal-strong">
                {conversionOverall}%
              </span>
            </div>
            <div className="h-6 w-px bg-ink-200" />
            <div>
              <span className="text-2xs font-medium text-ink-500 block">Payment Recovery</span>
              <span className="font-mono text-base font-bold text-ink-800">
                {recoveryRate}%
              </span>
            </div>
          </div>
        </div>

        {/* Funnel 4-Stage Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
          {/* Step 1: Chat Masuk */}
          <div className="relative rounded-xl border border-ink-200 bg-white p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-2xs font-semibold text-ink-500 mb-1">
                <span>1. Chat Masuk</span>
                <span className="font-mono">100%</span>
              </div>
              <p className="font-mono text-xl font-bold text-ink">{funnelChats} <span className="text-xs font-normal text-ink-500">kontak</span></p>
              <p className="text-2xs text-ink-400 mt-0.5">Inquiry pembeli via WhatsApp</p>
            </div>
            <div className="mt-3">
              <div className="h-1.5 w-full bg-ink-100 rounded-full overflow-hidden">
                <div className="h-full bg-ink-700 rounded-full w-full" />
              </div>
              <span className="text-[10px] text-ink-500 mt-1 block">Basis awal prospek</span>
            </div>
          </div>

          {/* Step 2: Checkout Pesanan */}
          <div className="relative rounded-xl border border-ink-200 bg-white p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-2xs font-semibold text-ink-500 mb-1">
                <span>2. Checkout Pesanan</span>
                <span className="font-mono">{pctOrder}%</span>
              </div>
              <p className="font-mono text-xl font-bold text-sky-800">{funnelOrders} <span className="text-xs font-normal text-ink-500">order</span></p>
              <p className="text-2xs text-ink-400 mt-0.5">Order snapshot dengan kode unik</p>
            </div>
            <div className="mt-3">
              <div className="h-1.5 w-full bg-ink-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-600 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(5, pctOrder))}%` }}
                />
              </div>
              <span className="text-[10px] text-sky-700 mt-1 block font-medium">
                {pctOrder}% chat berlanjut checkout
              </span>
            </div>
          </div>

          {/* Step 3: Unggah Bukti Bayar */}
          <div className="relative rounded-xl border border-ink-200 bg-white p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-2xs font-semibold text-ink-500 mb-1">
                <span>3. Unggah Bukti</span>
                <span className="font-mono">{pctProof}%</span>
              </div>
              <p className="font-mono text-xl font-bold text-amber-800">{funnelProofs} <span className="text-xs font-normal text-ink-500">struk</span></p>
              <p className="text-2xs text-ink-400 mt-0.5">Foto bukti transfer dikirim pembeli</p>
            </div>
            <div className="mt-3">
              <div className="h-1.5 w-full bg-ink-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(5, pctProof))}%` }}
                />
              </div>
              <span className="text-[10px] text-amber-700 mt-1 block font-medium">
                {pctProof}% checkout kirim struk
              </span>
            </div>
          </div>

          {/* Step 4: Lunas Terverifikasi */}
          <div className="relative rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-2xs font-semibold text-emerald-800 mb-1">
                <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-600" /> 4. Lunas Terverifikasi</span>
                <span className="font-mono font-bold text-emerald-700">{pctPaid}%</span>
              </div>
              <p className="font-mono text-xl font-bold text-emerald-900">{funnelPaid} <span className="text-xs font-normal text-emerald-700">lunas</span></p>
              <p className="text-2xs text-emerald-700 mt-0.5">Mutasi bank cocok &amp; diverifikasi</p>
            </div>
            <div className="mt-3">
              <div className="h-1.5 w-full bg-emerald-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(5, pctPaid))}%` }}
                />
              </div>
              <span className="text-[10px] text-emerald-800 mt-1 block font-semibold">
                {conversionOverall}% total conversion rate
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Tata Letak Inti 2 Kolom: Operasional & Interaksi Pelanggan */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Kolom Kiri (8 Kolom): Kesiapan Toko & Aktivitas Pesanan */}
        <div className="lg:col-span-8 space-y-6">
          {/* Card 1: Pusat Kesiapan & Status Operasional Toko */}
          <Card className="border-ink-200 overflow-hidden">
            <div className="border-b border-ink-100 bg-ink-50/50 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-ink">
                    Kesiapan &amp; Status Operasional Toko
                  </h3>
                  <Badge tone={readinessScore === 5 ? "signal" : "warn"} className="text-[10px]">
                    <StatusDot ok={readinessScore === 5} />
                    {readinessScore === 5 ? "Sistem Siap" : `${5 - readinessScore} Perlu Konfigurasi`}
                  </Badge>
                </div>
                <p className="mt-0.5 text-2xs text-ink-500">
                  Status 5 integrasi saluran utama agar bot AI CS dapat melayani pembeli otomatis.
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-ink-600 bg-white border border-ink-200 px-2.5 py-1 rounded-md">
                Kesiapan: {readinessScore}/5
              </span>
            </div>

            <div className="divide-y divide-ink-100">
              {/* Row 1: WhatsApp Connection */}
              <div className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-ink-50/30 transition-colors">
                <div className="flex items-start gap-3">
                  <span className={cn(
                    "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border",
                    waOk ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                  )}>
                    <Smartphone className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-ink">Koneksi WhatsApp Toko</p>
                      <Badge tone={waOk ? "signal" : "danger"} className="text-[10px]">
                        {waOk ? "Terhubung" : "Belum Tertaut"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-2xs text-ink-500 leading-relaxed">
                      {waOk
                        ? health?.whatsapp?.phone_number
                          ? `Nomor ${health.whatsapp.phone_number} aktif merespon chat pembeli.`
                          : "Nomor WhatsApp aktif dan siap menerima pesan."
                        : "Pindai QR code dari nomor WhatsApp bisnis toko Anda agar bot dapat membalas chat."}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={waOk ? "secondary" : "primary"}
                  className="shrink-0 h-8 text-xs font-medium px-3.5"
                  onClick={onGoWhatsapp}
                >
                  {waOk ? "Kelola Sesi" : "Hubungkan WA"}
                </Button>
              </div>

              {/* Row 2: AI CS Persona & Gateway */}
              <div className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-ink-50/30 transition-colors">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border bg-ink-100 text-ink-700 border-ink-200">
                    <Bot className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-ink">AI Persona CS ({health?.catalog?.bot_name || "Admin CS"})</p>
                      <Badge tone={aiOk ? "signal" : "warn"} className="text-[10px]">
                        {aiOk ? "Aktif" : "Perhatian"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-2xs text-ink-500 leading-relaxed">
                      Gaya bahasa: <strong className="text-ink-700">{health?.catalog?.bot_tone || "Ramah"}</strong>.
                      {health?.ai?.latency_ms ? ` Latensi respon AI: ${health.ai.latency_ms}ms.` : " Siap melayani tanya jawab produk dan ongkir."}
                    </p>
                  </div>
                </div>
                {onGoSimulator && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shrink-0 h-8 text-xs font-medium px-3.5"
                    onClick={onGoSimulator}
                  >
                    Uji di Simulator
                  </Button>
                )}
              </div>

              {/* Row 3: Product Catalog & SOP */}
              <div className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-ink-50/30 transition-colors">
                <div className="flex items-start gap-3">
                  <span className={cn(
                    "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border",
                    catalogOk ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-amber-50 text-amber-700 border-amber-200"
                  )}>
                    <Package className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-ink">Katalog Produk &amp; SOP Toko</p>
                      <Badge tone={catalogOk ? "signal" : "warn"} className="text-[10px]">
                        {catalogOk ? "Terkonfigurasi" : "Belum Diatur"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-2xs text-ink-500 leading-relaxed">
                      {catalogOk
                        ? "Basis pengetahuan produk, harga, foto/video, dan aturan toko aktif terhubung."
                        : "Katalog produk atau spreadsheet belum dihubungkan. Hubungkan agar bot memahami produk Anda."}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={catalogOk ? "secondary" : "primary"}
                  className="shrink-0 h-8 text-xs font-medium px-3.5"
                  onClick={onGoCatalog ?? onGoProducts}
                >
                  {catalogOk ? "Atur SOP" : "Hubungkan Katalog"}
                </Button>
              </div>

              {/* Row 4: Promosi & Jam Kirim */}
              <div className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-ink-50/30 transition-colors">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border bg-amber-50 text-amber-700 border-amber-200">
                    <Tag className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-ink">Promosi &amp; Jam Cut-off Pengiriman</p>
                      <Badge tone={promoRulesCount > 0 || voucherCount > 0 ? "signal" : "neutral"} className="text-[10px]">
                        {promoRulesCount > 0 || voucherCount > 0 ? `${promoRulesCount + voucherCount} Aturan Aktif` : "Standar"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-2xs text-ink-500 leading-relaxed">
                      Cut-off same day: <strong className="text-ink-700">{cutOffHour}:00 WIB</strong>.
                      {promoRulesCount > 0
                        ? ` Diskon bundling dan voucher otomatis diterapkan bot saat checkout.`
                        : " Tambahkan promo beli banyak atau kupon voucher untuk meningkatkan penjualan."}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="shrink-0 h-8 text-xs font-medium px-3.5"
                  onClick={onGoPromos}
                >
                  Atur Promosi
                </Button>
              </div>

              {/* Row 5: Bukti Pembayaran */}
              <div className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-ink-50/30 transition-colors">
                <div className="flex items-start gap-3">
                  <span className={cn(
                    "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border",
                    hasPendingProof ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  )}>
                    <Wallet className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-ink">Verifikasi Bukti Pembayaran</p>
                      <Badge tone={hasPendingProof ? "warn" : "signal"} className="text-[10px]">
                        {hasPendingProof ? `${pendingProofsCount} Antrean` : "Semua Beres"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-2xs text-ink-500 leading-relaxed">
                      {hasPendingProof
                        ? `${pendingProofsCount} bukti transfer dari pembeli menunggu konfirmasi Anda untuk proses pengiriman.`
                        : "Tidak ada antrean bukti transfer yang perlu diperiksa saat ini."}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={hasPendingProof ? "accent" : "secondary"}
                  className="shrink-0 h-8 text-xs font-medium px-3.5"
                  onClick={onGoOrders}
                >
                  {hasPendingProof ? "Verifikasi Sekarang" : "Buka Pesanan"}
                </Button>
              </div>
            </div>
          </Card>

          {/* Card 2: Aktivitas Pesanan Terbaru */}
          <Card className="border-ink-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-ink">Aktivitas Pesanan Terbaru</h3>
                <p className="text-2xs text-ink-500">Transaksi pesanan pelanggan dari WhatsApp.</p>
              </div>
              {onGoOrders && (
                <Button size="sm" variant="secondary" onClick={onGoOrders} className="h-8 text-xs">
                  Lihat Semua ({orders.length})
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <CardBody className="p-0">
              {orders.length === 0 ? (
                <div className="p-8 text-center">
                  <EmptyState
                    icon={<Receipt className="h-7 w-7 text-ink-400" />}
                    title="Belum Ada Pesanan"
                    description="Pesanan dari pembeli WhatsApp akan otomatis tercatat di sini saat proses checkout selesai."
                    action={
                      onGoSimulator && (
                        <Button variant="secondary" size="sm" onClick={onGoSimulator}>
                          <Bot className="mr-1.5 h-3.5 w-3.5" />
                          Simulasi Checkout di Bot
                        </Button>
                      )
                    }
                  />
                </div>
              ) : (
                <div className="divide-y divide-ink-100">
                  {orders.slice(0, 5).map((ord) => (
                    <div
                      key={ord.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 hover:bg-ink-50/50 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-ink">
                            {ord.order_number}
                          </span>
                          <Badge
                            tone={
                              ord.payment_status === "VERIFIED"
                                ? "signal"
                                : ord.payment_status === "REJECTED"
                                ? "danger"
                                : "warn"
                            }
                            className="text-[10px]"
                          >
                            {ord.payment_status_label}
                          </Badge>
                          <span className="text-2xs text-ink-400 font-mono">
                            {timeAgo(ord.created_at)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-ink-600 truncate">
                          {ord.buyer_name || "Pelanggan WhatsApp"} ({ord.buyer_jid ? ord.buyer_jid.split("@")[0] : "-"})
                          {ord.items.length > 0 && (
                            <span className="text-ink-400 ml-1">
                              • {ord.items[0].name} {ord.items.length > 1 ? `+${ord.items.length - 1} item` : ""}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <span className="font-mono text-sm font-bold text-ink">
                          Rp {rupiah(ord.total_amount)}
                        </span>
                        {onGoOrders && (
                          <Button
                            size="sm"
                            variant={ord.payment_status === "PROOF_SUBMITTED" ? "accent" : "secondary"}
                            className="h-7 text-xs px-2.5"
                            onClick={onGoOrders}
                          >
                            {ord.payment_status === "PROOF_SUBMITTED" ? "Verifikasi" : "Periksa"}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Kolom Kanan (4 Kolom): Pintasan Cepat & Live Feed */}
        <div className="lg:col-span-4 space-y-6">
          {/* Pintasan Cepat Operasional */}
          <Card className="border-ink-200 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-3">
              Pusat Akses Cepat
            </h3>
            <div className="space-y-2">
              {onGoChat && (
                <button
                  type="button"
                  onClick={onGoChat}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-ink-200 bg-white hover:bg-ink-50/80 hover:border-ink-300 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <MessageSquare className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-ink group-hover:text-ink-950">Live Chat CS Toko</p>
                      <p className="text-[11px] text-ink-500">Pantau &amp; ambil alih percakapan</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-ink-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}

              {onGoSimulator && (
                <button
                  type="button"
                  onClick={onGoSimulator}
                  className="w-full min-h-[44px] flex items-center justify-between p-3 rounded-xl border border-ink-200 bg-white hover:bg-ink-50/80 hover:border-ink-300 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-100 text-ink-700 border border-ink-200">
                      <Bot className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-ink group-hover:text-ink-950">Simulator WhatsApp AI</p>
                      <p className="text-[11px] text-ink-500">Uji skenario &amp; respon bot</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-ink-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}

              {onGoProducts && (
                <button
                  type="button"
                  onClick={onGoProducts}
                  className="w-full min-h-[44px] flex items-center justify-between p-3 rounded-xl border border-ink-200 bg-white hover:bg-ink-50/80 hover:border-ink-300 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-100 text-ink-700 border border-ink-200">
                      <Package className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-ink group-hover:text-ink-950">Katalog Produk &amp; SKU</p>
                      <p className="text-[11px] text-ink-500">Kelola stok &amp; varian harga</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-ink-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}

              {onGoPromos && (
                <button
                  type="button"
                  onClick={onGoPromos}
                  className="w-full min-h-[44px] flex items-center justify-between p-3 rounded-xl border border-ink-200 bg-white hover:bg-ink-50/80 hover:border-ink-300 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-100 text-ink-700 border border-ink-200">
                      <Tag className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-ink group-hover:text-ink-950">Diskon &amp; Jadwal Kirim</p>
                      <p className="text-[11px] text-ink-500">Promo kupon &amp; batas same day</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-ink-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}

              {onGoWebsite && (
                <button
                  type="button"
                  onClick={onGoWebsite}
                  className="w-full min-h-[44px] flex items-center justify-between p-3 rounded-xl border border-ink-200 bg-white hover:bg-ink-50/80 hover:border-ink-300 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-100 text-ink-700 border border-ink-200">
                      <Globe className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-ink group-hover:text-ink-950">AI Website Builder</p>
                      <p className="text-[11px] text-ink-500">Halaman landing page publik</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-ink-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}
            </div>
          </Card>

          {/* Percakapan WhatsApp Terkini */}
          <Card className="border-ink-200 overflow-hidden">
            <div className="border-b border-ink-100 px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-500">
                  Chat Pelanggan Terkini
                </h3>
              </div>
              {onGoChat && (
                <button
                  type="button"
                  onClick={onGoChat}
                  className="text-2xs font-semibold text-signal-strong hover:underline transition-colors"
                >
                  Buka Chat ({conversations.length})
                </button>
              )}
            </div>
            <div className="divide-y divide-ink-100">
              {conversations.length === 0 ? (
                <div className="p-5 text-center text-xs text-ink-500">
                  Belum ada riwayat percakapan. Mulai percakapan melalui nomor WhatsApp toko Anda.
                </div>
              ) : (
                conversations.slice(0, 3).map((conv) => (
                  <div
                    key={conv.id}
                    onClick={onGoChat}
                    className="p-3.5 hover:bg-ink-50/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink truncate">
                        {conv.buyer_name || (conv.buyer_jid ? conv.buyer_jid.split("@")[0] : "-")}
                      </span>
                      <span className="text-[10px] text-ink-400 font-mono">
                        {timeAgo(conv.last_interaction)}
                      </span>
                    </div>
                    <p className="mt-1 text-2xs text-ink-500 truncate">
                      Tahap: {conv.pipeline_stage} • {conv.message_count} pesan
                    </p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className={cn(
                        "inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium font-mono",
                        conv.is_human_takeover
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      )}>
                        {conv.is_human_takeover ? "Manual Takeover" : "Bot AI"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Info Ekspedisi Pengiriman Hari Ini */}
          <Card className="border-ink-200 p-4 bg-ink-50/40">
            <div className="flex items-start gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-sky-100 text-sky-800 border border-sky-200 shrink-0">
                <Globe className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-xs font-bold text-ink">Jadwal Ekspedisi Hari Ini</p>
                <p className="mt-1 text-2xs text-ink-600 leading-relaxed">
                  Batas kirim same-day: <strong>{cutOffHour}:00 WIB</strong>.
                  Pesanan sesudah jam ini dikirim keesokan hari. Ekspedisi aktif: J&amp;T, SiCepat, JNE.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}