"use client";

/**
 * Catalog and Media Tab.
 *
 * Provides:
 * - Unified catalog data sources (Database Products, CSV Import with Field Mapping, and published Google Sheets URL).
 * - Official CSV Template download (UTF-8 BOM).
 * - AI Knowledge Base documents (FAQ, SOP, policies, size charts in PDF/DOCX/TXT/MD/CSV).
 * - Store Payment media (QRIS image and bank account details).
 */

import { useEffect, useState } from "react";
import {
  Banknote,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  ImagePlus,
  Paperclip,
  Plus,
  QrCode,
  ShoppingBag,
  Sparkles,
  Table2,
  Trash2,
  Upload,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  InlineLoading,
  PageHeader,
  TextField,
  cn,
} from "@/components/ui";
import { CsvImportModal, downloadOfficialCsvTemplate } from "./csv-import-modal";

type CatalogPreview = { rows: unknown[]; total: number; warning: string | null } | null;

type PaymentInfo = {
  bank_name: string;
  bank_account_number: string;
  bank_account_holder: string;
  qris_url: string | null;
};

type KnowledgeDocItem = {
  id: string;
  title: string;
  doc_type: string;
  file_name: string | null;
  file_mime: string | null;
  file_key: string | null;
  file_url: string | null;
  is_active: boolean;
  created_at: string;
  preview: string;
  content_text: string;
};

const REQUIRED_COLUMNS = ["SKU", "Nama Produk", "Harga", "Stok"];
const OPTIONAL_COLUMNS = [
  "Varian",
  "Link Foto",
  "Link Video",
  "Deskripsi/Bahan",
  "Kategori",
  "Berat (gram)",
  "Status Aktif",
];

