"use client";

/**
 * Subscription tab. Real platform pricing, in-page Midtrans Snap popup,
 * automated & on-demand sync, and complete subscription & payment history.
 */

import { useState } from "react";
import { ArrowUpRight, CalendarClock, CreditCard, Download, Info, Receipt, RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  LoadingState,
  Meter,
  PageHeader,
  cn,
  rupiah,
} from "@/components/ui";
import type { Billing, SubscriptionHistoryItem } from "./types";

const FALLBACK_MONTHLY = 199000;
const FALLBACK_ANNUAL = 1490000;
const TRIAL_DAYS = 7;

export function formatPlanName(plan: string | null | undefined, isTrial = false): string {
  if (!plan) return isTrial ? "Uji Coba Gratis" : "Belum Berlangganan";
  if (plan === "PRO_MONTHLY") return "Noewbar CS Pro Bulanan";
  if (plan === "PRO_ANNUAL") return "Noewbar CS Pro Tahunan";
  if (plan === "TRIAL" || plan === "Uji Coba Gratis") return "Uji Coba Gratis";
  return plan.replace(/_/g, " ");
}

export function formatPaymentType(type: string | null | undefined): string {
  if (!type) return "Belum Ditentukan";
  const map: Record<string, string> = {
    credit_card: "Kartu Kredit",
    qris: "QRIS",
    bca_va: "BCA Virtual Account",
    bni_va: "BNI Virtual Account",
    bri_va: "BRI Virtual Account",
    mandiri_va: "Mandiri Bill",
    permata_va: "Permata VA",
    gopay: "GoPay",
    shopeepay: "ShopeePay",
    bank_transfer: "Transfer Bank",
    midtrans_verified: "Midtrans Otomatis",
  };
  return map[type.toLowerCase()] ?? type.replace(/_/g, " ");
}

export function formatSubscriptionStatus(status: string) {
  switch (status) {
    case "ACTIVE":
      return { label: "Aktif", tone: "signal" as const };
    case "TRIAL":
      return { label: "Uji Coba", tone: "warn" as const };
    case "GRACE_PERIOD":
      return { label: "Masa Tenggang", tone: "warn" as const };
    case "EXPIRED":
      return { label: "Kedaluwarsa", tone: "neutral" as const };
    default:
      return { label: status, tone: "neutral" as const };
  }
}

