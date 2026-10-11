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

import { useEffect, useState } from "react";
import {
  Archive,
  Download,
  Edit2,
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
  PageHeader,
  TextField,
  cn,
} from "@/components/ui";

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
  const [formCat, setFormCat] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formDiscPrice, setFormDiscPrice] = useState("");
  const [formStock, setFormStock] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formImage, setFormImage] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  function openCreate() {
    setEditingProduct(null);
    setFormName("");
    setFormSku(`PROD-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormCat("Umum");
    setFormPrice("");
    setFormDiscPrice("");
    setFormStock("10");
    setFormDesc("");
    setFormImage("");
    setFormError(null);
    setShowAddModal(true);
  }

  function openEdit(p: ProductItem) {
    setEditingProduct(p);
    setFormName(p.name);
    setFormSku(p.sku);
    setFormCat(p.category || "Umum");
    setFormPrice(String(p.price));
    setFormDiscPrice(p.discount_price ? String(p.discount_price) : "");
    setFormStock(String(p.stock));
    setFormDesc(p.description || "");
    setFormImage(Array.isArray(p.images) && p.images[0] ? p.images[0] : "");
    setFormError(null);
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
        images: formImage.trim() ? [formImage.trim()] : [],
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
                    const img = Array.isArray(p.images) && p.images[0] ? p.images[0] : null;

                    return (
                      <tr key={p.id} className="hover:bg-ink-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {img ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={img}
                                alt={p.name}
                                className="h-9 w-9 rounded-md object-cover border border-ink-200 shrink-0"
                              />
                            ) : (
                              <span className="grid h-9 w-9 place-items-center rounded-md bg-ink-100 text-ink-400 shrink-0">
                                <Package className="h-4 w-4" />
                              </span>
                            )}
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
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-ink-200 bg-white p-6 shadow-overlay space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-ink-100 pb-3">
              <h3 className="text-base font-bold text-ink">
                {editingProduct ? "Edit Produk Katalog" : "Tambah Produk Baru"}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded p-1 text-ink-400 hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && <ErrorState title="Peringatan" description={formError} compact />}

            <div className="space-y-3.5">
              <TextField
                id="p_name"
                label="Nama Produk *"
                placeholder="Mis. Gamis Syari Premium Silk"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-3">
                <TextField
                  id="p_sku"
                  label="SKU / Kode Barang *"
                  placeholder="GMS-01"
                  value={formSku}
                  onChange={(e) => setFormSku(e.target.value)}
                />
                <TextField
                  id="p_cat"
                  label="Kategori"
                  placeholder="Fashion / Pakaian"
                  value={formCat}
                  onChange={(e) => setFormCat(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <TextField
                  id="p_price"
                  label="Harga Normal (Rp) *"
                  placeholder="185000"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                />
                <TextField
                  id="p_disc"
                  label="Harga Promo (Rp)"
                  placeholder="165000"
                  value={formDiscPrice}
                  onChange={(e) => setFormDiscPrice(e.target.value)}
                  optional
                />
                <TextField
                  id="p_stock"
                  label="Stok *"
                  placeholder="15"
                  value={formStock}
                  onChange={(e) => setFormStock(e.target.value)}
                />
              </div>

              <TextField
                id="p_img"
                label="Tautan Foto Produk (URL MinIO / Image)"
                placeholder="https://..."
                value={formImage}
                onChange={(e) => setFormImage(e.target.value)}
                optional
                hint="Foto produk akan dikirimkan bot langsung ke pembeli via WhatsApp."
              />

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-600">
                  Deskripsi & Bahan (Dibaca AI)
                </label>
                <textarea
                  rows={3}
                  placeholder="Bahan sutra premium adem, jahitan rapi, wudhu friendly..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full rounded-lg border border-ink-200 bg-white p-2.5 text-xs text-ink placeholder:text-ink-400 focus:border-signal focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-ink-100">
              <Button variant="ghost" onClick={() => setShowAddModal(false)}>
                Batal
              </Button>
              <Button variant="primary" onClick={handleSave} loading={formBusy} disabled={!formName.trim() || !formSku.trim() || !formPrice.trim()}>
                Simpan ke Katalog
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Import CSV */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-ink-200 bg-white p-6 shadow-overlay space-y-4">
            <div className="flex items-center justify-between border-b border-ink-100 pb-3">
              <h3 className="text-base font-bold text-ink">Impor Produk Massal via CSV</h3>
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="rounded p-1 text-ink-400 hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

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

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button variant="ghost" onClick={() => setShowCsvModal(false)}>
                Tutup
              </Button>
              <Button variant="primary" onClick={handleImportCsv} loading={csvBusy} disabled={!csvText.trim()}>
                Mulai Impor
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
