"use client";

/**
 * Catalog and media tab. The store owner wires a published Google Sheets URL;
 * the bot reads stock, price and media links from it on the next chat.
 */

import { useEffect, useState } from "react";
import {
  Banknote,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Database,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  ImagePlus,
  Paperclip,
  Plus,
  QrCode,
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
}: {
  sheetUrl: string;
  origin: string;
  configured: boolean;
  lastSyncedAt: string | null;
  payment: PaymentInfo;
}) {
  const [sheetUrl, setSheetUrl] = useState(initialSheetUrl);
  const [origin, setOrigin] = useState(initialOrigin);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogPreview>(null);

  // Payment destination (chapter 8.C): only the owner may set these.
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
  const [addMode, setAddMode] = useState<"file" | "text">("file");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState<"FAQ" | "SOP" | "SIZE_CHART" | "POLICY" | "OTHER">("FAQ");
  const [docContent, setDocContent] = useState("");
  const [docBusy, setDocBusy] = useState(false);
  const [docMsg, setDocMsg] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  useEffect(() => {
    loadDocs();
  }, []);

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
        // Persist the new key so the bot picks it up.
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
    <div className="page">
      <PageHeader
        eyebrow="Sumber data"
        title="Katalog dan media"
        description="Bot membaca stok, harga, dan tautan foto dari spreadsheet Anda. Tidak ada langkah impor, cukup edit spreadsheet seperti biasa."
        icon={<Database className="h-4 w-4" aria-hidden="true" />}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader
            icon={<FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}
            title="Sambungkan spreadsheet"
            description="Publish lewat File, Bagikan, Publikasikan ke web sebelum menempel tautannya."
            actions={
              <Badge tone={configured ? "signal" : "warn"}>
                {configured ? "terhubung" : "belum diatur"}
              </Badge>
            }
          />
          <CardBody className="space-y-4">
            <TextField
              id="sheets_url"
              label="Link Google Sheets"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              inputMode="url"
              autoComplete="off"
            />
            <TextField
              id="origin_subdistrict"
              label="Kecamatan asal pengiriman"
              placeholder="Kebayoran Baru, Jakarta Selatan"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              optional
              hint="Dipakai sebagai titik asal perhitungan ongkir kalau pembeli tidak mengirim lokasi."
            />

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" onClick={save} loading={busy} disabled={!sheetUrl.trim()}>
                {busy ? "Memeriksa..." : "Verifikasi dan simpan"}
              </Button>
              {lastSyncedAt && (
                <span className="meta">
                  sinkron terakhir {new Date(lastSyncedAt).toLocaleString("id-ID")}
                </span>
              )}
            </div>

            {busy && <InlineLoading label="Membaca struktur spreadsheet..." />}

            {error && <ErrorState title="Gagal menyimpan" description={error} compact />}

            {msg && !error && (
              <div className="rounded border border-signal/25 bg-signal-wash px-3 py-2.5 text-sm text-signal-strong">
                {msg}
              </div>
            )}

            {catalog && (
              <div className="rounded border border-ink-200 bg-ink-50 p-4">
                <div className="flex items-center gap-2">
                  <Table2 className="h-3.5 w-3.5 text-ink-500" aria-hidden="true" />
                  <p className="text-sm font-semibold text-ink">
                    {catalog.rows.length} baris produk terbaca
                  </p>
                </div>
                {catalog.warning ? (
                  <p className="mt-1.5 text-xs leading-relaxed text-warn">{catalog.warning}</p>
                ) : (
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-600">
                    Struktur kolom sesuai. Bot akan memakai data ini pada chat berikutnya.
                  </p>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<Banknote className="h-4 w-4" aria-hidden="true" />}
            title="Tujuan pembayaran"
            description="Nomor rekening dan QRIS yang disampaikan bot ke pembeli. Bot tidak akan pernah menyebut rekening selain yang diisi di sini."
            actions={
              bankNumber.trim() || qrisUrl ? (
                <Badge tone="signal">aktif</Badge>
              ) : (
                <Badge tone="warn">belum diatur</Badge>
              )
            }
          />
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="bank_name"
                label="Nama bank"
                placeholder="BCA"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                autoComplete="off"
              />
              <TextField
                id="bank_account_number"
                label="Nomor rekening"
                placeholder="1234567890"
                value={bankNumber}
                onChange={(e) => setBankNumber(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
            <TextField
              id="bank_account_holder"
              label="Atas nama (opsional)"
              placeholder="Nama pemilik rekening"
              value={bankHolder}
              onChange={(e) => setBankHolder(e.target.value)}
              autoComplete="off"
            />

            <div className="rounded border border-ink-200 bg-ink-50 p-4">
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-ink-500" aria-hidden="true" />
                <p className="text-sm font-semibold text-ink">Gambar QRIS toko</p>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                Bot melampirkan gambar ini beserta instruksi pembayaran. Unggah dalam format PNG atau JPG.
              </p>

              {qrisUrl ? (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrisUrl}
                    alt="QRIS toko"
                    className="h-24 w-24 rounded border border-ink-200 bg-white object-contain"
                  />
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-ink-300 bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50">
                      <ImagePlus className="h-4 w-4" aria-hidden="true" />
                      Ganti gambar
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
                        setPayMsg("QRIS dihapus. Bot tidak akan melampirkan QRIS lagi.");
                      }}
                      disabled={uploadingQris}
                    >
                      Hapus QRIS
                    </Button>
                  </div>
                </div>
              ) : (
                <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-ink-300 bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50">
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  {uploadingQris ? "Mengunggah..." : "Unggah gambar QRIS"}
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

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" onClick={savePayment} loading={payBusy}>
                {payBusy ? "Menyimpan..." : "Simpan tujuan pembayaran"}
              </Button>
              {payMsg && !payError && (
                <span className="text-sm text-signal-strong">{payMsg}</span>
              )}
            </div>
            {payError && <ErrorState title="Gagal menyimpan" description={payError} compact />}
          </CardBody>
        </Card>

        {/* Basis Pengetahuan AI Card */}
        <Card className="lg:col-span-2">
          <CardHeader
            icon={<BookOpen className="h-4 w-4" aria-hidden="true" />}
            title="Basis Pengetahuan Toko (Dokumen & Kebijakan)"
            description="Unggah atau ketik FAQ, Size Chart, panduan retur, spesifikasi bahan, dan SOP toko. Bot menggunakan dokumen ini untuk menjawab pertanyaan pembeli secara akurat."
            actions={
              <div className="flex items-center gap-2">
                <Badge tone={docs.length > 0 ? "signal" : "neutral"}>
                  {docs.length} dokumen
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
              <div className="space-y-4 rounded border border-ink-300 bg-ink-50/50 p-4">
                <div className="flex items-center gap-2 border-b border-ink-200 pb-3">
                  <button
                    type="button"
                    onClick={() => setAddMode("file")}
                    className={cn(
                      "rounded px-3 py-1.5 text-xs font-semibold transition-colors",
                      addMode === "file"
                        ? "bg-ink text-white"
                        : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                    )}
                  >
                    Unggah Berkas (PDF, DOCX, TXT, MD, CSV)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddMode("text")}
                    className={cn(
                      "rounded px-3 py-1.5 text-xs font-semibold transition-colors",
                      addMode === "text"
                        ? "bg-ink text-white"
                        : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                    )}
                  >
                    Tulis / Tempel Manual
                  </button>
                </div>

                {addMode === "file" ? (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-600">
                        Pilih Berkas Dokumen
                      </label>
                      <div className="flex flex-col items-center justify-center rounded border-2 border-dashed border-ink-300 bg-white p-5 text-center hover:border-ink-400">
                        <Upload className="mb-2 h-6 w-6 text-ink-400" aria-hidden="true" />
                        {uploadFile ? (
                          <div className="space-y-1">
                            <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-ink">
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
                            <span className="inline-flex items-center gap-1.5 rounded border border-ink-300 bg-ink-50 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-100">
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
                          label="Judul dokumen (opsional, bawaan nama berkas)"
                          placeholder="Mis. SOP Retur & Tukar Size 2026"
                          value={docTitle}
                          onChange={(e) => setDocTitle(e.target.value)}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="doc_type_file"
                          className="block text-xs font-semibold uppercase tracking-wide text-ink-600"
                        >
                          Kategori
                        </label>
                        <select
                          id="doc_type_file"
                          value={docType}
                          onChange={(e) =>
                            setDocType(
                              e.target.value as "FAQ" | "SOP" | "SIZE_CHART" | "POLICY" | "OTHER"
                            )
                          }
                          className="mt-1 block w-full rounded border border-ink-300 bg-white px-3 py-2 text-sm text-ink focus:border-ink-500 focus:outline-none"
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
                          placeholder="Mis. Kebijakan Retur & Garansi, Jam Buka Toko"
                          value={docTitle}
                          onChange={(e) => setDocTitle(e.target.value)}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="doc_type"
                          className="block text-xs font-semibold uppercase tracking-wide text-ink-600"
                        >
                          Kategori
                        </label>
                        <select
                          id="doc_type"
                          value={docType}
                          onChange={(e) =>
                            setDocType(
                              e.target.value as "FAQ" | "SOP" | "SIZE_CHART" | "POLICY" | "OTHER"
                            )
                          }
                          className="mt-1 block w-full rounded border border-ink-300 bg-white px-3 py-2 text-sm text-ink focus:border-ink-500 focus:outline-none"
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
                        className="block text-xs font-semibold uppercase tracking-wide text-ink-600"
                      >
                        Isi Panduan / Teks
                      </label>
                      <textarea
                        id="doc_content"
                        rows={5}
                        placeholder="Ketik atau tempel teks panduan, FAQ, atau kebijakan toko di sini..."
                        value={docContent}
                        onChange={(e) => setDocContent(e.target.value)}
                        className="mt-1 block w-full rounded border border-ink-300 bg-white p-3 font-mono text-xs text-ink placeholder:text-ink-400 focus:border-ink-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary" onClick={saveDoc} loading={docBusy}>
                    Simpan dokumen
                  </Button>
                  <Button
                    variant="ghost"
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
              <div className="rounded border border-signal/25 bg-signal-wash px-3 py-2 text-xs text-signal-strong">
                {docMsg}
              </div>
            )}

            {docsLoading ? (
              <InlineLoading label="Memuat basis pengetahuan..." />
            ) : docs.length === 0 ? (
              <div className="rounded border border-dashed border-ink-300 p-6 text-center text-xs text-ink-500">
                Belum ada dokumen basis pengetahuan. Tambahkan FAQ atau berkas kebijakan toko agar bot dapat menjawab pertanyaan pembeli di luar katalog.
              </div>
            ) : (
              <div className="divide-y divide-ink-200 rounded border border-ink-200 bg-white">
                {docs.map((d) => (
                  <div key={d.id} className="space-y-2 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-ink-500" aria-hidden="true" />
                          <span className="text-sm font-semibold text-ink">{d.title}</span>
                          <Badge tone="neutral">{d.doc_type}</Badge>
                          <Badge tone={d.is_active ? "signal" : "warn"}>
                            {d.is_active ? "aktif" : "nonaktif"}
                          </Badge>
                          {d.file_name && (
                            <span className="inline-flex items-center gap-1 rounded bg-ink-100 px-2 py-0.5 text-2xs text-ink-600">
                              <Paperclip className="h-3 w-3 text-ink-400" />
                              {d.file_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {d.file_url && (
                          <a
                            href={d.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded border border-ink-200 px-2.5 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50"
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
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteDoc(d.id)}
                          className="text-danger hover:text-danger-strong"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>

                    <div className="text-xs text-ink-600">
                      {expandedDoc === d.id ? (
                        <div className="mt-2 space-y-2">
                          <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded border border-ink-200 bg-ink-50 p-3 font-mono text-xs text-ink">
                            {d.content_text}
                          </pre>
                          <button
                            type="button"
                            onClick={() => setExpandedDoc(null)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-ink-600 hover:text-ink hover:underline"
                          >
                            <ChevronUp className="h-3.5 w-3.5" /> Sembunyikan teks
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
                            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-ink-700 hover:text-ink hover:underline"
                          >
                            <ChevronDown className="h-3.5 w-3.5" /> Teks AI
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

        <Card variant="sunken">
          <CardHeader title="Struktur kolom yang dibaca" />
          <CardBody className="space-y-4">
            <div>
              <p className="eyebrow mb-2">Wajib</p>
              <ul className="flex flex-wrap gap-1.5">
                {REQUIRED_COLUMNS.map((c) => (
                  <li
                    key={c}
                    className="rounded-sm border border-ink-200 bg-white px-2 py-0.5 font-mono text-2xs font-semibold text-ink-600"
                  >
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="eyebrow mb-2">Opsional</p>
              <ul className="flex flex-wrap gap-1.5">
                {OPTIONAL_COLUMNS.map((c) => (
                  <li
                    key={c}
                    className={cn(
                      "rounded-sm border border-dashed border-ink-300 bg-white px-2 py-0.5",
                      "font-mono text-2xs font-medium text-ink-500"
                    )}
                  >
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs leading-relaxed text-ink-500">
              Link Foto dan Link Video harus berupa tautan langsung ke berkas gambar atau video,
              bukan halaman Google Drive.
            </p>
            <a
              href="https://support.google.com/docs/answer/183965"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-signal-strong hover:underline"
            >
              Cara publish spreadsheet
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
