"use client";

/**
 * Orders and payment proofs tab.
 *
 * The two step rule is the whole point of this screen: a buyer's transfer photo
 * only ever reaches UNDER_REVIEW until the owner checks the bank statement and
 * presses verify. Nothing here can be auto-confirmed by the AI.
 */

import { useMemo, useState } from "react";
import { Bell, Check, Download, ExternalLink, Printer, Receipt, RefreshCw, Truck, X } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  NoResults,
  PageHeader,
  Segmented,
  cn,
  rupiah,
  timeAgo,
  type Tone,
} from "@/components/ui";
import type { OrderRow } from "./types";

type Filter = "all" | "need_action" | "verified" | "rejected";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "need_action", label: "Perlu tindakan" },
  { id: "all", label: "Semua" },
  { id: "verified", label: "Terverifikasi" },
  { id: "rejected", label: "Ditolak" },
];

function paymentTone(status: string): Tone {
  if (status === "VERIFIED") return "signal";
  if (status === "REJECTED") return "danger";
  return "warn";
}

export function PanelPesanan({
  orders,
  counts,
  error,
  loading,
  onVerify,
  onShip,
  onRefresh,
}: {
  orders: OrderRow[];
  counts: Record<string, number>;
  error: string | null;
  loading: boolean;
  onVerify: (orderId: string, approve: boolean) => Promise<void>;
  onShip: (orderId: string, trackingNumber: string) => Promise<void>;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("need_action");
  const [query, setQuery] = useState("");
  const [actions, setActions] = useState<Record<string, boolean>>({});
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});
  const [shipping, setShipping] = useState<Record<string, boolean>>({});
  const [reminding, setReminding] = useState<Record<string, boolean>>({});
  const [reminderMsg, setReminderMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    orderNumber: string;
    amount: number;
  } | null>(null);

  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [bulkVerifying, setBulkVerifying] = useState(false);

  // Modal Ekspor Laporan Keuangan & Penjualan
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportRange, setExportRange] = useState<"today" | "7d" | "30d" | "all">("30d");
  const [exportStatus, setExportStatus] = useState<"all" | "VERIFIED" | "UNPAID">("all");

  const exportCandidates = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    return orders.filter((o) => {
      if (exportStatus !== "all" && o.payment_status !== exportStatus) {
        return false;
      }
      const t = new Date(o.created_at).getTime();
      if (exportRange === "today") return t >= todayStart;
      if (exportRange === "7d") return t >= sevenDaysAgo;
      if (exportRange === "30d") return t >= thirtyDaysAgo;
      return true;
    });
  }, [orders, exportRange, exportStatus]);

  const exportSummary = useMemo(() => {
    let totalRevenue = 0;
    let totalShipping = 0;
    for (const o of exportCandidates) {
      if (o.payment_status === "VERIFIED") {
        totalRevenue += o.total_amount;
      }
      totalShipping += (o.shipping_tariff || 0);
    }
    return {
      count: exportCandidates.length,
      revenue: totalRevenue,
      shipping: totalShipping,
    };
  }, [exportCandidates]);

  async function handleSendReminder(orderId: string) {
    setReminding((r) => ({ ...r, [orderId]: true }));
    try {
      const res = await fetch(`/api/orders/${orderId}/remind`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setReminderMsg((m) => ({ ...m, [orderId]: { ok: false, text: json.error || "Gagal kirim pengingat" } }));
      } else {
        setReminderMsg((m) => ({ ...m, [orderId]: { ok: true, text: "Pengingat WA terkirim!" } }));
      }
    } catch {
      setReminderMsg((m) => ({ ...m, [orderId]: { ok: false, text: "Jaringan bermasalah" } }));
    } finally {
      setReminding((r) => ({ ...r, [orderId]: false }));
    }
  }

  function toggleSelectOrder(id: string) {
    setSelectedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportCsv(customList?: OrderRow[]) {
    const list = customList ?? (showExportModal ? exportCandidates : orders);
    if (list.length === 0) return;
    const headers = [
      "No Order",
      "Tanggal",
      "Status Order",
      "Status Bayar",
      "Nama Pembeli",
      "No WhatsApp",
      "Subtotal (Rp)",
      "Ongkir (Rp)",
      "Kode Unik (Rp)",
      "Total Bayar (Rp)",
      "Kurir",
      "Kecamatan Tujuan",
      "No Resi",
      "Rincian Produk",
    ];
    const rows = list.map((o) => [
      `"${o.order_number}"`,
      `"${new Date(o.created_at).toLocaleString("id-ID")}"`,
      `"${o.order_status_label}"`,
      `"${o.payment_status_label}"`,
      `"${(o.buyer_name ?? "").replace(/"/g, '""')}"`,
      `"${o.buyer_jid ? o.buyer_jid.split("@")[0] : "-"}"`,
      o.subtotal || (o.total_amount - (o.shipping_tariff || 0) - (o.unique_code || 0)),
      o.shipping_tariff || 0,
      o.unique_code || 0,
      o.total_amount,
      `"${o.courier ?? ""}"`,
      `"${(o.destination_subdistrict ?? "").replace(/"/g, '""')}"`,
      `"${o.tracking_number ?? ""}"`,
      `"${o.items.map((i) => `${i.name} (${i.variant || "-"}) x${i.qty}`).join("; ").replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `laporan-penjualan-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  }

  async function handleBulkVerify() {
    const idsToVerify = Array.from(selectedOrders).filter((id) => {
      const ord = orders.find((o) => o.id === id);
      return (
        ord &&
        (ord.payment_status === "PROOF_SUBMITTED" || ord.payment_status === "UNDER_REVIEW")
      );
    });
    if (idsToVerify.length === 0) return;
    setBulkVerifying(true);
    try {
      for (const id of idsToVerify) {
        await onVerify(id, true);
      }
      setSelectedOrders(new Set());
    } finally {
      setBulkVerifying(false);
    }
  }

  function handleBulkExportCsv() {
    const targetOrders = orders.filter((o) => selectedOrders.has(o.id));
    if (targetOrders.length === 0) return;
    exportCsv(targetOrders);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter === "need_action") {
        if (o.payment_status !== "PROOF_SUBMITTED" && o.payment_status !== "UNDER_REVIEW") return false;
      } else if (filter === "verified" && o.payment_status !== "VERIFIED") {
        return false;
      } else if (filter === "rejected" && o.payment_status !== "REJECTED") {
        return false;
      }
      if (!q) return true;
      return (
        o.order_number.toLowerCase().includes(q) ||
        (o.buyer_name ?? "").toLowerCase().includes(q) ||
        o.buyer_jid.toLowerCase().includes(q)
      );
    });
  }, [orders, filter, query]);

  async function act(orderId: string, approve: boolean) {
    setActions((a) => ({ ...a, [orderId]: true }));
    try {
      await onVerify(orderId, approve);
    } finally {
      setActions((a) => ({ ...a, [orderId]: false }));
    }
  }

  const needActionCount =
    (counts.PROOF_SUBMITTED ?? 0) + (counts.UNDER_REVIEW ?? 0);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Penjualan"
        title="Pesanan dan bukti bayar"
        description="Bukti transfer dari pembeli hanya berstatus diperiksa sampai Anda cek mutasi rekening dan klik verifikasi. Ini yang menutup celah struk editan."
        icon={<Receipt className="h-4 w-4" aria-hidden="true" />}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowExportModal(true)}
              disabled={orders.length === 0}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Ekspor Laporan
            </Button>
            <Button variant="secondary" onClick={onRefresh} loading={loading}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Muat ulang
            </Button>
          </div>
        }
      />

      {/* status counters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(["UNPAID", "PROOF_SUBMITTED", "UNDER_REVIEW", "VERIFIED", "REJECTED"] as const).map(
          (s) => (
            <Card key={s} className="p-3">
              <p className="text-2xs font-semibold uppercase tracking-wide text-ink-500">
                {s.replace("_", " ")}
              </p>
              <p
                className={cn(
                  "mt-1.5 font-mono text-lg font-bold tabular-nums",
                  s === "VERIFIED" ? "text-signal-strong" : s === "REJECTED" ? "text-danger" : "text-ink"
                )}
              >
                {counts[s] ?? 0}
              </p>
            </Card>
          )
        )}
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label="Filter status pembayaran"
            items={FILTERS.map((f) => ({
              ...f,
              count: f.id === "need_action" ? needActionCount : undefined,
            }))}
            value={filter}
            onChange={setFilter}
          />
          {filtered.length > 0 && (
            <label className="flex items-center gap-2 text-xs font-medium text-ink-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selectedOrders.size > 0 && selectedOrders.size === filtered.length}
                onChange={() => {
                  if (selectedOrders.size === filtered.length) {
                    setSelectedOrders(new Set());
                  } else {
                    setSelectedOrders(new Set(filtered.map((o) => o.id)));
                  }
                }}
                className="h-4 w-4 rounded border-ink-300 text-signal focus:ring-signal"
              />
              <span>Pilih Semua ({filtered.length})</span>
            </label>
          )}
        </div>
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <label htmlFor="order-search" className="sr-only">
            Cari pesanan
          </label>
          <input
            id="order-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nomor pesanan atau pembeli..."
            className="field field-sm"
            autoComplete="off"
          />
        </div>
      </div>

      {error && (
        <ErrorState
          title="Gagal memuat pesanan"
          description={error}
          action={
            <Button variant="secondary" onClick={onRefresh}>
              Coba lagi
            </Button>
          }
        />
      )}

      {!error && loading && orders.length === 0 && <LoadingState rows={3} />}

      {!error && !loading && orders.length === 0 && (
        <Card>
          <EmptyState
            icon={<Receipt className="h-5 w-5" aria-hidden="true" />}
            title="Belum ada pesanan"
            description="Pesanan muncul otomatis begitu bot menyusun rincian tagihan untuk pembeli."
          />
        </Card>
      )}

      {!error && orders.length > 0 && filtered.length === 0 && (
        <Card>
          <NoResults query={query || FILTERS.find((f) => f.id === filter)?.label || ""} />
        </Card>
      )}

      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((o) => {
            const awaiting =
              o.payment_status === "PROOF_SUBMITTED" || o.payment_status === "UNDER_REVIEW";
            const busyAction = Boolean(actions[o.id]);
            const isSelected = selectedOrders.has(o.id);
            return (
              <Card
                key={o.id}
                className={cn(
                  awaiting && "border-warn/40",
                  isSelected && "ring-2 ring-signal/50 border-signal/40"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-200 px-5 py-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectOrder(o.id)}
                      aria-label={`Pilih pesanan ${o.order_number}`}
                      className="mt-1 h-4 w-4 rounded border-ink-300 text-signal focus:ring-signal cursor-pointer shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-sm font-bold text-ink">{o.order_number}</p>
                        <Badge tone={paymentTone(o.payment_status)}>{o.payment_status_label}</Badge>
                        <Badge>{o.order_status_label}</Badge>
                      </div>
                      <p className="mt-1.5 text-sm text-ink-600">
                        {o.buyer_name ?? "Tanpa nama"}{" "}
                        <span className="font-mono text-xs text-ink-400">
                          {o.buyer_jid ? o.buyer_jid.split("@")[0] : "-"}
                        </span>
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                        <span className="inline-flex items-center gap-1">
                          <Truck className="h-3 w-3" aria-hidden="true" />
                          {o.courier ?? "-"} ke {o.destination_subdistrict ?? "-"}
                          {o.shipping_is_estimate ? " (ongkir estimasi)" : ""}
                        </span>
                        <span>{timeAgo(o.created_at)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-lg font-bold tabular-nums text-ink">
                      Rp {rupiah(o.total_amount)}
                    </p>
                    <p className="mt-0.5 text-2xs text-ink-500">
                      subtotal Rp {rupiah(o.subtotal)} + ongkir Rp {rupiah(o.shipping_tariff)} + kode{" "}
                      {o.unique_code}
                    </p>
                  </div>
                </div>

                <div className="px-5 py-4 overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[320px]">
                    <thead>
                      <tr className="text-2xs uppercase tracking-wide text-ink-500">
                        <th className="pb-2 font-semibold">SKU</th>
                        <th className="pb-2 font-semibold">Produk</th>
                        <th className="pb-2 text-right font-semibold">Qty</th>
                        <th className="pb-2 text-right font-semibold">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-200">
                      {o.items.map((it) => (
                        <tr key={it.sku}>
                          <td className="py-2 font-mono text-ink-600">{it.sku}</td>
                          <td className="py-2 text-ink break-words max-w-xs">
                            {it.name}
                            {it.variant ? (
                              <span className="text-ink-500"> - {it.variant}</span>
                            ) : null}
                          </td>
                          <td className="py-2 text-right font-mono tabular-nums text-ink">
                            {it.qty}
                          </td>
                          <td className="py-2 text-right font-mono tabular-nums text-ink">
                            Rp {rupiah(it.line_total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 bg-ink-50/60 px-5 py-3">
                  <div>
                    {o.proof_media_url ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewImage({
                              url: o.proof_media_url!,
                              orderNumber: o.order_number,
                              amount: o.total_amount,
                            })
                          }
                          className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-signal-strong hover:underline"
                        >
                          <Receipt className="h-3.5 w-3.5 text-signal" aria-hidden="true" />
                          Lihat bukti transfer
                        </button>
                        <a
                          href={o.proof_media_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-ink-400 hover:text-ink-600"
                          title="Buka gambar di tab baru"
                        >
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 items-start">
                        <span className="text-xs text-ink-500">Belum ada bukti transfer diunggah.</span>
                        {o.payment_status === "UNPAID" && (
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={reminding[o.id]}
                              onClick={() => handleSendReminder(o.id)}
                              className="text-xs py-1 px-2.5 h-auto font-medium text-amber-800 border-amber-300 bg-amber-50/60 hover:bg-amber-100/80 transition-colors"
                              title="Kirim pesan pengingat rekening & tagihan via WhatsApp"
                            >
                              <Bell className="h-3 w-3 mr-1 text-amber-600" aria-hidden="true" />
                              Ingatkan Bayar via WA
                            </Button>
                            {reminderMsg[o.id] && (
                              <span
                                className={cn(
                                  "text-[11px] font-medium px-2 py-0.5 rounded",
                                  reminderMsg[o.id].ok
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-rose-50 text-rose-700 border border-rose-200"
                                )}
                              >
                                {reminderMsg[o.id].text}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {awaiting && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="accent"
                        loading={busyAction}
                        onClick={() => act(o.id, true)}
                      >
                        {!busyAction && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                        Verifikasi pembayaran
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busyAction}
                        onClick={() => act(o.id, false)}
                      >
                        {!busyAction && <X className="h-3.5 w-3.5" aria-hidden="true" />}
                        Tolak bukti
                      </Button>
                    </div>
                  )}

                  {o.payment_status === "VERIFIED" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`/api/orders/${o.id}/label`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 bg-white px-2.5 py-1 text-xs font-semibold text-ink-700 shadow-flat hover:bg-ink-50 hover:text-ink-900 transition-colors"
                        title="Cetak label pengiriman thermal 100x150 mm"
                      >
                        <Printer className="h-3.5 w-3.5 text-ink-600" aria-hidden="true" />
                        Label Thermal
                      </a>

                      <a
                        href={`/api/orders/${o.id}/receipt`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 bg-white px-2.5 py-1 text-xs font-semibold text-ink-700 shadow-flat hover:bg-ink-50 hover:text-ink-900 transition-colors"
                        title="Cetak struk nota belanja pelanggan"
                      >
                        <Receipt className="h-3.5 w-3.5 text-ink-600" aria-hidden="true" />
                        Nota Struk
                      </a>

                      {o.tracking_number ? (
                        <div className="inline-flex items-center gap-1.5 rounded bg-signal-wash px-2.5 py-1 text-xs font-semibold text-signal-strong">
                          <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                          Resi: <span className="font-mono">{o.tracking_number}</span>
                          {o.courier && <span className="text-ink-500">({o.courier})</span>}
                          <a
                            href={`https://berdu.id/cek-resi?resi=${encodeURIComponent(o.tracking_number.trim())}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 inline-flex items-center gap-1 rounded border border-emerald-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-signal-strong shadow-xs hover:bg-emerald-50 transition-colors"
                            title="Lacak posisi paket langsung di portal kurir"
                          >
                            <span>Lacak</span>
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="Nomor resi..."
                            value={trackingInputs[o.id] ?? ""}
                            onChange={(e) =>
                              setTrackingInputs((prev) => ({ ...prev, [o.id]: e.target.value }))
                            }
                            className="w-40 rounded border border-ink-300 bg-white px-2.5 py-1 text-xs text-ink placeholder:text-ink-400 focus:border-ink-500 focus:outline-none"
                          />
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={!(trackingInputs[o.id] ?? "").trim()}
                            loading={shipping[o.id]}
                            onClick={async () => {
                              const resi = (trackingInputs[o.id] ?? "").trim();
                              if (!resi) return;
                              setShipping((s) => ({ ...s, [o.id]: true }));
                              try {
                                await onShip(o.id, resi);
                              } finally {
                                setShipping((s) => ({ ...s, [o.id]: false }));
                              }
                            }}
                          >
                            <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                            Input Resi
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Floating Bulk Actions Bar */}
      {selectedOrders.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-ink-800 bg-ink-900 px-5 py-3 text-white shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="rounded bg-white/20 px-2 py-0.5 font-mono font-bold text-white">
              {selectedOrders.size}
            </span>
            <span>pesanan dipilih</span>
          </div>
          <div className="h-4 w-px bg-white/20" />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={handleBulkVerify}
              loading={bulkVerifying}
              className="bg-signal-strong hover:bg-signal text-white"
            >
              <Check className="h-3.5 w-3.5" />
              Verifikasi Terpilih
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleBulkExportCsv}
              className="bg-white/10 hover:bg-white/20 text-white border-transparent"
            >
              <Download className="h-3.5 w-3.5" />
              Ekspor CSV
            </Button>
            <button
              type="button"
              onClick={() => setSelectedOrders(new Set())}
              className="rounded p-1 text-white/70 hover:text-white transition-colors"
              title="Batal pilih"
              aria-label="Batal pilih"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Lightbox Preview Modal */}
      <Modal open={Boolean(previewImage)} onClose={() => setPreviewImage(null)}>
        {previewImage && (
          <div
            className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
              <div>
                <p className="font-mono text-sm font-bold text-ink">
                  Bukti Transfer #{previewImage.orderNumber}
                </p>
                <p className="text-xs text-ink-500">
                  Total Tagihan: Rp {rupiah(previewImage.amount)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                aria-label="Tutup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex max-h-[70vh] items-center justify-center overflow-auto bg-ink-950 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage.url}
                alt={`Bukti transfer pesanan ${previewImage.orderNumber}`}
                className="max-h-[65vh] w-auto max-w-full rounded object-contain shadow"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-ink-200 bg-ink-50 px-4 py-2.5">
              <a
                href={previewImage.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Buka gambar asli
              </a>
              <Button size="sm" variant="secondary" onClick={() => setPreviewImage(null)}>
                Tutup
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Ekspor Laporan Penjualan & Keuangan */}
      <Modal open={showExportModal} onClose={() => setShowExportModal(false)}>
        <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-ink-200 px-5 py-4">
            <div>
              <h3 className="font-bold text-ink-900 text-sm">Ekspor Laporan Penjualan & Keuangan</h3>
              <p className="text-xs text-ink-500">Unduh data transaksi ke format CSV / Excel dengan filter fleksibel.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowExportModal(false)}
              className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              aria-label="Tutup"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-5 space-y-4 text-xs">
            {/* Periode Tanggal */}
            <div>
              <label className="font-semibold text-ink-700 block mb-1.5">Periode Transaksi</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  { id: "today", label: "Hari Ini" },
                  { id: "7d", label: "7 Hari" },
                  { id: "30d", label: "30 Hari" },
                  { id: "all", label: "Semua Waktu" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setExportRange(p.id as any)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-center font-medium transition-all text-xs",
                      exportRange === p.id
                        ? "border-ink-900 bg-ink-900 text-white shadow-xs"
                        : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Pembayaran */}
            <div>
              <label className="font-semibold text-ink-700 block mb-1.5">Filter Status Pembayaran</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "all", label: "Semua Status" },
                  { id: "VERIFIED", label: "Hanya Terverifikasi" },
                  { id: "UNPAID", label: "Belum Dibayar" },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setExportStatus(st.id as any)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-center font-medium transition-all text-xs",
                      exportStatus === st.id
                        ? "border-signal-strong bg-signal-wash text-signal-strong font-semibold shadow-xs"
                        : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
                    )}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ringkasan Hasil Filter */}
            <div className="rounded-lg border border-ink-200 bg-ink-50 p-3 space-y-1.5">
              <div className="flex justify-between items-center text-ink-600">
                <span>Pesanan Terfilter:</span>
                <span className="font-mono font-bold text-ink-900">{exportSummary.count} transaksi</span>
              </div>
              <div className="flex justify-between items-center text-ink-600">
                <span>Total Omzet Terverifikasi:</span>
                <span className="font-mono font-bold text-signal-strong">Rp {rupiah(exportSummary.revenue)}</span>
              </div>
              <div className="flex justify-between items-center text-ink-600">
                <span>Total Ongkos Kirim:</span>
                <span className="font-mono font-medium text-ink-700">Rp {rupiah(exportSummary.shipping)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-ink-200 bg-ink-50 px-5 py-3">
            <Button size="sm" variant="secondary" onClick={() => setShowExportModal(false)}>
              Batal
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={exportSummary.count === 0}
              onClick={() => exportCsv(exportCandidates)}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Unduh CSV ({exportSummary.count})
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
