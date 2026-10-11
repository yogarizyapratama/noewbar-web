"use client";

/**
 * AI Product Catalog Management Panel (USP 1).
 *
 * Provides:
 * - Full CRUD product management in PostgreSQL.
 * - Dynamic price, discount price, stock, variants, attributes.
 * - AI Knowledge Base sync indicator (zero-hallucination guarantee).
 * - CSV Import and Export.
 * - Search, Category filter, Status toggle.
 */

import { useEffect, useRef, useState } from "react";
import {
  Archive,
  Download,
  Edit2,
  Loader2,
  Package,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  ErrorState,
  InlineLoading,
  Modal,
  PageHeader,
  TextField,
  cn,
} from "@/components/ui";

export const PREDEFINED_CATEGORIES = [
  "Skincare & Kecantikan",
  "Fashion & Pakaian",
  "Makanan & Minuman",
  "Elektronik & Gadget",
  "Kesehatan & Suplemen",
  "Aksesoris & Perhiasan",
  "Peralatan Rumah Tangga",
  "Ibu & Bayi",
  "Umum",
];

export type ProductItem = {
  id: string;
  name: string;
  sku: string;
  category: string;
  description: string;
  price: number;
  discount_price: number | null;
  stock: number;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  images: string[];
  variants: any[];
  attributes: Record<string, any>;
  is_synced_to_ai: boolean;
  created_at: string;
};

