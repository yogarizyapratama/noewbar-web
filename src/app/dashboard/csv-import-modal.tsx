"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Badge, Button, Modal, cn } from "@/components/ui";

// ---------------------------------------------------------------------------
// Target fields supported by the system
// ---------------------------------------------------------------------------
export type TargetField = {
  key: string;
  label: string;
  required: boolean;
  hint: string;
  synonyms: string[];
};

export const TARGET_FIELDS: TargetField[] = [
  {
    key: "name",
    label: "Nama Produk",
    required: true,
    hint: "Nama produk yang akan dibaca dan dijawab oleh bot AI WhatsApp",
    synonyms: [
      "nama",
      "name",
      "produk",
      "product",
      "item",
      "title",
      "judul",
      "barang",
      "nama produk",
      "nama barang",
      "item name",
      "product name",
    ],
  },
  {
    key: "price",
    label: "Harga Jual (Rp)",
    required: true,
    hint: "Harga jual produk (angka). Karakter Rp dan titik akan otomatis dibersihkan",
    synonyms: [
      "harga",
      "price",
      "harga jual",
      "jual",
      "nominal",
      "rp",
      "tarif",
      "cost",
      "selling price",
      "unit price",
    ],
  },
  {
    key: "sku",
    label: "SKU / Kode Produk",
    required: false,
    hint: "Kode unik barang (jika kosong, sistem otomatis membuatkan kode unik PROD-XXXX)",
    synonyms: [
      "sku",
      "kode",
      "code",
      "id",
      "barcode",
      "kode barang",
      "kode produk",
      "item code",
      "part number",
      "no",
    ],
  },
  {
    key: "stock",
    label: "Jumlah Stok",
    required: false,
    hint: "Jumlah unit tersedia (bawaan: 10 unit jika tidak diisi)",
    synonyms: [
      "stok",
      "stock",
      "qty",
      "jumlah",
      "kuantitas",
      "quantity",
      "inventory",
      "sisa",
      "stok barang",
    ],
  },
  {
    key: "category",
    label: "Kategori Produk",
    required: false,
    hint: "Kategori produk untuk klasifikasi (bawaan: 'Umum')",
    synonyms: [
      "kategori",
      "category",
      "kelompok",
      "group",
      "jenis",
      "tipe",
      "koleksi",
      "kategori produk",
    ],
  },
  {
    key: "discount_price",
    label: "Harga Coret / Diskon (Rp)",
    required: false,
    hint: "Harga promo diskon (opsional, biarkan kosong jika tidak ada)",
    synonyms: [
      "diskon",
      "discount",
      "promo",
      "coret",
      "harga promo",
      "harga diskon",
      "special price",
      "potongan",
    ],
  },
  {
    key: "description",
    label: "Deskripsi & Bahan",
    required: false,
    hint: "Detail bahan, ukuran, dan spesifikasi sebagai referensi bot AI",
    synonyms: [
      "deskripsi",
      "description",
      "desc",
      "keterangan",
      "detail",
      "bahan",
      "spesifikasi",
      "rincian",
      "info",
      "keterangan produk",
    ],
  },
  {
    key: "image_url",
    label: "Link Foto / Media",
    required: false,
    hint: "Tautan URL foto produk (URL web atau CDN langsung)",
    synonyms: [
      "foto",
      "gambar",
      "image",
      "media",
      "link foto",
      "link gambar",
      "photo",
      "picture",
      "url foto",
      "gambar produk",
      "image url",
    ],
  },
  {
    key: "variant",
    label: "Varian Produk",
    required: false,
    hint: "Pilihan ukuran, warna, atau rasa (opsional)",
    synonyms: [
      "varian",
      "variant",
      "warna",
      "color",
      "ukuran",
      "size",
      "opsi",
      "tipe varian",
    ],
  },
];

