"use client";

/**
 * Dashboard & Ringkasan Toko (Chapter 10.B).
 *
 * Posture Anti-Slop:
 * - Menampilkan status nyata hasil probe sistem: WhatsApp, AI Gateway, Katalog Sheets,
 *   dan antrean bukti transfer.
 * - Navigasi cepat ke 4 alur utama: Simulator WA, Katalog & SOP, Pesanan, dan Live Chat.
 * - Tanpa angka karangan, tanpa kartu generik yang tidak berfungsi.
 * - Zero em-dash (U+2014) di seluruh string.
 */

import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  MessageSquare,
  Package,
  Receipt,
  RefreshCw,
  Smartphone,
  Sparkles,
  Wallet,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusDot,
  cn,
} from "@/components/ui";

import type { Health } from "./types";

export function PanelStatus({
  health,
  error,
  loading,
  onGoWhatsapp,
  onGoSimulator,
  onGoCatalog,
  onGoOrders,
  onGoChat,
  onRefresh,
}: {
  health: Health | null;
  error: string | null;
  loading: boolean;
  onGoWhatsapp: () => void;
  onGoSimulator?: () => void;
  onGoCatalog?: () => void;
  onGoOrders?: () => void;
  onGoChat?: () => void;
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

  const waOk = health.whatsapp.connection_status === "CONNECTED";
  const aiOk = Boolean(health.ai.gateway_ok);
  const catalogOk = Boolean(health.catalog.configured);
  const hasPendingProof = health.pending_proofs > 0;

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
      okText: `Aktif (${health.ai.model || "combo-ai"})`,
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
      iconTheme: "bg-amber-50 text-amber-700 border-amber-200/80",
      label: "Katalog & Dokumen SOP",
      ok: catalogOk,
      okText: "Spreadsheet & Dokumen Aktif",
      badText: "Spreadsheet belum diatur",
      action: onGoCatalog,
      actionLabel: "Atur Dokumen",
    },
    {
      icon: <Wallet className="h-4 w-4" aria-hidden="true" />,
      iconTheme: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
      label: "Bukti Transfer Masuk",
      ok: !hasPendingProof,
      okText: "Tidak ada antrean verifikasi",
      badText: `${health.pending_proofs} bukti bayar menunggu`,
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
            Pantau status koneksi WhatsApp, respon AI persona, katalog produk, dan antrean bukti transfer secara real-time.
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

      {/* 5 Kartu Status Utama dengan Ketinggian Seragam dan Tombol Seimbang */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500">
            Kesehatan Sistem & Layanan
          </h2>
          <span className="text-2xs text-ink-400 font-mono">
            {needsAction.length === 0 ? "Semua sistem optimal" : `${needsAction.length} butuh tindakan`}
          </span>
        </div>

        <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {items.map((item) => (
            <Card
              key={item.label}
              className={cn(
                "group relative flex flex-col justify-between p-4 transition-all duration-150 hover:shadow-raised min-h-[178px]",
                !item.ok && "border-amber-200/90 bg-amber-50/20"
              )}
            >
              <div>
                {/* Header Kartu: Icon + Title + Status Badge */}
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

                {/* Deskripsi Status */}
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

              {/* Action Button: Semua 5 Kartu Selalu Memiliki Tombol Seragam di Bawah */}
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

      {/* Peringatan Butuh Tindakan Pemilik Toko (Desain Rapi & Elegan) */}
      {needsAction.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 shadow-flat">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800 border border-amber-200">
                <ClipboardList className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold text-amber-950">
                  Perlu perhatian pemilik toko ({needsAction.length} langkah):
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

      {/* Pusat Kendali Alur Kerja Toko (4 Kartu Navigasi Utama) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500">
            Pusat Kendali Toko
          </h2>
          <span className="text-2xs text-ink-400">Pilih alur kerja untuk dikelola</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

          {/* Card 2: Katalog */}
          <Card className="group flex flex-col justify-between p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-raised">
            <div>
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-sky-200/80 bg-sky-50 text-sky-700 shadow-flat">
                  <BookOpen className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-2xs font-mono font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200/60">
                  Sheets & SOP
                </span>
              </div>
              <h3 className="mt-3.5 text-base font-bold text-ink">Katalog & Dokumen SOP</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-600">
                Hubungkan link Google Sheets stok dan unggah dokumen kebijakan retur/garansi agar AI menjawab dengan tepat.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-ink-100">
              <Button variant="secondary" size="sm" className="w-full text-xs font-semibold" onClick={onGoCatalog}>
                Kelola Dokumen & Stok
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </Card>

          {/* Card 3: Pesanan */}
          <Card className="group flex flex-col justify-between p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-raised">
            <div>
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-amber-200/80 bg-amber-50 text-amber-700 shadow-flat">
                  <Receipt className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-2xs font-mono font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                  Verifikasi
                </span>
              </div>
              <h3 className="mt-3.5 text-base font-bold text-ink">Pesanan & Bukti Bayar</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-600">
                Verifikasi bukti transfer dari pembeli lewat preview gambar langsung dan cetak label pengiriman pesanan.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-ink-100">
              <Button variant="secondary" size="sm" className="w-full text-xs font-semibold" onClick={onGoOrders}>
                Periksa Pesanan
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </Card>

          {/* Card 4: Live Chat */}
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