export function PanelProducts() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formSku, setFormSku] = useState("");
  const [formCat, setFormCat] = useState("Umum");
  const [formCatSelect, setFormCatSelect] = useState("Umum");
  const [formPrice, setFormPrice] = useState("");
  const [formDiscPrice, setFormDiscPrice] = useState("");
  const [formStock, setFormStock] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Direct image upload states
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSV import state
  const [csvText, setCsvText] = useState("");
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvMsg, setCsvMsg] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, [search, selectedCat, selectedStatus]);

  async function loadProducts() {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search) q.set("search", search);
      if (selectedCat !== "ALL") q.set("category", selectedCat);
      if (selectedStatus !== "ALL") q.set("status", selectedStatus);

      const res = await fetch(`/api/products?${q.toString()}`);
      const json = await res.json();
      if (json.ok) {
        setProducts(json.products || []);
        setCategories(json.categories || []);
        setTotal(json.total || 0);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const selectedFiles = Array.from(fileList);

    if (formImages.length + selectedFiles.length > 5) {
      setUploadError(
        `Maksimal 5 foto produk (saat ini ${formImages.length} foto, mencoba menambah ${selectedFiles.length} foto).`
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    for (const f of selectedFiles) {
      if (f.size > MAX_SIZE) {
        setUploadError(`Foto "${f.name}" melebihi batas ukuran maksimal 5 MB.`);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    }

    setUploadingImage(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      for (const f of selectedFiles) {
        fd.append("files", f);
      }
      const res = await fetch("/api/products/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.urls)) {
        setFormImages((prev) => [...prev, ...data.urls].slice(0, 5));
      } else if (data.ok && data.url) {
        setFormImages((prev) => [...prev, data.url].slice(0, 5));
      } else {
        setUploadError(data.error || "Gagal mengunggah foto.");
      }
    } catch {
      setUploadError("Gagal mengunggah foto ke server penyimpanan.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleAddManualUrl() {
    if (!manualUrl.trim()) return;
    if (formImages.length >= 5) {
      setUploadError("Maksimal 5 foto produk telah tercapai.");
      return;
    }
    setFormImages((prev) => [...prev, manualUrl.trim()].slice(0, 5));
    setManualUrl("");
    setShowUrlInput(false);
  }

  function removeImage(index: number) {
    setFormImages((prev) => prev.filter((_, i) => i !== index));
  }

  function setAsPrimaryImage(index: number) {
    if (index === 0) return;
    setFormImages((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      return [item, ...copy];
    });
  }

  function openCreate() {
    setEditingProduct(null);
    setFormName("");
    setFormSku(`PROD-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormCat("Umum");
    setFormCatSelect("Umum");
    setFormPrice("");
    setFormDiscPrice("");
    setFormStock("10");
    setFormDesc("");
    setFormImages([]);
    setManualUrl("");
    setUploadError(null);
    setFormError(null);
    setShowUrlInput(false);
    setShowAddModal(true);
  }

  function openEdit(p: ProductItem) {
    setEditingProduct(p);
    setFormName(p.name);
    setFormSku(p.sku);
    const cat = p.category || "Umum";
    setFormCat(cat);
    const isKnown = PREDEFINED_CATEGORIES.includes(cat) || categories.includes(cat);
    setFormCatSelect(isKnown ? cat : "__CUSTOM__");
    setFormPrice(String(p.price));
    setFormDiscPrice(p.discount_price ? String(p.discount_price) : "");
    setFormStock(String(p.stock));
    setFormDesc(p.description || "");
    const imgs = Array.isArray(p.images)
      ? p.images.filter((x): x is string => typeof x === "string" && Boolean(x.trim()))
      : [];
    setFormImages(imgs.slice(0, 5));
    setManualUrl("");
    setUploadError(null);
    setFormError(null);
    setShowUrlInput(false);
    setShowAddModal(true);
  }

  async function handleSave() {
    setFormBusy(true);
    setFormError(null);
    try {
      const payload: any = {
        action: editingProduct ? "update" : "create",
        id: editingProduct?.id,
        name: formName.trim(),
        sku: formSku.trim(),
        category: formCat.trim() || "Umum",
        price: Number(formPrice),
        discount_price: formDiscPrice ? Number(formDiscPrice) : null,
        stock: parseInt(formStock || "0", 10),
        description: formDesc.trim(),
        images: formImages.slice(0, 5),
      };

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.ok) {
        setShowAddModal(false);
        await loadProducts();
      } else {
        setFormError(json.error || "Gagal menyimpan produk.");
      }
    } catch {
      setFormError("Gagal menghubungi server.");
    } finally {
      setFormBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus produk ini dari database katalog?")) return;
    await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    await loadProducts();
  }

  async function handleArchive(id: string, currentStatus: string) {
    await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive", id, status: currentStatus }),
    });
    await loadProducts();
  }

  async function handleImportCsv() {
    setCsvBusy(true);
    setCsvMsg(null);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import_csv", csv_content: csvText }),
      });
      const json = await res.json();
      if (json.ok) {
        setCsvMsg(`Berhasil mengimpor ${json.imported} produk ke katalog.`);
        setCsvText("");
        await loadProducts();
      } else {
        setCsvMsg(json.error || "Gagal mengimpor CSV.");
      }
    } catch {
      setCsvMsg("Gagal mengimpor berkas CSV.");
    } finally {
      setCsvBusy(false);
    }
  }

  function handleExportCsv() {
    if (products.length === 0) return;
    const header = "SKU,Nama Produk,Kategori,Harga,Stok,Deskripsi\n";
    const rows = products
      .map(
        (p) =>
          `"${p.sku}","${p.name}","${p.category}",${p.price},${p.stock},"${(p.description || "").replace(/"/g, '""')}"`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `katalog-produk-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page space-y-6">
      <PageHeader
        eyebrow="Katalog Pintar"
        title="Katalog Produk & Pengetahuan AI"
        description="Kelola produk toko Anda di database. Harga, stok, dan spesifikasi produk otomatis menjadi sumber data terpercaya untuk AI Customer Service WhatsApp Anda."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleExportCsv} disabled={products.length === 0}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Ekspor CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowCsvModal(true)}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Impor CSV
            </Button>
            <Button variant="primary" size="sm" onClick={openCreate}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Tambah Produk
            </Button>
          </div>
        }
      />

      {/* Bar Indikator Integrasi AI */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-flat flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-bold text-emerald-950">
              Sinkronisasi Otomatis ke WhatsApp AI: Aktif
            </p>
            <p className="text-2xs text-emerald-800">
              Setiap kali harga atau stok diperbarui di sini, AI langsung membaca data terbaru tanpa perlu restart.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-white px-2.5 py-1 text-xs font-mono font-bold text-emerald-900 border border-emerald-200">
            {total} Produk Tersedia
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
          <input
            type="text"
            placeholder="Cari nama produk, SKU, atau bahan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-ink-200 bg-white pl-9 pr-4 py-2 text-xs text-ink placeholder:text-ink-400 focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs text-ink focus:outline-none"
          >
            <option value="ALL">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs text-ink focus:outline-none"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Arsip</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="p-8">
              <InlineLoading label="Memuat katalog produk..." />
            </div>
          ) : products.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="mx-auto h-10 w-10 text-ink-300 mb-3" />
              <p className="text-sm font-semibold text-ink">Belum Ada Produk di Katalog</p>
              <p className="mt-1 text-xs text-ink-500 max-w-sm mx-auto">
                Tambahkan produk pertama Anda atau impor via CSV agar AI dapat menjawab pertanyaan pembeli.
              </p>
              <Button size="sm" variant="primary" onClick={openCreate} className="mt-4">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Tambah Produk Sekarang
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-ink-200 bg-ink-50/60 text-2xs font-bold uppercase tracking-wider text-ink-500">
                    <th className="py-3 px-4">Produk</th>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Harga</th>
                    <th className="py-3 px-4">Stok</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 text-xs">
                  {products.map((p) => {
                    const price = Number(p.price);
                    const disc = p.discount_price ? Number(p.discount_price) : null;
                    const imgs = Array.isArray(p.images) ? (p.images as string[]) : [];
                    const img = imgs[0] || null;
                    const extraCount = imgs.length > 1 ? imgs.length - 1 : 0;

                    return (
                      <tr key={p.id} className="hover:bg-ink-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={img || "/placeholder-product.svg"}
                                alt={p.name}
                                className="h-9 w-9 rounded-md object-cover border border-ink-200 bg-ink-50"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = "/placeholder-product.svg";
                                }}
                              />
                              {extraCount > 0 && (
                                <span
                                  title={`${imgs.length} foto tersedia`}
                                  className="absolute -bottom-1 -right-1 rounded bg-ink-800 px-1 text-[9px] font-bold text-white shadow-sm ring-1 ring-white"
                                >
                                  +{extraCount}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-ink">{p.name}</p>
                              {p.description && (
                                <p className="text-2xs text-ink-500 line-clamp-1 max-w-xs">
                                  {p.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-ink-600">{p.sku}</td>
                        <td className="py-3 px-4 text-ink-600">{p.category}</td>
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-ink">
                            Rp {(disc ?? price).toLocaleString("id-ID")}
                          </span>
                          {disc && (
                            <span className="ml-1.5 font-mono text-2xs text-ink-400 line-through">
                              Rp {price.toLocaleString("id-ID")}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <span
                            className={cn(
                              "font-semibold",
                              p.stock > 0 ? "text-signal-strong" : "text-danger"
                            )}
                          >
                            {p.stock}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge tone={p.status === "ACTIVE" ? "signal" : "neutral"}>
                            {p.status === "ACTIVE" ? "Aktif" : p.status === "DRAFT" ? "Draft" : "Arsip"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEdit(p)}
                              className="rounded p-1 text-ink-500 hover:bg-ink-100 hover:text-ink"
                              title="Edit Produk"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleArchive(p.id, p.status)}
                              className="rounded p-1 text-ink-500 hover:bg-ink-100 hover:text-ink"
                              title={p.status === "ARCHIVED" ? "Aktifkan" : "Arsipkan"}
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(p.id)}
                              className="rounded p-1 text-danger hover:bg-danger-wash hover:text-danger-strong"
                              title="Hapus Produk"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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

      {/* Modal Tambah / Edit Produk */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)}>
        <div
          className="w-full max-w-xl rounded-2xl border border-ink-200 bg-white p-4 sm:p-6 shadow-overlay space-y-4 max-h-[92vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
            <div className="flex items-start justify-between border-b border-ink-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-ink flex items-center gap-2">
                  <Package className="h-4 w-4 text-signal" />
                  {editingProduct ? "Edit Produk Katalog" : "Tambah Produk Baru"}
                </h3>
                <p className="text-2xs text-ink-500 mt-0.5">
                  Lengkapi data produk untuk etalase dan basis pengetahuan AI Customer Service.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center -mr-1"
                aria-label="Tutup modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && <ErrorState title="Peringatan" description={formError} compact />}

            <div className="overflow-y-auto space-y-3.5 pr-0.5 sm:pr-1 flex-1">
              <TextField
                id="p_name"
                label="Nama Produk *"
                placeholder="Mis. Gamis Syari Premium Silk"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextField
                  id="p_sku"
                  label="SKU / Kode Barang *"
                  placeholder="GMS-01"
                  value={formSku}
                  onChange={(e) => setFormSku(e.target.value)}
                />
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-600">
                    Kategori Produk *
                  </label>
                  <select
                    id="p_cat_select"
                    value={formCatSelect}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormCatSelect(val);
                      if (val !== "__CUSTOM__") {
                        setFormCat(val);
                      } else {
                        setFormCat("");
                      }
                    }}
                    className="w-full min-h-[42px] rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink focus:border-signal focus:outline-none"
                  >
                    {Array.from(new Set([...PREDEFINED_CATEGORIES, ...categories.filter(Boolean)])).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="__CUSTOM__">+ Kategori Kustom Baru</option>
                  </select>
                  {formCatSelect === "__CUSTOM__" && (
                    <input
                      type="text"
                      placeholder="Ketik kategori kustom..."
                      value={formCat}
                      onChange={(e) => setFormCat(e.target.value)}
                      className="mt-1.5 w-full min-h-[38px] rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs text-ink placeholder:text-ink-400 focus:border-signal focus:outline-none"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <TextField
                  id="p_price"
                  label="Harga Normal (Rp) *"
                  placeholder="185000"
                  inputMode="numeric"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                />
                <TextField
                  id="p_disc"
                  label="Harga Promo (Rp)"
                  placeholder="165000"
                  inputMode="numeric"
                  value={formDiscPrice}
                  onChange={(e) => setFormDiscPrice(e.target.value)}
                  optional
                />
                <TextField
                  id="p_stock"
                  label="Stok *"
                  placeholder="15"
                  inputMode="numeric"
                  value={formStock}
                  onChange={(e) => setFormStock(e.target.value)}
                />
              </div>

              {/* Direct Multi-Image Upload Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-ink-600">
                    Foto Produk ({formImages.length}/5)
                  </label>
                  <span className="text-2xs font-medium text-ink-500">
                    Maks. 5 foto (maks. 5 MB per foto)
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Gallery of Uploaded Photos */}
                  {formImages.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-2.5">
                      {formImages.map((imgUrl, idx) => (
                        <div
                          key={idx}
                          className="group relative flex flex-col items-center rounded-xl border border-ink-200 bg-white p-1.5 shadow-sm"
                        >
                          <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-ink-50">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imgUrl}
                              alt={`Foto ${idx + 1}`}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = "/placeholder-product.svg";
                              }}
                            />
                            {idx === 0 ? (
                              <span className="absolute left-1 top-1 rounded bg-signal px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                                Utama
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setAsPrimaryImage(idx)}
                                title="Jadikan Foto Utama"
                                className="absolute left-1 top-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-medium text-white transition-opacity hover:bg-black/90 opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
                              >
                                Set Utama
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeImage(idx)}
                              title="Hapus foto ini"
                              className="absolute right-1 top-1 rounded bg-danger/90 p-1 text-white transition-opacity hover:bg-danger opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                          <span className="mt-1 text-[10px] font-mono text-ink-500">
                            Foto #{idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload Dropzone (visible if < 5 photos) */}
                  {formImages.length < 5 ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink-200 p-4 sm:p-5 text-center transition-colors hover:border-signal hover:bg-ink-50/50 min-h-[96px]",
                        uploadingImage && "pointer-events-none opacity-60"
                      )}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      {uploadingImage ? (
                        <div className="flex flex-col items-center gap-1.5 py-1">
                          <Loader2 className="h-6 w-6 animate-spin text-signal" />
                          <p className="text-2xs font-semibold text-ink-600">
                            Mengunggah foto produk ke penyimpanan...
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="grid h-9 w-9 place-items-center rounded-lg bg-ink-100 text-ink-600">
                            <Upload className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-ink">
                              Pilih Foto dari Perangkat ({formImages.length}/5)
                            </p>
                            <p className="text-2xs text-ink-500">
                              Bisa pilih beberapa sekaligus. JPG, PNG, atau WebP (Maks. 5 MB/foto)
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-2.5 text-center">
                      <p className="text-2xs font-semibold text-ink-600">
                        Batas maksimal 5 foto tercapai. Hapus salah satu foto jika ingin mengganti.
                      </p>
                    </div>
                  )}

                  {uploadError && (
                    <p className="text-2xs font-medium text-danger">{uploadError}</p>
                  )}

                  {/* Option for manual image URL */}
                  {formImages.length < 5 && (
                    <div className="pt-0.5">
                      {!showUrlInput ? (
                        <button
                          type="button"
                          onClick={() => setShowUrlInput(true)}
                          className="text-2xs text-ink-500 hover:text-ink underline"
                        >
                          atau tambah via tautan URL gambar
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="text"
                            placeholder="https://... URL gambar"
                            value={manualUrl}
                            onChange={(e) => setManualUrl(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddManualUrl();
                              }
                            }}
                            className="flex-1 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-400 focus:border-signal focus:outline-none"
                          />
                          <Button
                            variant="secondary"
                            size="sm"
                            type="button"
                            onClick={handleAddManualUrl}
                            disabled={!manualUrl.trim()}
                          >
                            Tambah
                          </Button>
                          <button
                            type="button"
                            onClick={() => setShowUrlInput(false)}
                            className="text-2xs text-ink-400 hover:text-ink"
                          >
                            Tutup
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-ink-600">
                    Deskripsi & Bahan (Dibaca AI)
                  </label>
                  <span className="text-[10px] text-ink-400">Dipakai AI saat membalas calon pembeli</span>
                </div>
                <textarea
                  rows={3}
                  placeholder="Bahan sutra premium adem, jahitan rapi, wudhu friendly..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full rounded-lg border border-ink-200 bg-white p-2.5 text-xs text-ink placeholder:text-ink-400 focus:border-signal focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 sm:gap-2.5 pt-3 border-t border-ink-100">
              <Button variant="ghost" onClick={() => setShowAddModal(false)} className="w-full sm:w-auto min-h-[42px]">
                Batal
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                loading={formBusy}
                disabled={!formName.trim() || !formSku.trim() || !formPrice.trim()}
                className="w-full sm:w-auto min-h-[42px]"
              >
                Simpan ke Katalog
              </Button>
            </div>
          </div>
        </Modal>

      {/* Modal Import CSV */}
      <Modal open={showCsvModal} onClose={() => setShowCsvModal(false)}>
        <div
          className="w-full max-w-lg rounded-2xl border border-ink-200 bg-white p-4 sm:p-6 shadow-overlay space-y-4 max-h-[92vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
            <div className="flex items-start justify-between border-b border-ink-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-ink">Impor Produk Massal via CSV</h3>
                <p className="text-2xs text-ink-500 mt-0.5">
                  Salin dan tempel data baris produk toko Anda.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center -mr-1"
                aria-label="Tutup modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 pr-0.5 sm:pr-1">
              <p className="text-xs text-ink-600 leading-relaxed">
                Tempel data CSV produk toko Anda di bawah ini. Kolom wajib: <code>SKU</code>, <code>Nama Produk</code>, dan <code>Harga</code>.
              </p>

              <textarea
                rows={6}
                placeholder={`SKU,Nama Produk,Kategori,Harga,Stok\nGMS-01,Gamis Silk Emerald,Fashion,185000,15\nGMS-02,Gamis Velvet Black,Fashion,210000,8`}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full rounded-lg border border-ink-200 bg-white p-3 font-mono text-xs text-ink placeholder:text-ink-400 focus:border-signal focus:outline-none"
              />

              {csvMsg && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 font-medium">
                  {csvMsg}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 sm:gap-2.5 pt-2 border-t border-ink-100">
              <Button variant="ghost" onClick={() => setShowCsvModal(false)} className="w-full sm:w-auto min-h-[42px]">
                Tutup
              </Button>
              <Button
                variant="primary"
                onClick={handleImportCsv}
                loading={csvBusy}
                disabled={!csvText.trim()}
                className="w-full sm:w-auto min-h-[42px]"
              >
                Mulai Impor
              </Button>
            </div>
          </div>
        </Modal>
    </div>
  );
}
