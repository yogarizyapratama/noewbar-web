"use client";

/**
 * Panel Manajemen Promosi, Voucher, dan Jadwal Pengiriman Toko.
 *
 * Fitur:
 * 1. Aturan Promo Bundling (Tier Diskon Otomatis):
 *    - Toko dapat menambah, mengedit, dan menghapus diskon kuantitas.
 *    - Dilengkapi kalkulator uji simulasi perhitungan langsung.
 * 2. Kupon Diskon & Kode Voucher Toko:
 *    - Toko dapat membuat kode kupon berpotongan nominal Rp atau persentase %.
 *    - Dilengkapi penguji validasi kode kupon real-time.
 * 3. Jam Operasional & Batas Cut-Off Pengiriman:
 *    - Jam buka dan jam tutup toko.
 *    - Jam batas pengiriman pesanan hari yang sama (same day).
 *    - Indikator status toko real-time (WIB).
 *
 * Standar Anti-Slop:
 * - Kontras warna WCAG AA, target sentuh minimal 44px.
 * - Zero em-dash di seluruh teks dan kode.
 * - Tanpa data dummy, tersinkronisasi penuh ke database PostgreSQL.
 */

import { useState } from "react";
import {
  AlertCircle,
  Calculator,
  CheckCircle2,
  Clock,
  Percent,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Tag,
  Trash2,
  Truck,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  cn,
  rupiah,
} from "@/components/ui";
import { BroadcastCard } from "./broadcast-card";
import type { TenantPromoTier, TenantShippingSchedule, TenantVoucher } from "./types";