export function PanelKatalog({
  sheetUrl: initialSheetUrl,
  origin: initialOrigin,
  configured,
  lastSyncedAt,
  payment: initialPayment,
  onGoProducts,
}: {
  sheetUrl: string;
  origin: string;
  configured: boolean;
  lastSyncedAt: string | null;
  payment: PaymentInfo;
  onGoProducts?: () => void;
}) {
  const [sheetUrl, setSheetUrl] = useState(initialSheetUrl);
  const [origin, setOrigin] = useState(initialOrigin);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogPreview>(null);

  // Payment destination: only the owner may set these.
  const [bankName, setBankName] = useState(initialPayment.bank_name);
  const [bankNumber, setBankNumber] = useState(initialPayment.bank_account_number);
  const [bankHolder, setBankHolder] = useState(initialPayment.bank_account_holder);
  const [qrisUrl, setQrisUrl] = useState<string | null>(initialPayment.qris_url);
  const [payBusy, setPayBusy] = useState(false);
  const [payMsg, setPayMsg] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [uploadingQris, setUploadingQris] = useState(false);

  // Knowledge Base documents
  const [docs, setDocs] = useState<KnowledgeDocItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [addMode, setAddMode] = useState<"file" | "text" | "preset">("preset");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState<"FAQ" | "SOP" | "SIZE_CHART" | "POLICY" | "OTHER">("FAQ");
  const [docContent, setDocContent] = useState("");
  const [docBusy, setDocBusy] = useState(false);
  const [docMsg, setDocMsg] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  // Structured Policy Preset States
  const [policyReturn, setPolicyReturn] = useState(
    "1. Wajib menyertakan video unboxing utuh tanpa cut saat paket dibuka.\n2. Batas waktu klaim komplain maksimal 2x24 jam sejak paket diterima menurut data resi kurir.\n3. Ongkir retur ditanggung penjual jika kesalahan dari toko (salah varian/cacat)."
  );
  const [policyShipping, setPolicyShipping] = useState(
    "1. Pengiriman setiap hari Senin s/d Sabtu. Hari Minggu dan libur nasional tidak ada pengiriman.\n2. Pesanan sebelum jam 15:00 WIB dikirim di hari yang sama.\n3. Kurir yang didukung: JNE, J&T Express, SiCepat."
  );
  const [policyWarranty, setPolicyWarranty] = useState(
    "1. Semua produk dijamin 100% original dan baru.\n2. Garansi cacat produksi ganti barang baru jika dilaporkan sesuai prosedur unboxing."
  );
  const [policyPayment, setPolicyPayment] = useState(
    "1. Pembayaran resmi hanya ditransfer ke rekening bank toko atau QRIS yang tertera pada invoice.\n2. Wajib transfer sesuai nominal total hingga 3 digit kode unik agar verifikasi cepat.\n3. Unggah foto struk transfer ke WhatsApp untuk proses konfirmasi otomatis."
  );

  async function savePolicyPreset() {
    setDocBusy(true);
    setDocError(null);
    setDocMsg(null);
    try {
      const compiledMarkdown = [
        "# Kebijakan & FAQ Resmi Toko",
        "",
        "## 1. Kebijakan Komplain & Retur Barang",
        policyReturn.trim(),
        "",
        "## 2. Jadwal & Ekspedisi Pengiriman",
        policyShipping.trim(),
        "",
        "## 3. Garansi & Keaslian Produk",
        policyWarranty.trim(),
        "",
        "## 4. Ketentuan Pembayaran & Verifikasi",
        policyPayment.trim(),
      ].join("\n");

      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          title: "Kebijakan & FAQ Resmi Toko",
          doc_type: "POLICY",
          content_text: compiledMarkdown,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setDocMsg("SOP Kebijakan & FAQ Toko berhasil disimpan dan aktif menjadi pedoman AI Bot.");
        setShowAddDoc(false);
        await loadDocs();
      } else {
        setDocError(json.error ?? "Gagal menyimpan kebijakan toko.");
      }
    } catch {
      setDocError("Gagal menghubungi server.");
    } finally {
      setDocBusy(false);
    }
  }

  // Products count & CSV import modal
  const [productCount, setProductCount] = useState<number | null>(null);
  const [inventoryAlert, setInventoryAlert] = useState<{ outOfStock: number; lowStock: number } | null>(null);
  const [showCsvModal, setShowCsvModal] = useState(false);

  useEffect(() => {
    loadDocs();
    loadProductCount();
  }, []);

  async function loadProductCount() {
    try {
      const res = await fetch("/api/products?status=ALL");
      const json = await res.json();
      if (json.ok) {
        setProductCount(json.total ?? (json.products ? json.products.length : 0));
        if (json.inventorySummary) {
          setInventoryAlert(json.inventorySummary);
        }
      }
    } catch {
      // silent
    }
  }

  async function loadDocs() {
    setDocsLoading(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      });
      const json = await res.json();
      if (json.ok && Array.isArray(json.docs)) {
        setDocs(json.docs);
      }
    } catch {
      // silent
    } finally {
      setDocsLoading(false);
    }
  }

  async function saveDoc() {
    setDocBusy(true);
    setDocError(null);
    setDocMsg(null);
    try {
      if (addMode === "file") {
        if (!uploadFile) {
          setDocError("Silakan pilih berkas dokumen (PDF, DOCX, TXT, MD, CSV) terlebih dahulu.");
          setDocBusy(false);
          return;
        }

        const fd = new FormData();
        fd.append("file", uploadFile);
        if (docTitle.trim()) fd.append("title", docTitle.trim());
        fd.append("doc_type", docType);
        if (docContent.trim()) fd.append("content_text", docContent.trim());

        const res = await fetch("/api/knowledge", {
          method: "POST",
          body: fd,
        });
        const json = await res.json();
        if (json.ok) {
          setDocMsg(`Berkas "${uploadFile.name}" berhasil diunggah dan teks diekstrak ke basis pengetahuan.`);
          setUploadFile(null);
          setDocTitle("");
          setDocContent("");
          setShowAddDoc(false);
          await loadDocs();
        } else {
          setDocError(json.error ?? "Gagal mengunggah berkas.");
        }
      } else {
        if (!docTitle.trim() || !docContent.trim()) {
          setDocError("Judul dan isi dokumen tidak boleh kosong.");
          setDocBusy(false);
          return;
        }

        const res = await fetch("/api/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save",
            title: docTitle.trim(),
            doc_type: docType,
            content_text: docContent.trim(),
          }),
        });
        const json = await res.json();
        if (json.ok) {
          setDocMsg("Dokumen berhasil disimpan ke basis pengetahuan.");
          setDocTitle("");
          setDocContent("");
          setShowAddDoc(false);
          await loadDocs();
        } else {
          setDocError(json.error ?? "Gagal menyimpan dokumen.");
        }
      }
    } catch {
      setDocError("Gagal menghubungi server.");
    } finally {
      setDocBusy(false);
    }
  }

  async function toggleDoc(id: string, active: boolean) {
    await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", id, active }),
    });
    await loadDocs();
  }

  async function deleteDoc(id: string) {
    await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    await loadDocs();
  }

  async function savePayment() {
    setPayBusy(true);
    setPayMsg(null);
    setPayError(null);
    try {
      const res = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_payment",
          bank_name: bankName.trim(),
          bank_account_number: bankNumber.trim(),
          bank_account_holder: bankHolder.trim(),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setPayMsg("Rekening pembayaran tersimpan. Bot hanya akan memakai data ini.");
        if (json.qris_key) setQrisUrl(json.qris_key.url);
      } else {
        setPayError(json.error ?? "Gagal menyimpan data pembayaran.");
      }
    } catch {
      setPayError("Gagal menyimpan data pembayaran.");
    } finally {
      setPayBusy(false);
    }
  }

  async function handleQrisUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingQris(true);
    setPayMsg(null);
    setPayError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "photo");
      fd.append("purpose", "qris");
      const res = await fetch("/api/dashboard", {
        method: "PUT",
        body: fd,
      });
      const json = await res.json();
      if (json.ok && json.key) {
        const save = await fetch("/api/dashboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save_payment", qris_object_key: json.key }),
        }).then((r) => r.json());
        if (save.ok) {
          setQrisUrl(json.url);
          setPayMsg("Gambar QRIS diunggah. Bot akan melampirkannya ke pembeli.");
        } else {
          setPayError(save.error ?? "Gagal menyimpan QRIS.");
        }
      } else {
        setPayError(json.error ?? "Gagal mengunggah QRIS.");
      }
    } catch {
      setPayError("Gagal mengunggah QRIS.");
    } finally {
      setUploadingQris(false);
      e.target.value = "";
    }
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_sheet",
          sheets_url: sheetUrl,
          origin_subdistrict: origin || undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setMsg(`Tersimpan. ${json.total_rows} baris produk terbaca dari spreadsheet.`);
        const cat = await fetch("/api/dashboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "catalog" }),
        }).then((r) => r.json());
        setCatalog(cat);
      } else {
        setError(json.error ?? "Gagal menyimpan pengaturan spreadsheet.");
      }
    } catch {
      setError("Gagal menyimpan pengaturan spreadsheet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page space-y-6">
      <PageHeader
        eyebrow="Pusat Data Toko"
        title="Katalog & Media"
        description="Kelola sumber katalog produk, tautan spreadsheet, basis pengetahuan dokumen AI (FAQ & SOP), serta rekening & QRIS pembayaran."
        icon={<Database className="h-4 w-4" aria-hidden="true" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={downloadOfficialCsvTemplate}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Unduh Template CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowCsvModal(true)}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Impor CSV & Mapping
            </Button>
            {onGoProducts && (
              <Button variant="primary" size="sm" onClick={onGoProducts}>
                <ShoppingBag className="mr-1.5 h-3.5 w-3.5" />
                Kelola Produk Database
              </Button>
            )}
          </div>
        }
      />

      {/* Overview Hub Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-ink-200 bg-white p-3.5 shadow-flat space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold text-ink-500 uppercase tracking-wide">
              Katalog Produk
            </span>
            <ShoppingBag className="h-4 w-4 text-ink-400" />
          </div>
          <p className="font-mono text-xl font-bold tabular-nums text-ink-900">
            {productCount != null ? productCount : "..."}
          </p>
          <p className="text-2xs text-ink-500">Produk tersimpan di database</p>
        </div>

        <div className="rounded-xl border border-ink-200 bg-white p-3.5 shadow-flat space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold text-ink-500 uppercase tracking-wide">
              Google Sheets
            </span>
            <FileSpreadsheet className="h-4 w-4 text-ink-400" />
          </div>
          <p className="text-sm font-bold text-ink-900 flex items-center gap-1.5">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                configured ? "bg-signal" : "bg-warn"
              )}
            />
            {configured ? "Terhubung" : "Belum Diatur"}
          </p>
          <p className="text-2xs text-ink-500 truncate">
            {lastSyncedAt
              ? `Sinkron: ${new Date(lastSyncedAt).toLocaleDateString("id-ID")}`
              : "Menunggu koneksi"}
          </p>
        </div>

        <div className="rounded-xl border border-ink-200 bg-white p-3.5 shadow-flat space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold text-ink-500 uppercase tracking-wide">
              Basis Pengetahuan
            </span>
            <BookOpen className="h-4 w-4 text-ink-400" />
          </div>
          <p className="font-mono text-xl font-bold tabular-nums text-ink-900">
            {docs.length}
          </p>
          <p className="text-2xs text-ink-500">Dokumen FAQ, SOP & Kebijakan</p>
        </div>

        <div className="rounded-xl border border-ink-200 bg-white p-3.5 shadow-flat space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold text-ink-500 uppercase tracking-wide">
              Media QRIS
            </span>
            <QrCode className="h-4 w-4 text-ink-400" />
          </div>
          <p className="text-sm font-bold text-ink-900 flex items-center gap-1.5">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                qrisUrl ? "bg-signal" : "bg-ink-300"
              )}
            />
            {qrisUrl ? "Gambar Aktif" : "Belum Diunggah"}
          </p>
          <p className="text-2xs text-ink-500">Otomatis dilampirkan ke pembeli</p>
      </div>
      </div>

      {/* Low Stock Inventory Warning Banner */}
      {inventoryAlert && (inventoryAlert.outOfStock > 0 || inventoryAlert.lowStock > 0) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-warn-strong/30 bg-warn-wash p-3.5 text-xs text-ink-900">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-warn/20 text-warn-strong font-bold">
              !
            </span>
            <div>
              <p className="font-semibold text-ink-900">
                Peringatan Stok Inventaris Toko
              </p>
              <p className="text-ink-600">
                {inventoryAlert.outOfStock > 0 && (
                  <span className="font-semibold text-danger mr-2">
                    {inventoryAlert.outOfStock} produk habis (0 stok)
                  </span>
                )}
                {inventoryAlert.lowStock > 0 && (
                  <span className="font-semibold text-warn-strong">
                    {inventoryAlert.lowStock} produk stok kritis (≤ 3 stok)
                  </span>
                )}
                — Segera perbarui stok agar AI Bot tidak menolak transaksi pembeli.
              </p>
            </div>
          </div>
          {onGoProducts && (
            <Button size="sm" variant="secondary" onClick={onGoProducts} className="shrink-0">
              Lihat & Tambah Stok
            </Button>
          )}
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left Column: Spreadsheet, CSV Import, Knowledge Base */}
        <div className="space-y-6 min-w-0">
          {/* Card: Spreadsheet Sync & CSV Import */}
          <Card>
            <CardHeader
              icon={<FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}
              title="Katalog Produk & Sinkronisasi Spreadsheet"
              description="Bot membaca stok, harga, dan tautan foto secara langsung. Anda dapat menggunakan Google Sheets atau mengimpor berkas CSV."
              actions={
                <Badge tone={configured ? "signal" : "warn"}>
                  {configured ? "Sheets Terhubung" : "Belum Terhubung"}
                </Badge>
              }
            />
            <CardBody className="space-y-4">
              {/* Smart CSV Import Feature Callout */}
              <div className="rounded-xl border border-signal/30 bg-signal-wash p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white border border-signal/25 text-signal shadow-flat">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-signal-strong">
                      Impor Cepat via CSV dengan Pemetaan Kolom Otomatis
                    </h4>
                    <p className="text-2xs text-ink-600 mt-0.5 leading-relaxed">
                      Punya ekspor data dari Shopee, Tokopedia, WooCommerce, atau Excel dengan nama kolom yang berbeda?
                      Gunakan wizard impor kami untuk memetakan kolom secara otomatis tanpa perlu mengubah berkas di Excel.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-signal/20">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowCsvModal(true)}
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    Buka Wizard Impor & Pemetaan
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={downloadOfficialCsvTemplate}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Unduh Template CSV Resmi
                  </Button>
                </div>
              </div>

              {/* Google Sheets Configuration */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-ink-700">
                    Opsi 2: Hubungkan Google Sheets Online
                  </h4>
                  <a
                    href="https://support.google.com/docs/answer/183965"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-2xs font-semibold text-signal-strong hover:underline"
                  >
                    Panduan Publish Spreadsheet
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <TextField
                  id="sheets_url"
                  label="Tautan Publikasi Google Sheets"
                  placeholder="https://docs.google.com/spreadsheets/d/e/.../pubhtml"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  inputMode="url"
                  autoComplete="off"
                  hint="Pastikan memilih menu File > Bagikan > Publikasikan ke web (format Web / CSV)."
                />

                <TextField
                  id="origin_subdistrict"
                  label="Kecamatan asal pengiriman toko"
                  placeholder="Kebayoran Baru, Jakarta Selatan"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  optional
                  hint="Titik asal perhitungan ongkir kurir otomatis (JNE, J&T, SiCepat)."
                />

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button
                    variant="primary"
                    onClick={save}
                    loading={busy}
                    disabled={!sheetUrl.trim()}
                  >
                    {busy ? "Memeriksa..." : "Verifikasi dan Simpan Spreadsheet"}
                  </Button>
                  {lastSyncedAt && (
                    <span className="text-2xs text-ink-500 font-mono">
                      Sinkron terakhir: {new Date(lastSyncedAt).toLocaleString("id-ID")}
                    </span>
                  )}
                </div>

                {busy && <InlineLoading label="Membaca dan memvalidasi struktur spreadsheet..." />}
                {error && <ErrorState title="Gagal menyimpan" description={error} compact />}
                {msg && !error && (
                  <div className="rounded-xl border border-signal/25 bg-signal-wash px-3.5 py-2.5 text-xs text-signal-strong font-medium">
                    {msg}
                  </div>
                )}

                {catalog && (
                  <div className="rounded-xl border border-ink-200 bg-ink-50 p-3.5">
                    <div className="flex items-center gap-2">
                      <Table2 className="h-4 w-4 text-ink-600" aria-hidden="true" />
                      <p className="text-xs font-bold text-ink-900">
                        {catalog.rows.length} baris produk berhasil terbaca
                      </p>
                    </div>
                    {catalog.warning ? (
                      <p className="mt-1 text-2xs leading-relaxed text-warn font-medium">
                        {catalog.warning}
                      </p>
                    ) : (
                      <p className="mt-1 text-2xs leading-relaxed text-ink-600">
                        Struktur kolom valid. Bot AI langsung menggunakan data ini pada percakapan WhatsApp berikutnya.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Supported Columns Guide */}
              <div className="rounded-xl border border-ink-200 bg-surface-sunken p-3.5 space-y-2.5">
                <p className="text-xs font-bold text-ink-800">
                  Struktur Kolom yang Didukung Sistem
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-2xs font-bold uppercase tracking-wide text-ink-500 w-16">
                      Wajib:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {REQUIRED_COLUMNS.map((c) => (
                        <span
                          key={c}
                          className="rounded-md border border-ink-200 bg-white px-2 py-0.5 font-mono text-2xs font-semibold text-ink-800"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xs font-bold uppercase tracking-wide text-ink-500 w-16">
                      Opsional:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {OPTIONAL_COLUMNS.map((c) => (
                        <span
                          key={c}
                          className="rounded-md border border-dashed border-ink-300 bg-white px-2 py-0.5 font-mono text-2xs font-medium text-ink-600"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Card: Knowledge Base Dokumen AI */}
          <Card>
            <CardHeader
              icon={<BookOpen className="h-4 w-4" aria-hidden="true" />}
              title="Basis Pengetahuan Toko (Dokumen & Kebijakan AI)"
              description="Unggah atau ketik FAQ, Size Chart, panduan garansi/retur, dan SOP toko. Bot menggunakan rujukan ini agar tidak berhalusinasi saat menjawab pembeli."
              actions={
                <div className="flex items-center gap-2">
                  <Badge tone={docs.length > 0 ? "signal" : "neutral"}>
                    {docs.length} Dokumen
                  </Badge>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowAddDoc((v) => !v)}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    {showAddDoc ? "Batal" : "Tambah Dokumen"}
                  </Button>
                </div>
              }
            />
            <CardBody className="space-y-4">
              {showAddDoc && (
                <div className="space-y-4 rounded-xl border border-ink-300 bg-ink-50/60 p-4 shadow-flat">
                  <div className="flex flex-wrap items-center gap-2 border-b border-ink-200 pb-3">
                    <button
                      type="button"
                      onClick={() => setAddMode("preset")}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5",
                        addMode === "preset"
                          ? "bg-ink-900 text-white"
                          : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                      )}
                    >
                      <Sparkles className="h-3 w-3" />
                      Template Kebijakan &amp; FAQ Toko
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddMode("file")}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                        addMode === "file"
                          ? "bg-ink-900 text-white"
                          : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                      )}
                    >
                      Unggah Berkas (PDF, DOCX, TXT, MD, CSV)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddMode("text")}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                        addMode === "text"
                          ? "bg-ink-900 text-white"
                          : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                      )}
                    >
                      Tulis / Tempel Teks Manual
                    </button>
                  </div>

                  {addMode === "preset" ? (
                    <div className="space-y-4">
                      <div className="rounded-lg bg-sky-50 border border-sky-200/80 p-3 text-xs text-sky-800 space-y-1">
                        <p className="font-bold flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-sky-600" />
                          Template SOP &amp; Kebijakan Toko Siap Pakai
                        </p>
                        <p className="text-[11px] text-sky-700">
                          AI CS akan otomatis mengacu pada aturan di bawah ini saat pembeli menanyakan syarat retur, jam kirim, garansi produk, atau tata cara transfer.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {/* Policy 1: Retur & Komplain */}
                        <div className="rounded-xl border border-ink-200 bg-white p-3 space-y-1.5 shadow-flat">
                          <label className="text-xs font-bold text-ink-800 flex items-center justify-between">
                            <span>1. Kebijakan Komplain &amp; Retur Barang</span>
                            <span className="text-[10px] text-ink-400 font-normal">Wajib Unboxing</span>
                          </label>
                          <textarea
                            rows={4}
                            value={policyReturn}
                            onChange={(e) => setPolicyReturn(e.target.value)}
                            className="w-full rounded-lg border border-ink-300 p-2 text-xs text-ink placeholder:text-ink-400 focus:border-ink-500 focus:outline-none"
                            placeholder="Aturan komplain, syarat unboxing, batas waktu klaim..."
                          />
                        </div>

                        {/* Policy 2: Jadwal Kirim */}
                        <div className="rounded-xl border border-ink-200 bg-white p-3 space-y-1.5 shadow-flat">
                          <label className="text-xs font-bold text-ink-800 flex items-center justify-between">
                            <span>2. Jadwal &amp; Ekspedisi Pengiriman</span>
                            <span className="text-[10px] text-ink-400 font-normal">Cut-off &amp; Kurir</span>
                          </label>
                          <textarea
                            rows={4}
                            value={policyShipping}
                            onChange={(e) => setPolicyShipping(e.target.value)}
                            className="w-full rounded-lg border border-ink-300 p-2 text-xs text-ink placeholder:text-ink-400 focus:border-ink-500 focus:outline-none"
                            placeholder="Hari operasional, jam cut-off, daftar kurir..."
                          />
                        </div>

                        {/* Policy 3: Garansi & Keaslian */}
                        <div className="rounded-xl border border-ink-200 bg-white p-3 space-y-1.5 shadow-flat">
                          <label className="text-xs font-bold text-ink-800 flex items-center justify-between">
                            <span>3. Garansi &amp; Keaslian Produk</span>
                            <span className="text-[10px] text-ink-400 font-normal">100% Original</span>
                          </label>
                          <textarea
                            rows={4}
                            value={policyWarranty}
                            onChange={(e) => setPolicyWarranty(e.target.value)}
                            className="w-full rounded-lg border border-ink-300 p-2 text-xs text-ink placeholder:text-ink-400 focus:border-ink-500 focus:outline-none"
                            placeholder="Jaminan mutu, garansi tukar, keaslian barang..."
                          />
                        </div>

                        {/* Policy 4: Aturan Pembayaran */}
                        <div className="rounded-xl border border-ink-200 bg-white p-3 space-y-1.5 shadow-flat">
                          <label className="text-xs font-bold text-ink-800 flex items-center justify-between">
                            <span>4. Ketentuan Pembayaran &amp; Rekening</span>
                            <span className="text-[10px] text-ink-400 font-normal">Kode Unik &amp; Struk</span>
                          </label>
                          <textarea
                            rows={4}
                            value={policyPayment}
                            onChange={(e) => setPolicyPayment(e.target.value)}
                            className="w-full rounded-lg border border-ink-300 p-2 text-xs text-ink placeholder:text-ink-400 focus:border-ink-500 focus:outline-none"
                            placeholder="Aturan transfer kode unik, upload struk, batas waktu..."
                          />
                        </div>
                      </div>
                    </div>
                  ) : addMode === "file" ? (
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-ink-700">
                          Pilih Berkas Dokumen
                        </label>
                        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink-300 bg-white p-5 text-center hover:border-signal transition-colors">
                          <Upload className="mb-2 h-6 w-6 text-ink-400" aria-hidden="true" />
                          {uploadFile ? (
                            <div className="space-y-1">
                              <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-ink-900">
                                <Paperclip className="h-4 w-4 text-ink-500" />
                                {uploadFile.name}
                              </p>
                              <p className="font-mono text-xs text-ink-500">
                                {(uploadFile.size / 1024).toFixed(1)} KB
                              </p>
                              <button
                                type="button"
                                onClick={() => setUploadFile(null)}
                                className="mt-2 text-xs font-medium text-danger hover:underline"
                              >
                                Ganti berkas
                              </button>
                            </div>
                          ) : (
                            <label className="cursor-pointer">
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 bg-ink-50 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-100">
                                Pilih Berkas
                              </span>
                              <input
                                type="file"
                                accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json"
                                className="sr-only"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) {
                                    setUploadFile(f);
                                    if (!docTitle.trim()) {
                                      setDocTitle(f.name.replace(/\.[^/.]+$/, ""));
                                    }
                                  }
                                }}
                              />
                              <p className="mt-2 text-2xs text-ink-500">
                                Mendukung PDF, Word (.docx), Plain Text (.txt), Markdown (.md), atau CSV (Maks. 10MB)
                              </p>
                            </label>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          <TextField
                            id="doc_title_file"
                            label="Judul dokumen (opsional)"
                            placeholder="Mis. SOP Retur & Garansi 2026"
                            value={docTitle}
                            onChange={(e) => setDocTitle(e.target.value)}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="doc_type_file"
                            className="block text-xs font-semibold uppercase tracking-wide text-ink-600 mb-1"
                          >
                            Kategori Dokumen
                          </label>
                          <select
                            id="doc_type_file"
                            value={docType}
                            onChange={(e) =>
                              setDocType(
                                e.target.value as "FAQ" | "SOP" | "SIZE_CHART" | "POLICY" | "OTHER"
                              )
                            }
                            className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-xs font-medium text-ink-900 focus:border-signal focus:outline-none"
                          >
                            <option value="FAQ">FAQ (Tanya Jawab)</option>
                            <option value="POLICY">Kebijakan / Garansi</option>
                            <option value="SIZE_CHART">Panduan Ukuran (Size Chart)</option>
                            <option value="SOP">SOP / Ketentuan Toko</option>
                            <option value="OTHER">Lainnya</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          <TextField
                            id="doc_title"
                            label="Judul dokumen"
                            placeholder="Mis. Jam Operasional & Jadwal Pengiriman"
                            value={docTitle}
                            onChange={(e) => setDocTitle(e.target.value)}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="doc_type"
                            className="block text-xs font-semibold uppercase tracking-wide text-ink-600 mb-1"
                          >
                            Kategori Dokumen
                          </label>
                          <select
                            id="doc_type"
                            value={docType}
                            onChange={(e) =>
                              setDocType(
                                e.target.value as "FAQ" | "SOP" | "SIZE_CHART" | "POLICY" | "OTHER"
                              )
                            }
                            className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-xs font-medium text-ink-900 focus:border-signal focus:outline-none"
                          >
                            <option value="FAQ">FAQ (Tanya Jawab)</option>
                            <option value="POLICY">Kebijakan / Garansi</option>
                            <option value="SIZE_CHART">Panduan Ukuran (Size Chart)</option>
                            <option value="SOP">SOP / Ketentuan Toko</option>
                            <option value="OTHER">Lainnya</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label
                          htmlFor="doc_content"
                          className="block text-xs font-semibold text-ink-700 mb-1"
                        >
                          Isi Dokumen / Teks Panduan
                        </label>
                        <textarea
                          id="doc_content"
                          rows={6}
                          placeholder="Ketik atau tempel pertanyaan yang sering diajukan pembeli, kebijakan komplain, atau jam operasional..."
                          value={docContent}
                          onChange={(e) => setDocContent(e.target.value)}
                          className="w-full rounded-xl border border-ink-300 bg-white p-3 font-mono text-xs text-ink-900 placeholder:text-ink-400 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-ink-200">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={addMode === "preset" ? savePolicyPreset : saveDoc}
                      loading={docBusy}
                    >
                      {addMode === "preset" ? (
                        <>
                          <Sparkles className="h-3.5 w-3.5 mr-1" />
                          Simpan SOP Kebijakan ke AI Bot
                        </>
                      ) : (
                        "Simpan Dokumen ke AI"
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowAddDoc(false);
                        setDocTitle("");
                        setDocContent("");
                        setUploadFile(null);
                        setDocError(null);
                      }}
                    >
                      Batal
                    </Button>
                  </div>

                  {docError && <ErrorState title="Gagal menyimpan" description={docError} compact />}
                </div>
              )}

              {docMsg && !docError && (
                <div className="rounded-xl border border-signal/25 bg-signal-wash px-3.5 py-2.5 text-xs text-signal-strong font-medium">
                  {docMsg}
                </div>
              )}

              {docsLoading ? (
                <InlineLoading label="Memuat basis pengetahuan toko..." />
              ) : docs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-ink-300 p-8 text-center text-xs text-ink-500 space-y-1">
                  <BookOpen className="mx-auto h-8 w-8 text-ink-300 mb-2" />
                  <p className="font-semibold text-ink-800">Belum ada dokumen basis pengetahuan</p>
                  <p>
                    Tambahkan FAQ, SOP, atau kebijakan toko agar bot dapat menjawab pertanyaan pembeli di luar katalog.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-ink-200 rounded-xl border border-ink-200 bg-white overflow-hidden shadow-flat">
                  {docs.map((d) => (
                    <div key={d.id} className="p-3.5 space-y-2 hover:bg-ink-50/40 transition-colors">
                      <div className="flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 shrink-0 text-ink-500" aria-hidden="true" />
                          <span className="text-xs font-bold text-ink-900">{d.title}</span>
                          <Badge tone="neutral">{d.doc_type}</Badge>
                          <Badge tone={d.is_active ? "signal" : "warn"}>
                            {d.is_active ? "Aktif" : "Nonaktif"}
                          </Badge>
                          {d.file_name && (
                            <span className="inline-flex items-center gap-1 rounded bg-ink-100 px-2 py-0.5 font-mono text-2xs text-ink-600">
                              <Paperclip className="h-3 w-3 text-ink-400" />
                              {d.file_name}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {d.file_url && (
                            <a
                              href={d.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-ink-200 px-2.5 py-1 text-2xs font-semibold text-ink-700 hover:bg-ink-50"
                            >
                              Unduh Berkas
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleDoc(d.id, !d.is_active)}
                          >
                            {d.is_active ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                          <button
                            type="button"
                            onClick={() => deleteDoc(d.id)}
                            className="rounded-lg p-1.5 text-danger hover:bg-danger-wash transition-colors"
                            aria-label={`Hapus dokumen ${d.title}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-ink-600">
                        {expandedDoc === d.id ? (
                          <div className="mt-2 space-y-2">
                            <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-xl border border-ink-200 bg-ink-50 p-3 font-mono text-xs text-ink-900">
                              {d.content_text}
                            </pre>
                            <button
                              type="button"
                              onClick={() => setExpandedDoc(null)}
                              className="inline-flex items-center gap-1 text-2xs font-semibold text-ink-600 hover:text-ink-900 hover:underline"
                            >
                              <ChevronUp className="h-3.5 w-3.5" /> Sembunyikan rujukan AI
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <p className="line-clamp-2 font-mono text-2xs text-ink-500">
                              {d.preview}...
                            </p>
                            <button
                              type="button"
                              onClick={() => setExpandedDoc(d.id)}
                              className="inline-flex shrink-0 items-center gap-1 text-2xs font-semibold text-signal-strong hover:underline"
                            >
                              <ChevronDown className="h-3.5 w-3.5" /> Lihat Teks AI
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right Column: Payment Destinations & QRIS Media */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              icon={<Banknote className="h-4 w-4" aria-hidden="true" />}
              title="Media QRIS & Rekening Toko"
              description="Rekening dan gambar QRIS yang otomatis disampaikan bot ke pembeli saat proses checkout."
              actions={
                bankNumber.trim() || qrisUrl ? (
                  <Badge tone="signal">Aktif</Badge>
                ) : (
                  <Badge tone="warn">Belum Lengkap</Badge>
                )
              }
            />
            <CardBody className="space-y-4">
              {/* QRIS Upload & Preview Frame */}
              <div className="rounded-xl border border-ink-200 bg-ink-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-ink-700" aria-hidden="true" />
                    <p className="text-xs font-bold text-ink-900">Gambar QRIS Toko</p>
                  </div>
                  {qrisUrl && <Badge tone="signal">Tersimpan</Badge>}
                </div>

                <p className="text-2xs text-ink-500 leading-relaxed">
                  Bot mengirimkan gambar ini secara langsung saat pembeli memilih bayar dengan QRIS.
                </p>

                {qrisUrl ? (
                  <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-ink-200 shadow-flat">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrisUrl}
                      alt="QRIS Toko"
                      className="h-24 w-24 rounded-lg border border-ink-200 bg-white object-contain p-1"
                    />
                    <div className="flex flex-col gap-2 min-w-0">
                      <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-800 hover:bg-ink-50 shadow-sm transition-colors">
                        <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                        Ganti Gambar
                        <input
                          type="file"
                          accept="image/png,image/jpeg"
                          className="sr-only"
                          onChange={handleQrisUpload}
                          disabled={uploadingQris}
                        />
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await fetch("/api/dashboard", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "save_payment", qris_object_key: "" }),
                          });
                          setQrisUrl(null);
                          setPayMsg("Gambar QRIS dihapus.");
                        }}
                        disabled={uploadingQris}
                        className="text-danger hover:text-danger-strong"
                      >
                        Hapus QRIS
                      </Button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink-300 bg-white p-6 text-center hover:border-signal cursor-pointer transition-colors">
                    <Upload className="mb-2 h-6 w-6 text-ink-400" aria-hidden="true" />
                    <span className="text-xs font-bold text-ink-900">
                      {uploadingQris ? "Mengunggah..." : "Unggah Gambar QRIS Toko"}
                    </span>
                    <span className="text-2xs text-ink-500 mt-0.5">Format PNG atau JPG</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      className="sr-only"
                      onChange={handleQrisUpload}
                      disabled={uploadingQris}
                    />
                  </label>
                )}
              </div>

              {/* Bank Transfer Details */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-700">
                  Rekening Transfer Bank
                </p>
                <TextField
                  id="bank_name"
                  label="Nama Bank"
                  placeholder="Mis. BCA, Mandiri, BRI, BNI"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  autoComplete="off"
                />
                <TextField
                  id="bank_account_number"
                  label="Nomor Rekening"
                  placeholder="1234567890"
                  value={bankNumber}
                  onChange={(e) => setBankNumber(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                />
                <TextField
                  id="bank_account_holder"
                  label="Atas Nama Pemilik Rekening"
                  placeholder="Nama pemilik rekening"
                  value={bankHolder}
                  onChange={(e) => setBankHolder(e.target.value)}
                  autoComplete="off"
                />

                <Button
                  variant="primary"
                  className="w-full"
                  onClick={savePayment}
                  loading={payBusy}
                >
                  {payBusy ? "Menyimpan..." : "Simpan Rekening Pembayaran"}
                </Button>

                {payMsg && !payError && (
                  <div className="rounded-lg border border-signal/25 bg-signal-wash p-2.5 text-xs text-signal-strong font-medium">
                    {payMsg}
                  </div>
                )}
                {payError && <ErrorState title="Gagal menyimpan" description={payError} compact />}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* CSV Import with Field Mapping Modal */}
      <CsvImportModal
        open={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        onSuccess={() => {
          loadDocs();
          loadProductCount();
        }}
      />
    </div>
  );
}