// ---------------------------------------------------------------------------
// Official CSV template helper with UTF-8 BOM
// ---------------------------------------------------------------------------
export function downloadOfficialCsvTemplate() {
  const header =
    "SKU,Nama Produk,Kategori,Harga,Harga Diskon,Stok,Deskripsi,Link Foto,Varian,Berat (gram)\n";
  const rows = [
    'NOEW-001,Kemeja Linen Oversize,Fashion & Pakaian,189000,165000,25,"Bahan pure linen premium adem, jahitan garment rapi, kancing kayu kelapa",https://images.unsplash.com/photo-1598033129183-c4f50c736f10,Putih M,300',
    'NOEW-002,Serum Vitamin C Brightening,Skincare & Kecantikan,129000,,40,"Serum pencerah wajah dengan 10% Ethyl Ascorbic Acid, melembapkan dan meratakan warna kulit",https://images.unsplash.com/photo-1620916566398-39f1143ab7be,Botol 30ml,150',
    'NOEW-003,Kopi Arabika Gayo 250g,Makanan & Minuman,75000,69000,50,"Single origin roasted beans medium to dark, aroma floral dan fruity",https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd,Biji Kopi,260',
    'NOEW-004,Madu Hutan Liar Riau 500g,Kesehatan & Suplemen,95000,,20,"Madu murni alami tanpa campuran pemanis, kaya antioksidan",https://images.unsplash.com/photo-1587049352846-4a222e784d38,Jar 500g,600',
  ].join("\n");

  const blob = new Blob(["\uFEFF" + header + rows], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `template-katalog-noewbar-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// RFC-4180 quote-aware robust CSV / TSV parser
// ---------------------------------------------------------------------------
export function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const trimmed = text.trim();
  if (!trimmed) return { headers: [], rows: [] };

  const firstLine = trimmed.split(/\r?\n/)[0] || "";
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  let delimiter = ",";
  if (semicolonCount > commaCount && semicolonCount >= tabCount) delimiter = ";";
  else if (tabCount > commaCount && tabCount > semicolonCount) delimiter = "\t";

  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    const nextChar = trimmed[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentCell.trim());
        currentCell = "";
      } else if (char === "\n" || (char === "\r" && nextChar === "\n")) {
        if (char === "\r") i++;
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c.length > 0)) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      lines.push(currentRow);
    }
  }

  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].map((h) => h.replace(/^["'\s]+|["'\s]+$/g, ""));
  const rows = lines.slice(1);
  return { headers, rows };
}

// ---------------------------------------------------------------------------
// Auto-matcher between detected CSV headers and system target fields
// ---------------------------------------------------------------------------
export function autoMatchFields(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedHeaders = new Set<string>();

  for (const field of TARGET_FIELDS) {
    let bestMatch: string | null = null;
    let highestScore = -1;

    for (const h of headers) {
      if (usedHeaders.has(h)) continue;
      const cleanH = h.toLowerCase().trim();

      // 1. Exact match with label or key
      if (cleanH === field.key.toLowerCase() || cleanH === field.label.toLowerCase()) {
        bestMatch = h;
        highestScore = 100;
        break;
      }

      // 2. Exact match with any synonym
      for (const syn of field.synonyms) {
        if (cleanH === syn) {
          bestMatch = h;
          highestScore = 90;
          break;
        }
      }
      if (highestScore >= 90) break;

      // 3. Substring match
      for (const syn of field.synonyms) {
        if (cleanH.includes(syn) || syn.includes(cleanH)) {
          const score = 50 + syn.length;
          if (score > highestScore) {
            highestScore = score;
            bestMatch = h;
          }
        }
      }
    }

    if (bestMatch && highestScore >= 50) {
      mapping[field.key] = bestMatch;
      usedHeaders.add(bestMatch);
    } else {
      mapping[field.key] = "";
    }
  }

  return mapping;
}

// ---------------------------------------------------------------------------
// Main Modal Component
// ---------------------------------------------------------------------------
export function CsvImportModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<"upload" | "mapping" | "preview">("upload");
  const [inputMode, setInputMode] = useState<"file" | "paste">("file");
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);

  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});

  const [upsert, setUpsert] = useState(true);
  const [autoSku, setAutoSku] = useState(true);
  const [importing, setImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal is opened
  useEffect(() => {
    if (open) {
      setStep("upload");
      setRawText("");
      setFileName(null);
      setFileSize(null);
      setParsedHeaders([]);
      setParsedRows([]);
      setFieldMapping({});
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [open]);

  function handleFileSelected(file: File) {
    if (!file) return;
    setFileName(file.name);
    setFileSize(file.size);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        processContent(content);
      }
    };
    reader.readAsText(file);
  }

  function handlePasteSubmit() {
    if (!rawText.trim()) {
      setErrorMsg("Tempelkan data teks CSV terlebih dahulu.");
      return;
    }
    processContent(rawText);
  }

  function processContent(content: string) {
    const { headers, rows } = parseCsvText(content);
    if (headers.length === 0 || rows.length === 0) {
      setErrorMsg("Berkas tidak memiliki baris data atau format kolom tidak terbaca.");
      return;
    }

    setParsedHeaders(headers);
    setParsedRows(rows);

    const initialMapping = autoMatchFields(headers);
    setFieldMapping(initialMapping);
    setStep("mapping");
  }

  // Check if mandatory fields (name, price) are mapped
  const canProceedFromMapping = useMemo(() => {
    const hasName = Boolean(fieldMapping["name"]);
    const hasPrice = Boolean(fieldMapping["price"]);
    return hasName && hasPrice;
  }, [fieldMapping]);

  // Construct preview data
  const mappedPreviewRows = useMemo(() => {
    if (parsedRows.length === 0) return [];
    const sampleRows = parsedRows.slice(0, 5);

    return sampleRows.map((row, rowIdx) => {
      const mapped: Record<string, string> = {};
      TARGET_FIELDS.forEach((f) => {
        const colHeader = fieldMapping[f.key];
        if (colHeader) {
          const colIdx = parsedHeaders.indexOf(colHeader);
          mapped[f.key] = colIdx !== -1 ? row[colIdx] || "" : "";
        } else {
          mapped[f.key] = "";
        }
      });

      // SKU auto-fallback for preview
      if (!mapped["sku"] && autoSku) {
        mapped["sku"] = `PROD-${String(1000 + rowIdx)}`;
      }
      return mapped;
    });
  }, [parsedRows, parsedHeaders, fieldMapping, autoSku]);

  async function executeImport() {
    setImporting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Map all rows
      const itemsToImport = parsedRows
        .map((row) => {
          const nameCol = fieldMapping["name"];
          const priceCol = fieldMapping["price"];
          const skuCol = fieldMapping["sku"];
          const stockCol = fieldMapping["stock"];
          const catCol = fieldMapping["category"];
          const discCol = fieldMapping["discount_price"];
          const descCol = fieldMapping["description"];
          const imgCol = fieldMapping["image_url"];
          const varCol = fieldMapping["variant"];

          const nameIdx = nameCol ? parsedHeaders.indexOf(nameCol) : -1;
          const priceIdx = priceCol ? parsedHeaders.indexOf(priceCol) : -1;
          const skuIdx = skuCol ? parsedHeaders.indexOf(skuCol) : -1;
          const stockIdx = stockCol ? parsedHeaders.indexOf(stockCol) : -1;
          const catIdx = catCol ? parsedHeaders.indexOf(catCol) : -1;
          const discIdx = discCol ? parsedHeaders.indexOf(discCol) : -1;
          const descIdx = descCol ? parsedHeaders.indexOf(descCol) : -1;
          const imgIdx = imgCol ? parsedHeaders.indexOf(imgCol) : -1;
          const varIdx = varCol ? parsedHeaders.indexOf(varCol) : -1;

          const name = nameIdx !== -1 ? row[nameIdx]?.trim() : "";
          const rawPrice = priceIdx !== -1 ? row[priceIdx]?.replace(/[^0-9]/g, "") : "";
          if (!name || !rawPrice) return null;

          let sku = skuIdx !== -1 ? row[skuIdx]?.trim().toUpperCase() : "";
          if (!sku && autoSku) {
            sku = `PROD-${Math.floor(100000 + Math.random() * 900000)}`;
          }

          const rawStock = stockIdx !== -1 ? row[stockIdx]?.replace(/[^0-9]/g, "") : "10";
          const category = (catIdx !== -1 ? row[catIdx]?.trim() : "") || "Umum";
          const discount_price = discIdx !== -1 ? row[discIdx]?.replace(/[^0-9]/g, "") : null;
          const description = descIdx !== -1 ? row[descIdx]?.trim() : "";
          const imageUrl = imgIdx !== -1 ? row[imgIdx]?.trim() : "";
          const variant = varIdx !== -1 ? row[varIdx]?.trim() : "";

          return {
            name,
            price: parseInt(rawPrice, 10),
            sku,
            stock: parseInt(rawStock || "0", 10),
            category,
            discount_price: discount_price ? parseInt(discount_price, 10) : null,
            description,
            image_url: imageUrl,
            variant,
          };
        })
        .filter(Boolean);

      if (itemsToImport.length === 0) {
        setErrorMsg("Tidak ada baris produk valid yang memiliki Nama dan Harga.");
        setImporting(false);
        return;
      }

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import_batch",
          rows: itemsToImport,
          upsert,
        }),
      });

      const json = await res.json();
      if (json.ok) {
        setSuccessMsg(
          `Sukses! Sebanyak ${json.imported} produk berhasil diimpor ke katalog toko Anda.`
        );
        onSuccess();
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        setErrorMsg(json.error || "Gagal mengimpor produk ke database.");
      }
    } catch {
      setErrorMsg("Terjadi gangguan koneksi saat mengimpor produk.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div
        className="w-full max-w-3xl rounded-2xl border border-ink-200 bg-white p-4 sm:p-6 shadow-overlay space-y-4 max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-ink-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-900 text-white shadow-flat">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-ink-900">
                  Impor Katalog & Pemetaan Kolom Otomatis
                </h3>
                <Badge tone="signal">CSV / Excel</Badge>
              </div>
              <p className="text-2xs text-ink-500 mt-0.5">
                Unggah data produk apa pun tanpa perlu mengubah nama kolom secara manual di Excel.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors"
            aria-label="Tutup modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-3 gap-2 text-2xs font-semibold">
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg p-2 border transition-colors",
              step === "upload"
                ? "border-signal bg-signal-wash text-signal-strong font-bold"
                : "border-ink-200 bg-ink-50 text-ink-600"
            )}
          >
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-ink-900 text-2xs border border-ink-200">
              1
            </span>
            <span>Pilih Berkas CSV</span>
          </div>

          <div
            className={cn(
              "flex items-center gap-2 rounded-lg p-2 border transition-colors",
              step === "mapping"
                ? "border-signal bg-signal-wash text-signal-strong font-bold"
                : "border-ink-200 bg-ink-50 text-ink-600"
            )}
          >
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-ink-900 text-2xs border border-ink-200">
              2
            </span>
            <span>Petakan Kolom</span>
          </div>

          <div
            className={cn(
              "flex items-center gap-2 rounded-lg p-2 border transition-colors",
              step === "preview"
                ? "border-signal bg-signal-wash text-signal-strong font-bold"
                : "border-ink-200 bg-ink-50 text-ink-600"
            )}
          >
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-ink-900 text-2xs border border-ink-200">
              3
            </span>
            <span>Pratinjau & Simpan</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto space-y-4 flex-1 pr-1">
          {errorMsg && (
            <div className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger-wash p-3 text-xs text-danger-strong">
              <AlertCircle className="h-4 w-4 shrink-0 text-danger mt-0.5" />
              <p>{errorMsg}</p>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2.5 rounded-xl border border-signal/25 bg-signal-wash p-3 text-xs text-signal-strong">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-signal mt-0.5" />
              <p className="font-semibold">{successMsg}</p>
            </div>
          )}

          {/* STEP 1: UPLOAD OR PASTE */}
          {step === "upload" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-200 bg-ink-50 p-3.5">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-ink-900">
                    Belum punya format data atau ingin contoh resmi?
                  </p>
                  <p className="text-2xs text-ink-600">
                    Unduh berkas template standar CSV dengan contoh produk real yang sudah disesuaikan untuk WhatsApp AI.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={downloadOfficialCsvTemplate}
                  className="shrink-0"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Unduh Template CSV
                </Button>
              </div>

              {/* Input Mode Selector */}
              <div className="flex items-center gap-2 border-b border-ink-100 pb-2">
                <button
                  type="button"
                  onClick={() => setInputMode("file")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    inputMode === "file"
                      ? "bg-ink-900 text-white"
                      : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                  )}
                >
                  Unggah Berkas (.csv / .tsv / .txt)
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode("paste")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    inputMode === "paste"
                      ? "bg-ink-900 text-white"
                      : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                  )}
                >
                  Salin & Tempel Teks CSV
                </button>
              </div>

              {inputMode === "file" ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFileSelected(file);
                  }}
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink-300 bg-surface-sunken p-8 text-center hover:border-signal transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mb-2.5 h-8 w-8 text-ink-400" />
                  <p className="text-sm font-bold text-ink-900">
                    Tarik dan lepaskan berkas CSV Anda di sini
                  </p>
                  <p className="text-xs text-ink-500 mt-1">
                    atau klik untuk memilih berkas dari komputer (ekspor dari Shopee, Tokopedia, WooCommerce, Excel)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt,.tsv"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelected(file);
                    }}
                  />
                  {fileName && (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-signal/30 bg-signal-wash px-3 py-1.5 text-xs font-semibold text-signal-strong">
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>{fileName}</span>
                      {fileSize && (
                        <span className="font-mono text-2xs opacity-80">
                          ({(fileSize / 1024).toFixed(1)} KB)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-ink-700">
                    Tempelkan teks baris data CSV Anda:
                  </label>
                  <textarea
                    rows={8}
                    placeholder={`SKU,Nama Barang,Harga Jual,Jumlah Stok,Kategori\nNOEW-01,Gamis Silk Emerald,185000,15,Fashion\nNOEW-02,Gamis Velvet Black,210000,8,Fashion`}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    className="w-full rounded-xl border border-ink-300 bg-white p-3 font-mono text-xs text-ink-900 placeholder:text-ink-400 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal"
                  />
                  <div className="flex justify-end">
                    <Button variant="primary" size="sm" onClick={handlePasteSubmit}>
                      Lanjutkan ke Pemetaan Kolom
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: FIELD MAPPING */}
          {step === "mapping" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-signal/25 bg-signal-wash p-3 text-xs text-signal-strong">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 shrink-0 text-signal" />
                  <span>
                    Terdeteksi <strong>{parsedHeaders.length} kolom</strong> dan{" "}
                    <strong>{parsedRows.length} baris produk</strong>.
                  </span>
                </div>
                <span className="text-2xs text-signal-strong opacity-80">
                  Kolom dicocokkan otomatis berdasarkan kemiripan nama
                </span>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-ink-600">
                  Sesuaikan kolom dari berkas Anda ke field target sistem. Kolom bertanda{" "}
                  <span className="font-semibold text-danger">Wajib</span> harus dipetakan.
                </p>

                <div className="divide-y divide-ink-100 rounded-xl border border-ink-200 bg-white overflow-hidden shadow-flat">
                  {TARGET_FIELDS.map((field) => {
                    const currentMapped = fieldMapping[field.key] || "";
                    const sampleValue =
                      currentMapped && parsedRows.length > 0
                        ? parsedRows[0][parsedHeaders.indexOf(currentMapped)] || ""
                        : "";

                    return (
                      <div
                        key={field.key}
                        className="grid grid-cols-1 sm:grid-cols-12 items-center gap-3 p-3 hover:bg-ink-50/50 transition-colors"
                      >
                        <div className="sm:col-span-5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-ink-900">
                              {field.label}
                            </span>
                            {field.required ? (
                              <Badge tone="danger">Wajib</Badge>
                            ) : (
                              <Badge tone="neutral">Opsional</Badge>
                            )}
                          </div>
                          <p className="text-2xs text-ink-500 mt-0.5">{field.hint}</p>
                        </div>

                        <div className="sm:col-span-4">
                          <select
                            value={currentMapped}
                            onChange={(e) =>
                              setFieldMapping((prev) => ({
                                ...prev,
                                [field.key]: e.target.value,
                              }))
                            }
                            aria-label={`Petakan kolom untuk ${field.label}`}
                            className={cn(
                              "w-full rounded-lg border px-3 py-2 text-xs font-semibold text-ink-900 focus:outline-none focus:ring-2",
                              field.required && !currentMapped
                                ? "border-danger bg-danger-wash text-danger-strong focus:ring-danger"
                                : currentMapped
                                  ? "border-signal bg-signal-wash/40 focus:ring-signal"
                                  : "border-ink-300 bg-white focus:ring-signal"
                            )}
                          >
                            <option value="">-- Abaikan / Tidak Dipetakan --</option>
                            {parsedHeaders.map((header) => (
                              <option key={header} value={header}>
                                Kolom: &quot;{header}&quot;
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-3 text-2xs font-mono text-ink-500 truncate">
                          {sampleValue ? (
                            <span className="rounded bg-ink-100 px-2 py-1 text-ink-800">
                              Misal: {sampleValue.slice(0, 24)}
                              {sampleValue.length > 24 ? "..." : ""}
                            </span>
                          ) : (
                            <span className="text-ink-400 italic">Belum terpetakan</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Options */}
              <div className="space-y-2 rounded-xl border border-ink-200 bg-ink-50 p-3.5">
                <label className="flex items-center gap-2 text-xs text-ink-800 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSku}
                    onChange={(e) => setAutoSku(e.target.checked)}
                    className="h-4 w-4 rounded border-ink-300 text-signal focus:ring-signal"
                  />
                  <span>
                    Buatkan kode SKU unik otomatis (mis. <code>PROD-81920</code>) jika kolom SKU tidak dipetakan atau kosong
                  </span>
                </label>
                <label className="flex items-center gap-2 text-xs text-ink-800 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={upsert}
                    onChange={(e) => setUpsert(e.target.checked)}
                    className="h-4 w-4 rounded border-ink-300 text-signal focus:ring-signal"
                  />
                  <span>
                    Perbarui harga dan stok jika produk dengan SKU yang sama sudah ada di katalog toko (Upsert)
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & VERIFICATION */}
          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-signal/25 bg-signal-wash p-3 text-xs text-signal-strong">
                <span className="font-semibold">
                  Pratinjau data hasil pemetaan ({parsedRows.length} total baris siap diproses)
                </span>
                <span className="text-2xs opacity-80">Menampilkan 5 baris pertama</span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white shadow-flat">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-ink-200 bg-ink-50 text-ink-700 font-semibold">
                      <th className="p-2.5">SKU</th>
                      <th className="p-2.5">Nama Produk</th>
                      <th className="p-2.5">Kategori</th>
                      <th className="p-2.5">Harga</th>
                      <th className="p-2.5">Diskon</th>
                      <th className="p-2.5">Stok</th>
                      <th className="p-2.5">Media Foto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 font-sans">
                    {mappedPreviewRows.map((r, i) => (
                      <tr key={i} className="hover:bg-ink-50/50">
                        <td className="p-2.5 font-mono text-2xs font-semibold text-ink-900">
                          {r.sku || "-"}
                        </td>
                        <td className="p-2.5 font-medium text-ink-900 max-w-[180px] truncate">
                          {r.name || <span className="text-danger italic">Kosong</span>}
                        </td>
                        <td className="p-2.5 text-ink-600">{r.category || "Umum"}</td>
                        <td className="p-2.5 font-mono text-ink-900">
                          {r.price ? `Rp ${Number(r.price.replace(/[^0-9]/g, "")).toLocaleString("id-ID")}` : "-"}
                        </td>
                        <td className="p-2.5 font-mono text-ink-500">
                          {r.discount_price ? `Rp ${Number(r.discount_price.replace(/[^0-9]/g, "")).toLocaleString("id-ID")}` : "-"}
                        </td>
                        <td className="p-2.5 font-mono font-semibold text-ink-900">
                          {r.stock || "10"}
                        </td>
                        <td className="p-2.5 text-2xs font-mono text-ink-500 truncate max-w-[120px]">
                          {r.image_url ? (
                            <span className="text-signal-strong underline">Tersedia</span>
                          ) : (
                            <span className="text-ink-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-between gap-2.5 pt-3 border-t border-ink-100">
          <div>
            {step === "mapping" && (
              <Button variant="ghost" size="sm" onClick={() => setStep("upload")}>
                Kembali ke Pilih Berkas
              </Button>
            )}
            {step === "preview" && (
              <Button variant="ghost" size="sm" onClick={() => setStep("mapping")}>
                Kembali ke Pemetaan Kolom
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={importing}>
              Batal
            </Button>

            {step === "upload" && (
              <Button
                variant="primary"
                disabled={!fileName && !rawText.trim()}
                onClick={() => {
                  if (rawText.trim()) handlePasteSubmit();
                }}
              >
                Lanjutkan Pemetaan
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            )}

            {step === "mapping" && (
              <Button
                variant="primary"
                disabled={!canProceedFromMapping}
                onClick={() => setStep("preview")}
              >
                Lihat Pratinjau
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            )}

            {step === "preview" && (
              <Button
                variant="primary"
                onClick={executeImport}
                loading={importing}
                disabled={importing}
              >
                Mulai Impor {parsedRows.length} Produk
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