export function PanelPromos({
  initialPromoRules = [],
  initialVouchers = [],
  initialShipping = { cut_off_hour: 15, open_hour: 8, close_hour: 21 },
  onRefresh,
}: {
  initialPromoRules?: TenantPromoTier[];
  initialVouchers?: TenantVoucher[];
  initialShipping?: TenantShippingSchedule;
  onRefresh: () => void;
}) {
  // State Promo Bundling
  const [promoRules, setPromoRules] = useState<TenantPromoTier[]>(initialPromoRules);
  const [newPromoName, setNewPromoName] = useState("");
  const [newPromoMinQty, setNewPromoMinQty] = useState(2);
  const [newPromoDiscount, setNewPromoDiscount] = useState(10);
  const [showAddPromo, setShowAddPromo] = useState(false);

  // State Voucher
  const [vouchers, setVouchers] = useState<TenantVoucher[]>(initialVouchers);
  const [newVoucherCode, setNewVoucherCode] = useState("");
  const [voucherType, setVoucherType] = useState<"NOMINAL" | "PERCENT">("NOMINAL");
  const [newVoucherValue, setNewVoucherValue] = useState(10000);
  const [showAddVoucher, setShowAddVoucher] = useState(false);

  // State Shipping & Operating Hours
  const [shippingCutOff, setShippingCutOff] = useState(initialShipping.cut_off_hour ?? 15);
  const [shippingOpen, setShippingOpen] = useState(initialShipping.open_hour ?? 8);
  const [shippingClose, setShippingClose] = useState(initialShipping.close_hour ?? 21);

  // Status API & Feedback
  const [savingPromos, setSavingPromos] = useState(false);
  const [savingShipping, setSavingShipping] = useState(false);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [shippingMessage, setShippingMessage] = useState<string | null>(null);
  const [shippingError, setShippingError] = useState<string | null>(null);

  // Simulator State
  const [simPrice, setSimPrice] = useState(100000);
  const [simQty, setSimQty] = useState(2);
  const [testCoupon, setTestCoupon] = useState("");
  const [testCouponResult, setTestCouponResult] = useState<string | null>(null);

  // Fast Courier Rate Calculator State
  const [calcDest, setCalcDest] = useState("");
  const [calcWeight, setCalcWeight] = useState(1000);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [calcResult, setCalcResult] = useState<{
    origin: string;
    destination: string;
    weight_kg: number;
    rates: Array<{
      courier: string;
      service_type: string;
      total_tariff: number;
      estimated_days: string;
      is_estimate: boolean;
    }>;
  } | null>(null);

  async function handleCheckRates(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!calcDest.trim()) {
      setCalcError("Silakan masukkan nama kecamatan tujuan.");
      return;
    }
    setCalcLoading(true);
    setCalcError(null);
    try {
      const res = await fetch("/api/shipping/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: calcDest.trim(),
          weight_grams: calcWeight,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setCalcResult(json);
      } else {
        setCalcError(json.error || "Gagal mendapatkan tarif pengiriman.");
      }
    } catch {
      setCalcError("Gagal menghubungi server logistik.");
    } finally {
      setCalcLoading(false);
    }
  }

  // Jam saat ini di WIB (UTC+7)
  const now = new Date();
  const utcHours = now.getUTCHours();
  const currentWibHour = (utcHours + 7) % 24;
  const isStoreOpen = currentWibHour >= shippingOpen && currentWibHour < shippingClose;
  const isBeforeCutOff = currentWibHour < shippingCutOff;

  // Handler: Tambah Promo Bundling
  function handleAddPromoTier(e: React.FormEvent) {
    e.preventDefault();
    if (!newPromoName.trim()) {
      setPromoError("Nama promo tidak boleh kosong.");
      return;
    }
    if (newPromoMinQty < 1) {
      setPromoError("Minimal pembelian harus minimal 1 pcs.");
      return;
    }
    if (newPromoDiscount <= 0 || newPromoDiscount > 100) {
      setPromoError("Diskon harus di antara 1% sampai 100%.");
      return;
    }

    const updated: TenantPromoTier = {
      promo_name: newPromoName.trim(),
      min_qty: Number(newPromoMinQty),
      discount_percent: Number(newPromoDiscount),
    };

    setPromoRules((prev) => [...prev, updated].sort((a, b) => a.min_qty - b.min_qty));
    setNewPromoName("");
    setNewPromoMinQty(2);
    setNewPromoDiscount(10);
    setShowAddPromo(false);
    setPromoError(null);
  }

  // Handler: Hapus Promo Bundling
  function handleDeletePromoTier(index: number) {
    setPromoRules((prev) => prev.filter((_, i) => i !== index));
  }

  // Handler: Tambah Voucher
  function handleAddVoucher(e: React.FormEvent) {
    e.preventDefault();
    const cleanCode = newVoucherCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (!cleanCode) {
      setPromoError("Kode kupon tidak boleh kosong.");
      return;
    }
    if (vouchers.some((v) => v.code.toUpperCase() === cleanCode)) {
      setPromoError(`Kode kupon ${cleanCode} sudah terdaftar.`);
      return;
    }
    if (newVoucherValue <= 0) {
      setPromoError("Nilai potongan harus lebih besar dari 0.");
      return;
    }

    const item: TenantVoucher = {
      code: cleanCode,
      ...(voucherType === "NOMINAL"
        ? { discount_amount: Number(newVoucherValue) }
        : { discount_percent: Math.min(100, Number(newVoucherValue)) }),
    };

    setVouchers((prev) => [...prev, item]);
    setNewVoucherCode("");
    setNewVoucherValue(10000);
    setShowAddVoucher(false);
    setPromoError(null);
  }

  // Handler: Hapus Voucher
  function handleDeleteVoucher(code: string) {
    setVouchers((prev) => prev.filter((v) => v.code !== code));
  }

  // Simpan Aturan Promo ke Server
  async function handleSavePromos() {
    setSavingPromos(true);
    setPromoMessage(null);
    setPromoError(null);
    try {
      const res = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_promos",
          promo_rules: promoRules,
          voucher_rules: vouchers,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setPromoMessage("Aturan promo bundling dan voucher berhasil disimpan.");
        onRefresh();
      } else {
        setPromoError(data.error || "Gagal menyimpan promo.");
      }
    } catch {
      setPromoError("Koneksi gagal saat menyimpan promo.");
    } finally {
      setSavingPromos(false);
    }
  }

  // Simpan Jadwal Pengiriman ke Server
  async function handleSaveShipping() {
    setSavingShipping(true);
    setShippingMessage(null);
    setShippingError(null);
    try {
      const res = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_shipping_schedule",
          shipping_cut_off_hour: Number(shippingCutOff),
          shipping_open_hour: Number(shippingOpen),
          shipping_close_hour: Number(shippingClose),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setShippingMessage("Jadwal operasional dan cut-off berhasil disimpan.");
        onRefresh();
      } else {
        setShippingError(data.error || "Gagal menyimpan jadwal pengiriman.");
      }
    } catch {
      setShippingError("Koneksi gagal saat menyimpan jadwal pengiriman.");
    } finally {
      setSavingShipping(false);
    }
  }

  // Hitung Hasil Simulasi Bundling
  const applicableTier = promoRules
    .filter((r) => simQty >= r.min_qty)
    .sort((a, b) => b.min_qty - a.min_qty)[0] ?? null;

  const rawSubtotal = simPrice * simQty;
  const bundleDiscount = applicableTier
    ? Math.round(rawSubtotal * (applicableTier.discount_percent / 100))
    : 0;
  const finalSubtotal = rawSubtotal - bundleDiscount;

  // Uji Kode Kupon
  function handleTestCoupon() {
    const q = testCoupon.trim().toUpperCase();
    if (!q) {
      setTestCouponResult("Ketik kode kupon terlebih dahulu.");
      return;
    }
    const match = vouchers.find((v) => v.code.toUpperCase() === q);
    if (!match) {
      setTestCouponResult(`Kupon "${q}" tidak valid atau tidak ditemukan.`);
      return;
    }
    if (match.discount_percent) {
      const pot = Math.round(finalSubtotal * (match.discount_percent / 100));
      setTestCouponResult(`Kupon Valid: Diskon ${match.discount_percent}% (potongan Rp ${rupiah(pot)}).`);
    } else if (match.discount_amount) {
      setTestCouponResult(`Kupon Valid: Potongan langsung Rp ${rupiah(match.discount_amount)}.`);
    } else {
      setTestCouponResult("Kupon valid tanpa potongan.");
    }
  }

  return (
    <div className="page space-y-6">
      {/* Header */}
      <PageHeader
        eyebrow="Operasional Toko"
        title="Promosi & Pengiriman"
        description="Kelola diskon kuantitas otomatis, kode voucher kupon, serta jam cut-off pengiriman toko Anda. Semua aturan diterapkan secara instan ke AI Customer Service."
        icon={<Tag className="h-4 w-4" aria-hidden="true" />}
        actions={
          <Button variant="secondary" size="sm" onClick={onRefresh}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Segarkan
          </Button>
        }
      />

      {/* Bagian 1: Status Operasional Toko Hari Ini */}
      <Card className="border-ink-200">
        <CardHeader
          icon={<Clock className="h-4 w-4" aria-hidden="true" />}
          title="Status Operasional Toko Hari Ini"
          description={`Waktu server saat ini: ${String(currentWibHour).padStart(2, "0")}:00 WIB`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={isStoreOpen ? "signal" : "warn"}>
                {isStoreOpen ? "Toko Sedang Buka" : "Toko Sedang Tutup"}
              </Badge>
              <Badge tone={isBeforeCutOff ? "signal" : "danger"}>
                {isBeforeCutOff ? "Bisa Kirim Hari Ini" : "Batas Kirim Terlewati (Kirim Besok)"}
              </Badge>
            </div>
          }
        />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="open-hour-input" className="block text-xs font-semibold text-ink-600 mb-1">
                Jam Buka Toko
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="open-hour-input"
                  type="number"
                  min={0}
                  max={23}
                  value={shippingOpen}
                  onChange={(e) => setShippingOpen(Math.max(0, Math.min(23, Number(e.target.value))))}
                  className="field field-sm font-mono w-24"
                />
                <span className="text-xs text-ink-500 font-medium">:00 WIB</span>
              </div>
              <p className="mt-1 text-2xs text-ink-400">Jam awal AI menyapa sebagai jam operasional aktif.</p>
            </div>

            <div>
              <label htmlFor="close-hour-input" className="block text-xs font-semibold text-ink-600 mb-1">
                Jam Tutup Toko
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="close-hour-input"
                  type="number"
                  min={0}
                  max={23}
                  value={shippingClose}
                  onChange={(e) => setShippingClose(Math.max(0, Math.min(23, Number(e.target.value))))}
                  className="field field-sm font-mono w-24"
                />
                <span className="text-xs text-ink-500 font-medium">:00 WIB</span>
              </div>
              <p className="mt-1 text-2xs text-ink-400">Di luar jam ini AI tetap melayani namun memberitahu antrean esok hari.</p>
            </div>

            <div>
              <label htmlFor="cutoff-hour-input" className="block text-xs font-semibold text-ink-600 mb-1">
                Batas Cut-Off Kirim Hari Ini
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="cutoff-hour-input"
                  type="number"
                  min={0}
                  max={23}
                  value={shippingCutOff}
                  onChange={(e) => setShippingCutOff(Math.max(0, Math.min(23, Number(e.target.value))))}
                  className="field field-sm font-mono w-24"
                />
                <span className="text-xs text-ink-500 font-medium">:00 WIB</span>
              </div>
              <p className="mt-1 text-2xs text-ink-400">Pesanan setelah jam ini dikirim pada hari kerja berikutnya.</p>
            </div>
          </div>

          {shippingMessage && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{shippingMessage}</span>
            </div>
          )}

          {shippingError && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{shippingError}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              size="sm"
              loading={savingShipping}
              onClick={handleSaveShipping}
            >
              <Save className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Simpan Jam Operasional
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Bagian 1.B: Kalkulator Tarif Ekspedisi & Ongkir Cepat */}
      <Card className="border-ink-200">
        <CardHeader
          icon={<Truck className="h-4 w-4 text-signal-strong" aria-hidden="true" />}
          title="Kalkulator Tarif Kurir & Ongkir Cepat"
          description="Uji coba perhitungan ongkir riil ekspedisi (J&T, SiCepat, JNE) ke seluruh Indonesia langsung dari data platform."
        />
        <CardBody className="space-y-4">
          <form onSubmit={handleCheckRates} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-6">
              <label htmlFor="calc-dest-input" className="block text-2xs font-semibold text-ink-600 mb-1">
                Kecamatan / Kota Tujuan
              </label>
              <input
                id="calc-dest-input"
                type="text"
                placeholder="Misal: Coblong, Bandung atau Kebayoran Baru"
                value={calcDest}
                onChange={(e) => setCalcDest(e.target.value)}
                className="field field-sm"
                required
              />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="calc-weight-input" className="block text-2xs font-semibold text-ink-600 mb-1">
                Berat Paket (Gram)
              </label>
              <input
                id="calc-weight-input"
                type="number"
                min={100}
                step={100}
                value={calcWeight}
                onChange={(e) => setCalcWeight(Number(e.target.value))}
                className="field field-sm font-mono"
                required
              />
            </div>
            <div className="sm:col-span-3">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={calcLoading}
                className="w-full"
              >
                <Truck className="mr-1.5 h-3.5 w-3.5" />
                Cek Ongkir
              </Button>
            </div>
          </form>

          {calcError && (
            <div className="rounded-lg bg-danger-wash border border-danger/30 p-2.5 text-xs text-danger flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{calcError}</span>
            </div>
          )}

          {calcResult && (
            <div className="rounded-lg border border-ink-200 bg-ink-50/50 p-4 space-y-3 animate-fade-up">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-ink-500">Asal Pengiriman: </span>
                  <strong className="text-ink">{calcResult.origin}</strong>
                  <span className="mx-2 text-ink-300">→</span>
                  <span className="text-ink-500">Tujuan: </span>
                  <strong className="text-ink">{calcResult.destination}</strong>
                  <span className="ml-2 font-mono text-ink-400">({calcResult.weight_kg} kg)</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {calcResult.rates.map((r, i) => (
                  <div key={i} className="rounded-lg border border-ink-200 bg-white p-3 shadow-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-ink-900">{r.courier}</span>
                      <span className="text-[10px] font-medium text-ink-500">{r.estimated_days}</span>
                    </div>
                    <p className="text-[11px] text-ink-500">{r.service_type}</p>
                    <p className="font-mono text-sm font-bold text-signal-strong pt-1">
                      Rp {rupiah(r.total_tariff)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Bagian 2: Promo Bundling & Tier Diskon Kuantitas */}
      <Card className="border-ink-200">
        <CardHeader
          icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
          title="Aturan Promo Bundling (Tier Diskon Otomatis)"
          description="AI akan otomatis menghitung potongan harga sesuai jumlah item yang dibeli pelanggan."
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowAddPromo(!showAddPromo)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Tambah Tier Promo
            </Button>
          }
        />
        <CardBody className="space-y-4">
          {/* Form Tambah Tier Promo */}
          {showAddPromo && (
            <form onSubmit={handleAddPromoTier} className="rounded-lg border border-signal-subtle bg-signal-subtle/20 p-4 space-y-3">
              <h4 className="text-xs font-bold text-ink uppercase tracking-wider">Tambah Tier Diskon Baru</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="promo-name-input" className="block text-2xs font-semibold text-ink-600 mb-1">
                    Nama Promo
                  </label>
                  <input
                    id="promo-name-input"
                    type="text"
                    placeholder="Misal: Paket Hemat 2 Pcs"
                    value={newPromoName}
                    onChange={(e) => setNewPromoName(e.target.value)}
                    className="field field-sm"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="promo-min-qty" className="block text-2xs font-semibold text-ink-600 mb-1">
                    Min. Pembelian (Pcs)
                  </label>
                  <input
                    id="promo-min-qty"
                    type="number"
                    min={1}
                    value={newPromoMinQty}
                    onChange={(e) => setNewPromoMinQty(Number(e.target.value))}
                    className="field field-sm font-mono"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="promo-discount-percent" className="block text-2xs font-semibold text-ink-600 mb-1">
                    Diskon (%)
                  </label>
                  <input
                    id="promo-discount-percent"
                    type="number"
                    min={1}
                    max={100}
                    value={newPromoDiscount}
                    onChange={(e) => setNewPromoDiscount(Number(e.target.value))}
                    className="field field-sm font-mono"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="secondary" onClick={() => setShowAddPromo(false)} type="button">
                  Batal
                </Button>
                <Button size="sm" variant="accent" type="submit">
                  Simpan Tier Ini
                </Button>
              </div>
            </form>
          )}

          {/* Daftar Tier Promo */}
          {promoRules.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-ink-200 rounded-lg">
              <Tag className="mx-auto h-8 w-8 text-ink-300" />
              <p className="mt-2 text-xs font-medium text-ink-600">Belum ada aturan promo bundling aktif.</p>
              <p className="text-2xs text-ink-400">Klik &quot;Tambah Tier Promo&quot; untuk menambahkan potongan harga beli banyak.</p>
            </div>
          ) : (
            <div className="divide-y divide-ink-100 border border-ink-200 rounded-lg overflow-hidden">
              <div className="bg-ink-50 px-4 py-2.5 grid grid-cols-12 text-2xs font-bold uppercase text-ink-500 tracking-wider">
                <div className="col-span-5">Nama Promo</div>
                <div className="col-span-3 text-center">Minimal Qty</div>
                <div className="col-span-3 text-center">Diskon</div>
                <div className="col-span-1 text-right">Aksi</div>
              </div>
              {promoRules.map((tier, idx) => (
                <div key={idx} className="px-4 py-3 grid grid-cols-12 items-center text-xs hover:bg-ink-50/50">
                  <div className="col-span-5 font-semibold text-ink">{tier.promo_name}</div>
                  <div className="col-span-3 text-center font-mono font-medium text-ink-600">
                    Beli &gt;= {tier.min_qty} pcs
                  </div>
                  <div className="col-span-3 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Diskon {tier.discount_percent}%
                    </span>
                  </div>
                  <div className="col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => handleDeletePromoTier(idx)}
                      className="p-1 rounded text-ink-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Hapus tier promo ini"
                      aria-label="Hapus tier promo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Simulator Kalkulator Bundling */}
          <div className="rounded-lg border border-ink-200 bg-ink-50/40 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-ink-600" />
              <h4 className="text-xs font-bold text-ink uppercase tracking-wider">Simulasi Perhitungan AI</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="sim-price-input" className="block text-2xs font-semibold text-ink-600 mb-1">
                  Harga Satuan Produk (Rp)
                </label>
                <input
                  id="sim-price-input"
                  type="number"
                  min={1000}
                  step={1000}
                  value={simPrice}
                  onChange={(e) => setSimPrice(Number(e.target.value))}
                  className="field field-sm font-mono"
                />
              </div>
              <div>
                <label htmlFor="sim-qty-input" className="block text-2xs font-semibold text-ink-600 mb-1">
                  Jumlah Pembelian (Qty)
                </label>
                <input
                  id="sim-qty-input"
                  type="number"
                  min={1}
                  value={simQty}
                  onChange={(e) => setSimQty(Number(e.target.value))}
                  className="field field-sm font-mono"
                />
              </div>
            </div>
            <div className="rounded bg-white p-3 border border-ink-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <span className="text-ink-500">Tier Terpilih: </span>
                <strong className="text-ink">{applicableTier ? applicableTier.promo_name : "Harga Normal (Tanpa Promo)"}</strong>
              </div>
              <div className="font-mono text-right">
                <span className="text-ink-500 line-through mr-2">
                  {bundleDiscount > 0 ? `Rp ${rupiah(rawSubtotal)}` : ""}
                </span>
                <span className="font-bold text-emerald-700 text-sm">
                  Rp {rupiah(finalSubtotal)}
                </span>
                {bundleDiscount > 0 && (
                  <span className="ml-1.5 text-2xs font-semibold text-emerald-600">
                    (Hemat Rp {rupiah(bundleDiscount)})
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Bagian 3: Kupon Diskon & Voucher Toko */}
      <Card className="border-ink-200">
        <CardHeader
          icon={<Percent className="h-4 w-4" aria-hidden="true" />}
          title="Kupon Diskon & Kode Voucher"
          description="Pelanggan dapat memasukkan kode kupon saat chat via WhatsApp untuk mendapatkan potongan harga."
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowAddVoucher(!showAddVoucher)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Tambah Kupon Baru
            </Button>
          }
        />
        <CardBody className="space-y-4">
          {/* Form Tambah Kupon */}
          {showAddVoucher && (
            <form onSubmit={handleAddVoucher} className="rounded-lg border border-signal-subtle bg-signal-subtle/20 p-4 space-y-3">
              <h4 className="text-xs font-bold text-ink uppercase tracking-wider">Tambah Kode Kupon Baru</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="voucher-code-input" className="block text-2xs font-semibold text-ink-600 mb-1">
                    Kode Kupon
                  </label>
                  <input
                    id="voucher-code-input"
                    type="text"
                    placeholder="Misal: DISKON10"
                    value={newVoucherCode}
                    onChange={(e) => setNewVoucherCode(e.target.value.toUpperCase())}
                    className="field field-sm font-mono uppercase"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="voucher-type-select" className="block text-2xs font-semibold text-ink-600 mb-1">
                    Tipe Potongan
                  </label>
                  <select
                    id="voucher-type-select"
                    value={voucherType}
                    onChange={(e) => setVoucherType(e.target.value as "NOMINAL" | "PERCENT")}
                    className="field field-sm"
                  >
                    <option value="NOMINAL">Nominal Rupiah (Rp)</option>
                    <option value="PERCENT">Persentase (%)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="voucher-value-input" className="block text-2xs font-semibold text-ink-600 mb-1">
                    {voucherType === "NOMINAL" ? "Nominal Potongan (Rp)" : "Persentase Diskon (%)"}
                  </label>
                  <input
                    id="voucher-value-input"
                    type="number"
                    min={1}
                    max={voucherType === "PERCENT" ? 100 : undefined}
                    value={newVoucherValue}
                    onChange={(e) => setNewVoucherValue(Number(e.target.value))}
                    className="field field-sm font-mono"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="secondary" onClick={() => setShowAddVoucher(false)} type="button">
                  Batal
                </Button>
                <Button size="sm" variant="accent" type="submit">
                  Simpan Kupon
                </Button>
              </div>
            </form>
          )}

          {/* Daftar Kupon Voucher */}
          {vouchers.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-ink-200 rounded-lg">
              <Percent className="mx-auto h-8 w-8 text-ink-300" />
              <p className="mt-2 text-xs font-medium text-ink-600">Belum ada kupon diskon aktif.</p>
              <p className="text-2xs text-ink-400">Klik &quot;Tambah Kupon Baru&quot; untuk membuat kode voucher toko.</p>
            </div>
          ) : (
            <div className="divide-y divide-ink-100 border border-ink-200 rounded-lg overflow-hidden">
              <div className="bg-ink-50 px-4 py-2.5 grid grid-cols-12 text-2xs font-bold uppercase text-ink-500 tracking-wider">
                <div className="col-span-5">Kode Kupon</div>
                <div className="col-span-4 text-center">Jenis Potongan</div>
                <div className="col-span-3 text-right">Aksi</div>
              </div>
              {vouchers.map((v) => (
                <div key={v.code} className="px-4 py-3 grid grid-cols-12 items-center text-xs hover:bg-ink-50/50">
                  <div className="col-span-5 font-mono font-bold text-ink tracking-wider">
                    {v.code}
                  </div>
                  <div className="col-span-4 text-center">
                    {v.discount_percent ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
                        Diskon {v.discount_percent}%
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Potongan Rp {rupiah(v.discount_amount ?? 0)}
                      </span>
                    )}
                  </div>
                  <div className="col-span-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDeleteVoucher(v.code)}
                      className="p-1 rounded text-ink-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Hapus kupon ini"
                      aria-label="Hapus kupon"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Penguji Validasi Kupon */}
          <div className="rounded-lg border border-ink-200 bg-ink-50/40 p-4 space-y-3">
            <h4 className="text-xs font-bold text-ink uppercase tracking-wider">Uji Validasi Kode Kupon</h4>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Ketik kode kupon untuk diuji..."
                value={testCoupon}
                onChange={(e) => setTestCoupon(e.target.value.toUpperCase())}
                className="field field-sm font-mono uppercase flex-1 min-w-[200px]"
              />
              <Button size="sm" variant="secondary" onClick={handleTestCoupon}>
                Cek Kupon
              </Button>
            </div>
            {testCouponResult && (
              <p className={cn(
                "text-xs font-medium rounded p-2 border",
                testCouponResult.includes("Valid")
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-rose-50 text-rose-800 border-rose-200"
              )}>
                {testCouponResult}
              </p>
            )}
          </div>

          {promoMessage && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{promoMessage}</span>
            </div>
          )}

          {promoError && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{promoError}</span>
            </div>
          )}

          {/* Tombol Simpan Semua Aturan Promo & Kupon */}
          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              size="sm"
              loading={savingPromos}
              onClick={handleSavePromos}
            >
              <Save className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Simpan Aturan Promo & Voucher
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Broadcast & Re-engagement */}
      <BroadcastCard />
    </div>
  );
}