export function PanelBilling({
  billing,
  loading,
  hasError,
  onCheckout,
  onRefresh,
  onSync,
}: {
  billing: Billing | null;
  loading: boolean;
  hasError: boolean;
  onCheckout: (plan: "PRO_MONTHLY" | "PRO_ANNUAL") => Promise<string | null>;
  onRefresh: () => void;
  onSync?: () => Promise<{ ok: boolean; message: string; activated?: boolean }>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sub = billing?.subscription;
  const active = sub?.status === "ACTIVE";
  const trial = sub?.status === "TRIAL" || sub?.status === "NONE";
  const monthlyPlan = billing?.plans?.find((pl) => pl.id === "PRO_MONTHLY");
  const annualPlan = billing?.plans?.find((pl) => pl.id === "PRO_ANNUAL");
  const MONTHLY = monthlyPlan?.price ?? FALLBACK_MONTHLY;
  const ANNUAL = annualPlan?.price ?? FALLBACK_ANNUAL;
  const ANNUAL_SAVING = annualPlan?.savings ?? MONTHLY * 12 - ANNUAL;
  const days = sub?.daysRemaining ?? null;
  const isAnnual = sub?.planName === "PRO_ANNUAL";
  const window = trial ? TRIAL_DAYS : isAnnual ? 365 : 30;
  const used = days !== null ? Math.min(window, Math.max(0, window - days)) : 0;

  async function pay(plan: "PRO_MONTHLY" | "PRO_ANNUAL") {
    setBusy(plan);
    setMessage(null);
    setError(null);
    try {
      const result = await onCheckout(plan);
      if (result) setMessage(result);
    } catch {
      setError("Gagal membuat pesanan pembayaran.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSync(orderId?: string) {
    setSyncing(true);
    setMessage(null);
    setError(null);
    try {
      if (onSync && !orderId) {
        const res = await onSync();
        setMessage(res.message);
      } else {
        const res = await fetch("/api/billing/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: orderId }),
        });
        const json = await res.json();
        if (json.ok) {
          setMessage(json.message ?? "Status pembayaran berhasil diperbarui.");
          onRefresh();
        } else {
          setError(json.error ?? "Gagal memeriksa pembayaran.");
        }
      }
    } catch {
      setError("Gagal menghubungi server saat memeriksa status pembayaran.");
    } finally {
      setSyncing(false);
    }
  }

  function downloadReceipt() {
    if (!sub) return;
    const content = `NOEWBAR CS PRO - BUKTI STATUS LANGGANAN RESMI\n==============================================\nStatus Langganan : ${sub.status}\nPaket Aktif      : ${formatPlanName(sub.planName, trial)}\nSisa Masa Aktif  : ${sub.daysRemaining ?? "-"} hari\nBatas Berlaku    : ${sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString("id-ID") : "-"}\nID Pesanan       : ${sub.midtransOrderId ?? "-"}\nTanggal Unduh    : ${new Date().toLocaleDateString("id-ID")}\n==============================================\nPlatform Noewbar CS Pro - Layanan Terverifikasi`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bukti-langganan-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadReceiptItem(item: SubscriptionHistoryItem) {
    const content = `NOEWBAR CS PRO - BUKTI PEMBAYARAN RESMI\n==============================================\nNomor Invoice    : ${item.invoice_reference}\nOrder ID Gateway : ${item.order_id ?? "-"}\nStatus Transaksi : ${item.status}\nPaket Langganan  : ${formatPlanName(item.plan_name)}\nNominal Tagihan  : Rp ${rupiah(item.amount)}\nMetode Bayar     : ${formatPaymentType(item.payment_type)}\nTanggal Transaksi: ${new Date(item.created_at).toLocaleString("id-ID")}\nMasa Aktif s/d   : ${new Date(item.expires_at).toLocaleDateString("id-ID")}\n==============================================\nPlatform Noewbar CS Pro - Layanan Terverifikasi`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kuitansi-${item.order_id ?? item.id.slice(0, 8)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading && !billing) {
    return (
      <div className="page">
        <PageHeader eyebrow="Akun" title="Langganan" />
        <LoadingState rows={2} />
      </div>
    );
  }

  if (hasError && !billing) {
    return (
      <div className="page">
        <PageHeader eyebrow="Akun" title="Langganan" />
        <ErrorState
          title="Tidak dapat membaca status langganan"
          description="Layanan penagihan tidak menjawab. Status di bawah tidak diketahui, bukan berarti tidak aktif."
          action={
            <Button variant="secondary" onClick={onRefresh}>
              Coba lagi
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="page space-y-6">
      <PageHeader
        eyebrow="Akun"
        title="Langganan"
        description="Satu langganan mencakup satu nomor WhatsApp toko. Semua fitur terbuka di kedua paket."
        icon={<CreditCard className="h-4 w-4" aria-hidden="true" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={syncing}
              onClick={() => handleSync()}
              title="Periksa konfirmasi pembayaran Midtrans"
            >
              {!syncing && <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}
              Cek Pembayaran
            </Button>
            {sub && (
              <Button variant="secondary" size="sm" onClick={downloadReceipt}>
                <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Unduh Bukti
              </Button>
            )}
          </div>
        }
      />

      {/* Current plan */}
      <Card>
        <CardHeader
          icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
          title="Paket aktif"
          actions={
            <Badge tone={active ? "signal" : trial ? "warn" : "danger"}>
              {sub?.status === "NONE" ? "TRIAL" : (sub?.status ?? "TIDAK DIKETAHUI")}
            </Badge>
          }
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-ink">
                {formatPlanName(sub?.planName, trial)}
              </p>
              <p className="mt-0.5 text-sm text-ink-500">
                {days !== null
                  ? `${days} hari tersisa`
                  : sub?.expiresAt
                    ? `berakhir ${new Date(sub.expiresAt).toLocaleDateString("id-ID")}`
                    : "tanggal berakhir belum tersedia"}
              </p>
            </div>
            {sub?.amount != null && (
              <p className="font-mono text-lg font-bold tabular-nums text-ink">
                Rp {rupiah(sub.amount)}
                <span className="ml-1 text-xs font-normal text-ink-500">/ periode</span>
              </p>
            )}
          </div>

          {days !== null && (
            <div>
              <div className="mb-1.5 flex items-center justify-between text-2xs text-ink-500">
                <span>{trial ? "Masa uji coba" : "Siklus berjalan"}</span>
                <span className="font-mono tabular-nums">
                  {used} / {window} hari terpakai
                </span>
              </div>
              <Meter
                value={used}
                max={window}
                tone={days <= 2 ? "danger" : days <= 5 ? "warn" : "signal"}
                label="Pemakaian masa langganan"
              />
            </div>
          )}

          {trial && (
            <div className="flex items-start gap-2.5 rounded border border-warn/25 bg-warn-wash px-3 py-2.5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-warn">
                Setelah uji coba berakhir, bot otomatis nonaktif tanpa tagihan tersembunyi sampai
                Anda melakukan pembayaran.
              </p>
            </div>
          )}

          {sub?.midtransOrderId && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-ink-100 bg-ink-50 px-3 py-2 text-xs text-ink-600">
              <div>
                <span className="text-ink-400">ID Pesanan Aktif: </span>
                <span className="font-mono font-medium text-ink-800">{sub.midtransOrderId}</span>
              </div>
              <button
                type="button"
                onClick={() => handleSync(sub.midtransOrderId ?? undefined)}
                disabled={syncing}
                className="inline-flex items-center gap-1 font-medium text-signal hover:underline disabled:opacity-50"
              >
                {!syncing && <RefreshCw className="h-3 w-3" />}
                Cek status transaksi
              </button>
            </div>
          )}
        </CardBody>
      </Card>

      {message && (
        <div className="rounded border border-signal/25 bg-signal-wash px-4 py-3 text-sm font-medium text-signal-strong flex items-center justify-between">
          <span>{message}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-signal-strong/70 hover:text-signal-strong text-xs font-semibold ml-3"
          >
            Tutup
          </button>
        </div>
      )}
      {error && <ErrorState title="Pembayaran gagal diproses" description={error} compact />}

      {/* Subscription Plans */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader title="Bulanan" description="Fleksibel berhenti kapan saja." />
          <CardBody className="flex flex-1 flex-col">
            <p className="font-mono text-3xl font-bold tabular-nums text-ink">Rp {rupiah(MONTHLY)}</p>
            <p className="mt-1 text-xs text-ink-500">
              per bulan, setara Rp {rupiah(monthlyPlan?.per_day ?? Math.round(MONTHLY / 30))} per hari
            </p>
            <div className="mt-5 flex-1" />
            <Button
              variant="secondary"
              className="w-full"
              loading={busy === "PRO_MONTHLY"}
              onClick={() => pay("PRO_MONTHLY")}
            >
              Bayar bulanan
              {busy !== "PRO_MONTHLY" && <ArrowUpRight className="h-4 w-4" aria-hidden="true" />}
            </Button>
          </CardBody>
        </Card>

        <Card className={cn("flex flex-col", "border-2 border-ink")}>
          <CardHeader
            title="Tahunan"
            description={`Hemat Rp ${rupiah(ANNUAL_SAVING)} dibanding bayar bulanan.`}
            actions={<Badge tone="signal">Paling hemat</Badge>}
          />
          <CardBody className="flex flex-1 flex-col">
            <p className="font-mono text-3xl font-bold tabular-nums text-ink">Rp {rupiah(ANNUAL)}</p>
            <p className="mt-1 text-xs text-ink-500">
              per tahun, setara Rp {rupiah(annualPlan?.per_month ?? Math.round(ANNUAL / 12))} per bulan
            </p>
            <div className="mt-5 flex-1" />
            <Button
              variant="primary"
              className="w-full"
              loading={busy === "PRO_ANNUAL"}
              onClick={() => pay("PRO_ANNUAL")}
            >
              Bayar tahunan
              {busy !== "PRO_ANNUAL" && <ArrowUpRight className="h-4 w-4" aria-hidden="true" />}
            </Button>
          </CardBody>
        </Card>
      </div>

      {/* Riwayat Pembayaran & Langganan */}
      <Card>
        <CardHeader
          icon={<Receipt className="h-4 w-4" aria-hidden="true" />}
          title="Riwayat Pembayaran & Langganan"
          description="Daftar seluruh transaksi pembayaran langganan toko Anda yang tercatat di sistem."
          actions={
            billing?.history?.length ? (
              <Badge tone="neutral">{billing.history.length} Transaksi</Badge>
            ) : undefined
          }
        />
        <CardBody className="p-0">
          {!billing?.history || billing.history.length === 0 ? (
            <div className="p-8 text-center text-sm text-ink-500">
              Belum ada riwayat transaksi pembayaran langganan.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-ink-100 bg-ink-50/50 text-xs font-semibold text-ink-600">
                  <tr>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">No. Invoice & Order ID</th>
                    <th className="px-4 py-3">Paket</th>
                    <th className="px-4 py-3">Metode Bayar</th>
                    <th className="px-4 py-3 text-right">Nominal</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {billing.history.map((item) => {
                    const st = formatSubscriptionStatus(item.status);
                    return (
                      <tr key={item.id} className="hover:bg-ink-50/40 transition-colors">
                        <td className="px-4 py-3 text-xs text-ink-600 whitespace-nowrap">
                          {new Date(item.created_at).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                          <span className="block text-2xs text-ink-400">
                            {new Date(item.created_at).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            WIB
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs font-medium text-ink-800">
                            {item.invoice_reference}
                          </p>
                          {item.order_id && (
                            <p className="font-mono text-2xs text-ink-400">{item.order_id}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-ink">
                          {formatPlanName(item.plan_name)}
                        </td>
                        <td className="px-4 py-3 text-xs text-ink-600">
                          {formatPaymentType(item.payment_type)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-ink tabular-nums whitespace-nowrap">
                          Rp {rupiah(item.amount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {item.status !== "ACTIVE" && item.order_id && (
                              <button
                                type="button"
                                onClick={() => handleSync(item.order_id ?? undefined)}
                                disabled={syncing}
                                className="inline-flex items-center gap-1 rounded border border-ink-200 px-2.5 py-1 text-2xs font-medium text-ink-700 hover:bg-ink-100 transition-colors disabled:opacity-50"
                                title="Periksa status transaksi ke Midtrans"
                              >
                                <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin")} />
                                Cek
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => downloadReceiptItem(item)}
                              className="inline-flex items-center gap-1 rounded border border-ink-200 px-2.5 py-1 text-2xs font-medium text-ink-700 hover:bg-ink-100 transition-colors"
                              title="Unduh kuitansi resmi transaksi ini"
                            >
                              <Download className="h-3 w-3" />
                              Kuitansi
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <p className="text-xs leading-relaxed text-ink-500">
        Pembayaran diproses Midtrans melalui QRIS, virtual account semua bank, dan e-wallet. Dana
        pembeli tidak pernah masuk ke Noewbar, hanya biaya langganan yang ditagih di sini.
      </p>
    </div>
  );
}
