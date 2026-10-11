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
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Globe,
  MessageSquare,
  Package,
  Receipt,
  RefreshCw,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Tag,
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

  const waOk = health.whatsapp.connection_status === "CONNECTED";
  const aiOk = Boolean(health.ai.gateway_ok);
  const catalogOk = Boolean(health.catalog.configured);
  const hasPendingProof = pendingProofsCount > 0;
  const promoRulesCount = health.promos?.promo_rules?.length ?? 0;
  const voucherCount = health.promos?.voucher_rules?.length ?? 0;
  const cutOffHour = health.shipping?.cut_off_hour ?? 15;

  // 5 Probe Sistem Utama
  const items = [
    {
      icon: <Smartphone className="h-4 w-4" aria-hidden="true" />,
      iconTheme: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
      label: "Koneksi WhatsApp",
      ok: waOk,
      okText: health.whatsapp.phone_number
        ? `Terhubung (${health.whatsapp.phone_number})`
        : "Terhubung dan siap melayani",
      badText:
        health.whatsapp.connection_status === "PAIRING"
          ? "Menunggu pemindaian QR"
          : "Belum terhubung",
      action: onGoWhatsapp,
      actionLabel: waOk ? "Kelola Sesi" : "Hubungkan WA",
    },
    {
      icon: <Sparkles className="h-4 w-4" aria-hidden="true" />,
      iconTheme: "bg-sky-50 text-sky-700 border-sky-200/80",
      label: "Mesin AI & Gateway",
      ok: aiOk,
      okText: `Aktif (${health.ai.model || "combo-ai"}) ${health.ai.latency_ms ? `[${health.ai.latency_ms}ms]` : ""}`,
      badText: health.ai.error ?? "Perlu perhatian",
      action: onGoSimulator ?? onRefresh,
      actionLabel: "Uji Respon AI",
    },
    {
      icon: <Bot className="h-4 w-4" aria-hidden="true" />,
      iconTheme: "bg-violet-50 text-violet-700 border-violet-200/80",
      label: "AI Persona & CS",
      ok: true,
      okText: `${health.catalog.bot_name || "Admin CS"} (${health.catalog.bot_tone || "Ramah"})`,
      badText: "Belum diatur",
      action: onGoSimulator,
      actionLabel: "Uji di Simulator",
    },
    {
      icon: <Package className="h-4 w-4" aria-hidden="true" />,
      iconTheme: "bg-sky-50 text-sky-700 border-sky-200/80",
      label: "Katalog & Basis SOP",
      ok: catalogOk,
      okText: "Spreadsheet & SOP Aktif",
      badText: "Katalog belum diatur",
      action: onGoCatalog,
      actionLabel: "Atur Dokumen",
    },
    {
      icon: <Tag className="h-4 w-4" aria-hidden="true" />,
      iconTheme: "bg-amber-50 text-amber-700 border-amber-200/80",
      label: "Promosi & Jam Kirim",
      ok: promoRulesCount > 0 || voucherCount > 0,
      okText: `${promoRulesCount} Promo, Cut-Off ${cutOffHour}:00`,
      badText: `Cut-off ${cutOffHour}:00 WIB (Belum ada promo)`,
      action: onGoPromos ?? onGoCatalog,
      actionLabel: "Atur Promosi",
    },
    {
      icon: <Wallet className="h-4 w-4" aria-hidden="true" />,
      iconTheme: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
      label: "Bukti Transfer Masuk",
      ok: !hasPendingProof,
      okText: "Tidak ada antrean verifikasi",
      badText: `${pendingProofsCount} bukti bayar menunggu`,
      action: onGoOrders,
      actionLabel: "Buka Pesanan",
    },
  ];

  const needsAction = items.filter((i) => !i.ok);

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
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                <MessageSquare className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3">
              <p className="font-mono text-2xl font-bold tracking-tight text-ink">
                {conversations.length} <span className="text-sm font-normal text-ink-500">chat</span>
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-2xs">
                <span className="text-indigo-700 font-semibold">{conversations.length - humanTakeoverCount} Bot AI</span>
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

      {/* 5 Kartu Kesehatan Sistem & Layanan */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500">
            Kesehatan Sistem & Probe Layanan
          </h2>
          <span className="text-2xs text-ink-400 font-mono">
            {needsAction.length === 0 ? "Semua sistem optimal" : `${needsAction.length} butuh tindakan`}
          </span>
        </div>

        <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {items.map((item) => (
            <Card
              key={item.label}
              className={cn(
                "group relative flex flex-col justify-between p-4 transition-all duration-150 hover:shadow-raised min-h-[178px]",
                !item.ok && "border-amber-200/90 bg-amber-50/20"
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-lg border shadow-flat transition-transform group-hover:scale-105",
                        item.iconTheme
                      )}
                    >
                      {item.icon}
                    </span>
                    <p className="text-xs font-semibold text-ink line-clamp-1 leading-snug">
                      {item.label}
                    </p>
                  </div>
                  <Badge tone={item.ok ? "signal" : "warn"} className="shrink-0 text-[10px] px-2 py-0.5">
                    <StatusDot ok={item.ok} />
                    {item.ok ? "Normal" : "Perhatian"}
                  </Badge>
                </div>

                <div className="mt-3 flex items-start gap-1.5">
                  {item.ok ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" aria-hidden="true" />
                  )}
                  <p
                    className={cn(
                      "text-xs leading-snug line-clamp-2",
                      item.ok ? "font-medium text-ink-600" : "font-semibold text-warn-strong"
                    )}
                  >
                    {item.ok ? item.okText : item.badText}
                  </p>
                </div>
              </div>

              <div className="mt-3.5 border-t border-ink-100/80 pt-3">
                <Button
                  size="sm"
                  variant={item.ok ? "secondary" : "primary"}
                  className="w-full text-xs font-semibold py-1.5 h-8 min-h-[34px]"
                  onClick={item.action}
                >
                  {item.actionLabel}
                  <ChevronRight className="ml-1 h-3 w-3 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Peringatan Tindakan jika ada */}
      {needsAction.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 shadow-flat">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800 border border-amber-200">
                <ClipboardList className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold text-amber-950">
                  Perlu perhatian pemilik toko ({needsAction.length} hal):
                </p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {needsAction.map((n) => (
                    <span
                      key={n.label}
                      className="inline-flex items-center gap-1.5 rounded-md bg-white/80 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900"
                    >
                      <AlertTriangle className="h-3 w-3 text-amber-600" />
                      <strong>{n.label}:</strong> {n.badText}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {needsAction.some((n) => n.action) && (
              <Button
                size="sm"
                variant="primary"
                onClick={needsAction[0].action}
                className="shrink-0 bg-amber-900 hover:bg-amber-950 text-white border-none shadow-sm"
              >
                Selesaikan Sekarang
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Feed 5 Pesanan Terbaru Nyata */}
      <Card className="border-ink-200">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-bold text-ink">Aktivitas Pesanan Terbaru</h3>
            <p className="text-2xs text-ink-500">5 transaksi terakhir yang tercatat di sistem.</p>
          </div>
          {onGoOrders && (
            <Button size="sm" variant="secondary" onClick={onGoOrders}>
              Lihat Semua ({orders.length})
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <CardBody className="p-0">
          {orders.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Receipt className="h-6 w-6" />}
                title="Belum Ada Pesanan"
                description="Pesanan pelanggan akan otomatis tercatat di sini saat proses checkout selesai."
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
                      {ord.buyer_name || "Pelanggan WhatsApp"} ({ord.buyer_jid.split("@")[0]})
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

      {/* Pusat Kendali Operasional Toko (6 Kartu Navigasi Utama) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500">
            Pusat Kendali Operasional
          </h2>
          <span className="text-2xs text-ink-400">Pilih modul untuk dikelola</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card 1: Simulator */}
          <Card className="group flex flex-col justify-between p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-raised">
            <div>
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-emerald-200/80 bg-emerald-50 text-emerald-700 shadow-flat">
                  <Bot className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-2xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                  Uji Live
                </span>
              </div>
              <h3 className="mt-3.5 text-base font-bold text-ink">Simulator WhatsApp AI</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-600">
                Uji langsung gaya bicara bot, respon katalog, dan persona CS pada simulasi chat 1:1 tanpa menyentuh nomor asli.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-ink-100">
              <Button variant="primary" size="sm" className="w-full text-xs font-semibold" onClick={onGoSimulator}>
                Buka Simulator WA
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </Card>

          {/* Card 2: Produk & AI */}
          <Card className="group flex flex-col justify-between p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-raised">
            <div>
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-sky-200/80 bg-sky-50 text-sky-700 shadow-flat">
                  <ShoppingBag className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-2xs font-mono font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200/60">
                  Katalog SKU
                </span>
              </div>
              <h3 className="mt-3.5 text-base font-bold text-ink">Katalog Produk & AI</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-600">
                Kelola database produk, varian ukuran/warna, harga coret, serta sinkronisasi instan ke basis pengetahuan AI.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-ink-100">
              <Button variant="secondary" size="sm" className="w-full text-xs font-semibold" onClick={onGoProducts}>
                Kelola Produk
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </Card>

          {/* Card 3: Promosi & Pengiriman */}
          <Card className="group flex flex-col justify-between p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-raised">
            <div>
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-amber-200/80 bg-amber-50 text-amber-700 shadow-flat">
                  <Tag className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-2xs font-mono font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                  Promo & Jam
                </span>
              </div>
              <h3 className="mt-3.5 text-base font-bold text-ink">Promosi & Jam Pengiriman</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-600">
                Atur diskon beli banyak (bundling), kupon voucher, dan batas jam cut-off kirim same day agar diinformasikan otomatis oleh AI.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-ink-100">
              <Button variant="secondary" size="sm" className="w-full text-xs font-semibold" onClick={onGoPromos}>
                Atur Promosi & Jadwal
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </Card>

          {/* Card 4: AI Website Builder */}
          <Card className="group flex flex-col justify-between p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-raised">
            <div>
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-purple-200/80 bg-purple-50 text-purple-700 shadow-flat">
                  <Globe className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-2xs font-mono font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200/60">
                  Landing Page
                </span>
              </div>
              <h3 className="mt-3.5 text-base font-bold text-ink">AI Website Builder</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-600">
                Buat landing page toko online instan dengan AI generator, editor visual per-blok, dan terbitkan langsung ke publik.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-ink-100">
              <Button variant="secondary" size="sm" className="w-full text-xs font-semibold" onClick={onGoWebsite}>
                Buka Website Builder
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </Card>

          {/* Card 5: Pesanan */}
          <Card className="group flex flex-col justify-between p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-raised">
            <div>
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-emerald-200/80 bg-emerald-50 text-emerald-700 shadow-flat">
                  <Receipt className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-2xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                  Verifikasi
                </span>
              </div>
              <h3 className="mt-3.5 text-base font-bold text-ink">Pesanan & Bukti Bayar</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-600">
                Verifikasi bukti transfer dari pembeli lewat preview gambar langsung, input nomor resi kurir, dan rekap CSV.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-ink-100">
              <Button variant="secondary" size="sm" className="w-full text-xs font-semibold" onClick={onGoOrders}>
                Periksa Pesanan
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </Card>

          {/* Card 6: Live Chat */}
          <Card className="group flex flex-col justify-between p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-raised">
            <div>
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-indigo-200/80 bg-indigo-50 text-indigo-700 shadow-flat">
                  <MessageSquare className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-2xs font-mono font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/60">
                  Takeover
                </span>
              </div>
              <h3 className="mt-3.5 text-base font-bold text-ink">Live Chat & Ambil Alih</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-600">
                Pantau percakapan pembeli secara langsung dan gunakan fitur ambil alih (takeover) saat membutuhkan negosiasi khusus.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-ink-100">
              <Button variant="secondary" size="sm" className="w-full text-xs font-semibold" onClick={onGoChat}>
                Buka Live Chat
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}