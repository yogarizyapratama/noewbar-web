"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Palette,
  Plus,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  Video,
  Wand2,
} from "lucide-react";
import { Button, cn } from "@/components/ui";
import type { WebsiteSection } from "@/lib/website/types";

interface WebsiteInspectorProps {
  section: WebsiteSection;
  onUpdateContent: (content: Record<string, any>) => void;
  onUpdateStyle: (style: Record<string, any>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
  isFirst: boolean;
  isLast: boolean;
  onRunAi: (prompt: string) => Promise<void>;
  aiBusy: boolean;
  aiMsg: string | null;
  aiError?: string | null;
}

const BG_PRESETS = [
  { label: "Putih", value: "#FFFFFF" },
  { label: "Slate", value: "#F8FAFC" },
  { label: "Emerald Soft", value: "#F0FDF4" },
  { label: "Emerald Dark", value: "#065F46" },
  { label: "Midnight", value: "#0F172A" },
  { label: "Amber", value: "#FFFBEB" },
  { label: "Rose", value: "#FFF1F2" },
];

const TEXT_PRESETS = [
  { label: "Gelap", value: "#0F172A" },
  { label: "Slate", value: "#475569" },
  { label: "Putih", value: "#FFFFFF" },
  { label: "Mint", value: "#ECFDF5" },
];

const QUICK_AI_PROMPTS = [
  "Tulis ulang dengan gaya copywriting memikat dan menjual (Hypnotic Selling)",
  "Gunakan gaya bahasa ramah, santai, dan sapaan Kakak",
  "Tegaskan jaminan 100% original, BPOM, dan garansi resmi",
  "Buat kalimat penawaran darurat terbatas (Urgency & Scarcity)",
  "Ringkas kalimat menjadi lebih padat, profesional, dan to the point",
];

export function WebsiteInspector({
  section,
  onUpdateContent,
  onUpdateStyle,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onToggleVisibility,
  isFirst,
  isLast,
  onRunAi,
  aiBusy,
  aiMsg,
  aiError,
}: WebsiteInspectorProps) {
  const [activeTab, setActiveTab] = useState<"content" | "style" | "ai">("content");
  const [customAiPrompt, setCustomAiPrompt] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const content = section.content || {};
  const style = section.style || {};

  async function handleMediaUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    fieldKey: string,
    arrayIndex?: number
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadError(`Foto "${file.name}" melebihi batas maksimal 5 MB.`);
      return;
    }

    setUploadingMedia(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/products/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (data.ok && data.url) {
        if (typeof arrayIndex === "number") {
          const currentItems = Array.isArray(content.items) ? [...content.items] : [];
          if (currentItems[arrayIndex]) {
            currentItems[arrayIndex] = { ...currentItems[arrayIndex], [fieldKey]: data.url };
            onUpdateContent({ items: currentItems });
          }
        } else {
          onUpdateContent({ [fieldKey]: data.url });
        }
      } else {
        setUploadError(data.error || "Gagal mengunggah foto.");
      }
    } catch {
      setUploadError("Gagal mengunggah foto ke server penyimpanan.");
    } finally {
      setUploadingMedia(false);
      if (e.target) e.target.value = "";
    }
  }

  function handleTriggerAi(promptText: string) {
    if (!promptText.trim()) return;
    onRunAi(promptText.trim());
  }

  return (
    <div className="flex flex-col rounded-xl border border-ink-200 bg-white shadow-flat overflow-hidden">
      {/* Top Header Inspector */}
      <div className="border-b border-ink-100 bg-ink-50/70 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-signal-wash text-signal-strong font-bold text-xs uppercase">
            {section.type.slice(0, 2)}
          </div>
          <div>
            <h3 className="text-xs font-bold text-ink capitalize">
              {section.type.replace("_", " ")}
            </h3>
            <span className="text-[10px] font-mono text-ink-500">ID: {section.id}</span>
          </div>
        </div>

        {/* Section Quick Actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            title="Pindahkan ke atas"
            className="rounded p-1 text-ink-500 hover:bg-ink-200/60 hover:text-ink disabled:opacity-30"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            title="Pindahkan ke bawah"
            className="rounded p-1 text-ink-500 hover:bg-ink-200/60 hover:text-ink disabled:opacity-30"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            title="Duplikat section ini"
            className="rounded p-1 text-ink-500 hover:bg-ink-200/60 hover:text-ink"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggleVisibility}
            title={section.visibility ? "Sembunyikan section" : "Tampilkan section"}
            className="rounded p-1 text-ink-500 hover:bg-ink-200/60 hover:text-ink"
          >
            {section.visibility ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-danger" />}
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Hapus section"
            className="rounded p-1 text-danger hover:bg-danger-wash hover:text-danger-strong"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs Header (Konten, Tampilan, AI Co-Pilot) */}
      <div className="grid grid-cols-3 border-b border-ink-100 bg-white text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("content")}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2.5 transition-colors border-b-2",
            activeTab === "content"
              ? "border-signal text-signal-strong bg-signal-wash/10 font-bold"
              : "border-transparent text-ink-500 hover:text-ink"
          )}
        >
          <Sliders className="h-3.5 w-3.5" />
          Konten
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("style")}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2.5 transition-colors border-b-2",
            activeTab === "style"
              ? "border-signal text-signal-strong bg-signal-wash/10 font-bold"
              : "border-transparent text-ink-500 hover:text-ink"
          )}
        >
          <Palette className="h-3.5 w-3.5" />
          Tampilan
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ai")}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2.5 transition-colors border-b-2",
            activeTab === "ai"
              ? "border-signal text-signal-strong bg-signal-wash/10 font-bold"
              : "border-transparent text-ink-500 hover:text-ink"
          )}
        >
          <Wand2 className="h-3.5 w-3.5 text-signal-strong" />
          AI Co-Pilot
        </button>
      </div>

      {/* Tab Body */}
      <div className="p-3.5 space-y-3.5 max-h-[580px] overflow-y-auto text-xs">
        {uploadError && (
          <p className="rounded bg-danger-wash p-2 text-2xs font-semibold text-danger">
            {uploadError}
          </p>
        )}

        {/* ================= TAB 1: KONTEN MANUAL ================= */}
        {activeTab === "content" && (
          <div className="space-y-3">
            {/* HERO BANNER */}
            {section.type === "hero" && (
              <>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Badge Teks</label>
                  <input
                    type="text"
                    value={content.badge || ""}
                    onChange={(e) => onUpdateContent({ badge: e.target.value })}
                    placeholder="Misal: Formula BPOM & Halal"
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Headline Utama *</label>
                  <textarea
                    rows={2}
                    value={content.headline || ""}
                    onChange={(e) => onUpdateContent({ headline: e.target.value })}
                    placeholder="Tulis headline yang menarik perhatian pembeli"
                    className="w-full rounded-lg border border-ink-200 bg-white p-2 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Subheadline / Penjelas</label>
                  <textarea
                    rows={2}
                    value={content.subheadline || ""}
                    onChange={(e) => onUpdateContent({ subheadline: e.target.value })}
                    placeholder="Penjelasan produk singkat..."
                    className="w-full rounded-lg border border-ink-200 bg-white p-2 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Tombol Beli (WA)</label>
                    <input
                      type="text"
                      value={content.cta_primary_text || ""}
                      onChange={(e) => onUpdateContent({ cta_primary_text: e.target.value })}
                      placeholder="Pesan via WA"
                      className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Tombol Kedua</label>
                    <input
                      type="text"
                      value={content.cta_secondary_text || ""}
                      onChange={(e) => onUpdateContent({ cta_secondary_text: e.target.value })}
                      placeholder="Lihat Katalog"
                      className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                    />
                  </div>
                </div>

                {/* Media Image / Video */}
                <div className="border-t border-ink-100 pt-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-2xs font-bold uppercase text-ink-600">Foto Banner Hero</label>
                    <span className="text-[10px] text-ink-500">Maks. 5 MB</span>
                  </div>
                  {content.image_url && (
                    <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-ink-200 bg-ink-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={content.image_url} alt="Hero" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => onUpdateContent({ image_url: "" })}
                        className="absolute right-1.5 top-1.5 rounded bg-danger/90 p-1 text-white hover:bg-danger"
                        title="Hapus foto banner"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => handleMediaUpload(e, "image_url")}
                      className="hidden"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingMedia}
                      className="w-full justify-center"
                    >
                      {uploadingMedia ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin text-signal" />
                          Mengunggah...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-1.5 h-3.5 w-3.5" />
                          Pilih Foto dari Perangkat
                        </>
                      )}
                    </Button>
                  </div>
                  <div>
                    <input
                      type="text"
                      value={content.image_url || ""}
                      onChange={(e) => onUpdateContent({ image_url: e.target.value })}
                      placeholder="Atau tempel URL gambar (https://...)"
                      className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-2xs text-ink focus:border-signal focus:outline-none"
                    />
                  </div>
                </div>
              </>
            )}

            {/* VIDEO SHOWCASE */}
            {section.type === "video_showcase" && (
              <>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Badge</label>
                  <input
                    type="text"
                    value={content.badge || ""}
                    onChange={(e) => onUpdateContent({ badge: e.target.value })}
                    placeholder="Tonton Review Produk"
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Judul Video *</label>
                  <input
                    type="text"
                    value={content.title || ""}
                    onChange={(e) => onUpdateContent({ title: e.target.value })}
                    placeholder="Lihat Kualitas Produk Nyata"
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Deskripsi Singkat</label>
                  <textarea
                    rows={2}
                    value={content.description || ""}
                    onChange={(e) => onUpdateContent({ description: e.target.value })}
                    placeholder="Simak video demonstrasi unboxing produk..."
                    className="w-full rounded-lg border border-ink-200 bg-white p-2 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Tautan Video (YouTube / Vimeo / MP4) *</label>
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-ink-400 shrink-0" />
                    <input
                      type="text"
                      value={content.video_url || ""}
                      onChange={(e) => onUpdateContent({ video_url: e.target.value })}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-ink-500">
                    Mendukung tautan YouTube (youtube.com atau youtu.be), Vimeo, atau berkas .mp4 langsung.
                  </p>
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Teks Tombol Aksi</label>
                  <input
                    type="text"
                    value={content.button_text || ""}
                    onChange={(e) => onUpdateContent({ button_text: e.target.value })}
                    placeholder="Pesan Produk di Video Ini"
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
              </>
            )}

            {/* GALLERY MEDIA */}
            {section.type === "gallery_media" && (
              <>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Judul Galeri *</label>
                  <input
                    type="text"
                    value={content.title || ""}
                    onChange={(e) => onUpdateContent({ title: e.target.value })}
                    placeholder="Galeri Foto Produk"
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Subjudul</label>
                  <input
                    type="text"
                    value={content.subtitle || ""}
                    onChange={(e) => onUpdateContent({ subtitle: e.target.value })}
                    placeholder="Foto asli hasil pemakaian pelanggan"
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>

                <div className="border-t border-ink-100 pt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-2xs font-bold uppercase text-ink-600">
                      Foto Galeri ({(content.items || []).length}/6)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const items = Array.isArray(content.items) ? [...content.items] : [];
                        if (items.length >= 6) return;
                        items.push({
                          image_url: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=600&q=80",
                          caption: "Foto Baru",
                        });
                        onUpdateContent({ items });
                      }}
                      className="inline-flex items-center gap-1 text-2xs font-bold text-signal hover:underline"
                    >
                      <Plus className="h-3 w-3" />
                      Tambah Foto
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(content.items || []).map((it: any, idx: number) => (
                      <div key={idx} className="rounded-lg border border-ink-200 p-2 bg-ink-50/50 space-y-1.5">
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={it.image_url || "/placeholder-product.svg"}
                            alt="Thumb"
                            className="h-10 w-10 rounded object-cover border border-ink-200 bg-white shrink-0"
                          />
                          <input
                            type="text"
                            value={it.image_url || ""}
                            onChange={(e) => {
                              const copy = [...content.items];
                              copy[idx].image_url = e.target.value;
                              onUpdateContent({ items: copy });
                            }}
                            placeholder="URL Foto https://..."
                            className="flex-1 rounded border border-ink-200 bg-white px-2 py-1 text-2xs text-ink"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const copy = content.items.filter((_: any, i: number) => i !== idx);
                              onUpdateContent({ items: copy });
                            }}
                            className="p-1 text-danger hover:bg-danger-wash rounded"
                            title="Hapus foto ini"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={it.caption || ""}
                          onChange={(e) => {
                            const copy = [...content.items];
                            copy[idx].caption = e.target.value;
                            onUpdateContent({ items: copy });
                          }}
                          placeholder="Keterangan foto (opsional)..."
                          className="w-full rounded border border-ink-200 bg-white px-2 py-1 text-2xs text-ink"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* TEXT BANNER / ABOUT */}
            {section.type === "text_banner" && (
              <>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Badge</label>
                  <input
                    type="text"
                    value={content.badge || ""}
                    onChange={(e) => onUpdateContent({ badge: e.target.value })}
                    placeholder="Cerita Kami"
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Judul Cerita *</label>
                  <input
                    type="text"
                    value={content.title || ""}
                    onChange={(e) => onUpdateContent({ title: e.target.value })}
                    placeholder="Komitmen Kualitas Toko Kami"
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Paragraf Cerita *</label>
                  <textarea
                    rows={3}
                    value={content.paragraph || ""}
                    onChange={(e) => onUpdateContent({ paragraph: e.target.value })}
                    placeholder="Ceritakan sejarah dan visi toko Anda..."
                    className="w-full rounded-lg border border-ink-200 bg-white p-2 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Foto Toko / Pemilik</label>
                  {content.image_url && (
                    <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-ink-200 bg-ink-50 mb-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={content.image_url} alt="Cerita" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleMediaUpload(e, "image_url")}
                    className="hidden"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingMedia}
                    className="w-full justify-center mb-1.5"
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    Upload Foto dari Komputer
                  </Button>
                  <input
                    type="text"
                    value={content.image_url || ""}
                    onChange={(e) => onUpdateContent({ image_url: e.target.value })}
                    placeholder="Atau URL gambar https://..."
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-2xs text-ink"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Teks Tombol</label>
                  <input
                    type="text"
                    value={content.button_text || ""}
                    onChange={(e) => onUpdateContent({ button_text: e.target.value })}
                    placeholder="Hubungi Owner via WA"
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
              </>
            )}

            {/* COUNTDOWN PROMO */}
            {section.type === "countdown_promo" && (
              <>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Badge</label>
                  <input
                    type="text"
                    value={content.badge || ""}
                    onChange={(e) => onUpdateContent({ badge: e.target.value })}
                    placeholder="FLASH SALE TERBATAS"
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Judul Promo *</label>
                  <input
                    type="text"
                    value={content.title || ""}
                    onChange={(e) => onUpdateContent({ title: e.target.value })}
                    placeholder="Diskon Spesial Hingga 35% Hari Ini"
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Subjudul</label>
                  <input
                    type="text"
                    value={content.subtitle || ""}
                    onChange={(e) => onUpdateContent({ subtitle: e.target.value })}
                    placeholder="Stok terbatas hanya untuk pemesanan hari ini"
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Label Diskon</label>
                    <input
                      type="text"
                      value={content.discount_tag || ""}
                      onChange={(e) => onUpdateContent({ discount_tag: e.target.value })}
                      placeholder="HEMAT RP 50.000"
                      className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Sisa Jam</label>
                    <input
                      type="number"
                      value={content.countdown_hours || 12}
                      onChange={(e) => onUpdateContent({ countdown_hours: Number(e.target.value) })}
                      placeholder="12"
                      className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Teks Tombol Klaim</label>
                  <input
                    type="text"
                    value={content.button_text || ""}
                    onChange={(e) => onUpdateContent({ button_text: e.target.value })}
                    placeholder="Klaim Promo via WA"
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
              </>
            )}

            {/* BENEFITS */}
            {section.type === "benefits" && (
              <>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Judul Section *</label>
                  <input
                    type="text"
                    value={content.title || ""}
                    onChange={(e) => onUpdateContent({ title: e.target.value })}
                    placeholder="Keunggulan Layanan Kami"
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Subjudul</label>
                  <input
                    type="text"
                    value={content.subtitle || ""}
                    onChange={(e) => onUpdateContent({ subtitle: e.target.value })}
                    placeholder="Mengapa belanja di toko kami?"
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>

                <div className="border-t border-ink-100 pt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-2xs font-bold uppercase text-ink-600">
                      Daftar Keunggulan ({(content.items || []).length})
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const items = Array.isArray(content.items) ? [...content.items] : [];
                        items.push({ title: "Keunggulan Baru", desc: "Penjelasan keunggulan..." });
                        onUpdateContent({ items });
                      }}
                      className="inline-flex items-center gap-1 text-2xs font-bold text-signal hover:underline"
                    >
                      <Plus className="h-3 w-3" />
                      Tambah Item
                    </button>
                  </div>
                  {(content.items || []).map((it: any, idx: number) => (
                    <div key={idx} className="rounded-lg border border-ink-200 p-2.5 bg-ink-50/50 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-2xs font-bold text-ink-500">#{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const copy = content.items.filter((_: any, i: number) => i !== idx);
                            onUpdateContent({ items: copy });
                          }}
                          className="p-1 text-danger hover:bg-danger-wash rounded"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={it.title || ""}
                        onChange={(e) => {
                          const copy = [...content.items];
                          copy[idx].title = e.target.value;
                          onUpdateContent({ items: copy });
                        }}
                        placeholder="Judul keunggulan..."
                        className="w-full rounded border border-ink-200 bg-white px-2 py-1 text-xs font-semibold text-ink"
                      />
                      <textarea
                        rows={2}
                        value={it.desc || ""}
                        onChange={(e) => {
                          const copy = [...content.items];
                          copy[idx].desc = e.target.value;
                          onUpdateContent({ items: copy });
                        }}
                        placeholder="Deskripsi..."
                        className="w-full rounded border border-ink-200 bg-white p-1.5 text-2xs text-ink"
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* TESTIMONIALS */}
            {section.type === "testimonials" && (
              <>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Judul Section *</label>
                  <input
                    type="text"
                    value={content.title || ""}
                    onChange={(e) => onUpdateContent({ title: e.target.value })}
                    placeholder="Ulasan Pembeli Puas"
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
                <div className="border-t border-ink-100 pt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-2xs font-bold uppercase text-ink-600">
                      Daftar Ulasan ({(content.items || []).length})
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const items = Array.isArray(content.items) ? [...content.items] : [];
                        items.push({
                          name: "Pelanggan Baru",
                          role: "Pelanggan Terverifikasi",
                          text: "Kualitas barang sangat bagus dan pengiriman super cepat!",
                          rating: 5,
                        });
                        onUpdateContent({ items });
                      }}
                      className="inline-flex items-center gap-1 text-2xs font-bold text-signal hover:underline"
                    >
                      <Plus className="h-3 w-3" />
                      Tambah Testimoni
                    </button>
                  </div>
                  {(content.items || []).map((it: any, idx: number) => (
                    <div key={idx} className="rounded-lg border border-ink-200 p-2.5 bg-ink-50/50 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-2xs font-bold text-ink-500">#{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const copy = content.items.filter((_: any, i: number) => i !== idx);
                            onUpdateContent({ items: copy });
                          }}
                          className="p-1 text-danger hover:bg-danger-wash rounded"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="text"
                          value={it.name || ""}
                          onChange={(e) => {
                            const copy = [...content.items];
                            copy[idx].name = e.target.value;
                            onUpdateContent({ items: copy });
                          }}
                          placeholder="Nama pelanggan..."
                          className="rounded border border-ink-200 bg-white px-2 py-1 text-2xs font-semibold text-ink"
                        />
                        <input
                          type="text"
                          value={it.role || ""}
                          onChange={(e) => {
                            const copy = [...content.items];
                            copy[idx].role = e.target.value;
                            onUpdateContent({ items: copy });
                          }}
                          placeholder="Status / Kota..."
                          className="rounded border border-ink-200 bg-white px-2 py-1 text-2xs text-ink"
                        />
                      </div>
                      <textarea
                        rows={2}
                        value={it.text || ""}
                        onChange={(e) => {
                          const copy = [...content.items];
                          copy[idx].text = e.target.value;
                          onUpdateContent({ items: copy });
                        }}
                        placeholder="Isi testimoni..."
                        className="w-full rounded border border-ink-200 bg-white p-1.5 text-2xs text-ink"
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* FAQ */}
            {section.type === "faq" && (
              <>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Judul Section *</label>
                  <input
                    type="text"
                    value={content.title || ""}
                    onChange={(e) => onUpdateContent({ title: e.target.value })}
                    placeholder="Pertanyaan yang Sering Diajukan"
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
                <div className="border-t border-ink-100 pt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-2xs font-bold uppercase text-ink-600">
                      Daftar Tanya Jawab ({(content.items || []).length})
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const items = Array.isArray(content.items) ? [...content.items] : [];
                        items.push({
                          q: "Pertanyaan baru?",
                          a: "Jawaban penjelasan...",
                        });
                        onUpdateContent({ items });
                      }}
                      className="inline-flex items-center gap-1 text-2xs font-bold text-signal hover:underline"
                    >
                      <Plus className="h-3 w-3" />
                      Tambah FAQ
                    </button>
                  </div>
                  {(content.items || []).map((it: any, idx: number) => (
                    <div key={idx} className="rounded-lg border border-ink-200 p-2.5 bg-ink-50/50 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-2xs font-bold text-ink-500">#{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const copy = content.items.filter((_: any, i: number) => i !== idx);
                            onUpdateContent({ items: copy });
                          }}
                          className="p-1 text-danger hover:bg-danger-wash rounded"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={it.q || ""}
                        onChange={(e) => {
                          const copy = [...content.items];
                          copy[idx].q = e.target.value;
                          onUpdateContent({ items: copy });
                        }}
                        placeholder="Pertanyaan..."
                        className="w-full rounded border border-ink-200 bg-white px-2 py-1 text-2xs font-semibold text-ink"
                      />
                      <textarea
                        rows={2}
                        value={it.a || ""}
                        onChange={(e) => {
                          const copy = [...content.items];
                          copy[idx].a = e.target.value;
                          onUpdateContent({ items: copy });
                        }}
                        placeholder="Jawaban..."
                        className="w-full rounded border border-ink-200 bg-white p-1.5 text-2xs text-ink"
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* WHATSAPP CTA */}
            {section.type === "whatsapp_cta" && (
              <>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Judul Ajakan *</label>
                  <input
                    type="text"
                    value={content.title || ""}
                    onChange={(e) => onUpdateContent({ title: e.target.value })}
                    placeholder="Siap Memesan Hari Ini?"
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Subjudul Penjelas</label>
                  <textarea
                    rows={2}
                    value={content.subtitle || ""}
                    onChange={(e) => onUpdateContent({ subtitle: e.target.value })}
                    placeholder="Hubungi admin kami via WhatsApp..."
                    className="w-full rounded-lg border border-ink-200 bg-white p-2 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Teks Tombol WhatsApp</label>
                  <input
                    type="text"
                    value={content.button_text || ""}
                    onChange={(e) => onUpdateContent({ button_text: e.target.value })}
                    placeholder="Chat WhatsApp Toko"
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
              </>
            )}

            {/* PRODUCT GRID */}
            {section.type === "product_grid" && (
              <>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Judul Katalog *</label>
                  <input
                    type="text"
                    value={content.title || ""}
                    onChange={(e) => onUpdateContent({ title: e.target.value })}
                    placeholder="Katalog Produk Pilihan"
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Subjudul</label>
                  <input
                    type="text"
                    value={content.subtitle || ""}
                    onChange={(e) => onUpdateContent({ subtitle: e.target.value })}
                    placeholder="Pesan langsung dengan respon otomatis WhatsApp"
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Batas Jumlah Produk</label>
                  <input
                    type="number"
                    value={content.limit || 6}
                    onChange={(e) => onUpdateContent({ limit: Number(e.target.value) })}
                    placeholder="6"
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-2xs text-emerald-800">
                  Semua produk otomatis diambil langsung dari menu <strong>Katalog Produk</strong> Anda.
                </div>
              </>
            )}

            {/* ANNOUNCEMENT */}
            {section.type === "announcement" && (
              <div>
                <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Teks Pengumuman *</label>
                <textarea
                  rows={2}
                  value={content.text || ""}
                  onChange={(e) => onUpdateContent({ text: e.target.value })}
                  placeholder="Gratis Ongkir ke seluruh Indonesia!"
                  className="w-full rounded-lg border border-ink-200 bg-white p-2 text-xs text-ink focus:border-signal focus:outline-none"
                />
              </div>
            )}

            {/* FOOTER */}
            {section.type === "footer" && (
              <>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Nama Brand Toko *</label>
                  <input
                    type="text"
                    value={content.brand_name || ""}
                    onChange={(e) => onUpdateContent({ brand_name: e.target.value })}
                    placeholder="Nama Brand Anda"
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Tagline Singkat</label>
                  <input
                    type="text"
                    value={content.tagline || ""}
                    onChange={(e) => onUpdateContent({ tagline: e.target.value })}
                    placeholder="Kecantikan alami terpancar..."
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">Teks Hak Cipta</label>
                  <input
                    type="text"
                    value={content.copyright || ""}
                    onChange={(e) => onUpdateContent({ copyright: e.target.value })}
                    placeholder="Hak Cipta Dilindungi Undang-Undang."
                    className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-signal focus:outline-none"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* ================= TAB 2: TAMPILAN & GAYA (STYLE) ================= */}
        {activeTab === "style" && (
          <div className="space-y-3.5">
            {/* Background Color */}
            <div>
              <label className="block text-2xs font-bold uppercase text-ink-600 mb-1.5">
                Warna Latar Belakang (Background)
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {BG_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => onUpdateStyle({ bg_color: p.value })}
                    className={cn(
                      "flex items-center gap-1 rounded-md border px-2 py-1 text-2xs transition-all",
                      style.bg_color === p.value
                        ? "border-signal font-bold shadow-xs ring-1 ring-signal"
                        : "border-ink-200 text-ink-600 hover:border-ink-300"
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full border border-black/10 shadow-xs"
                      style={{ backgroundColor: p.value }}
                    />
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={style.bg_color || "#FFFFFF"}
                  onChange={(e) => onUpdateStyle({ bg_color: e.target.value })}
                  className="h-8 w-8 cursor-pointer rounded border border-ink-200 p-0.5"
                />
                <input
                  type="text"
                  value={style.bg_color || "#FFFFFF"}
                  onChange={(e) => onUpdateStyle({ bg_color: e.target.value })}
                  placeholder="#FFFFFF"
                  className="flex-1 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 font-mono text-xs text-ink"
                />
              </div>
            </div>

            {/* Text Color */}
            <div>
              <label className="block text-2xs font-bold uppercase text-ink-600 mb-1.5">
                Warna Teks
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {TEXT_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => onUpdateStyle({ text_color: p.value })}
                    className={cn(
                      "flex items-center gap-1 rounded-md border px-2 py-1 text-2xs transition-all",
                      style.text_color === p.value
                        ? "border-signal font-bold shadow-xs ring-1 ring-signal"
                        : "border-ink-200 text-ink-600 hover:border-ink-300"
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full border border-black/10 shadow-xs"
                      style={{ backgroundColor: p.value }}
                    />
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={style.text_color || "#0F172A"}
                  onChange={(e) => onUpdateStyle({ text_color: e.target.value })}
                  className="h-8 w-8 cursor-pointer rounded border border-ink-200 p-0.5"
                />
                <input
                  type="text"
                  value={style.text_color || "#0F172A"}
                  onChange={(e) => onUpdateStyle({ text_color: e.target.value })}
                  placeholder="#0F172A"
                  className="flex-1 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 font-mono text-xs text-ink"
                />
              </div>
            </div>

            {/* Padding Section */}
            <div>
              <label className="block text-2xs font-bold uppercase text-ink-600 mb-1.5">
                Kerapatan / Jarak Section (Padding)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "sm", label: "Ringkas (sm)" },
                  { id: "md", label: "Sedang (md)" },
                  { id: "lg", label: "Luas (lg)" },
                ].map((pad) => (
                  <button
                    key={pad.id}
                    type="button"
                    onClick={() => onUpdateStyle({ padding: pad.id })}
                    className={cn(
                      "rounded-lg border py-2 text-center text-xs font-semibold transition-all",
                      (style.padding || "md") === pad.id
                        ? "border-signal bg-signal-wash text-signal-strong shadow-xs font-bold"
                        : "border-ink-200 text-ink-600 hover:bg-ink-50"
                    )}
                  >
                    {pad.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: AI CO-PILOT ================= */}
        {activeTab === "ai" && (
          <div className="space-y-3">
            <div className="rounded-lg bg-signal-wash/30 border border-signal/20 p-2.5 text-xs">
              <p className="font-bold text-signal-strong flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Asisten Copywriting & Editor AI
              </p>
              <p className="mt-1 text-2xs text-ink-600 leading-relaxed">
                Ketik instruksi atau klik salah satu rekomendasi cepat di bawah untuk mengubah section ini secara cerdas.
              </p>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="space-y-1.5">
              <label className="block text-2xs font-bold uppercase text-ink-500">Rekomendasi Cepat</label>
              <div className="flex flex-col gap-1.5">
                {QUICK_AI_PROMPTS.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setCustomAiPrompt(q);
                      handleTriggerAi(q);
                    }}
                    disabled={aiBusy}
                    className="rounded-lg border border-ink-200 bg-white p-2 text-left text-2xs font-medium text-ink hover:border-signal hover:bg-signal-wash/20 transition-all disabled:opacity-50"
                  >
                    &ldquo;{q}&rdquo;
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Prompt Textarea */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-2xs font-bold uppercase text-ink-500">Instruksi Kustom Bebas</label>
              <textarea
                rows={3}
                value={customAiPrompt}
                onChange={(e) => setCustomAiPrompt(e.target.value)}
                placeholder="Contoh: Ubah agar fokus ke bonus gratis botol minum dan garansi uang kembali jika barang cacat..."
                className="w-full rounded-lg border border-ink-200 bg-white p-2 text-xs text-ink placeholder:text-ink-400 focus:border-signal focus:outline-none"
              />
            </div>

            {aiError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-2xs font-semibold text-red-700 flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-600" />
                <span className="leading-relaxed">{aiError}</span>
              </div>
            )}

            {aiMsg && !aiError && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-2xs font-semibold text-emerald-800 flex items-start gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-600" />
                <span>{aiMsg}</span>
              </div>
            )}

            <Button
              variant="primary"
              size="sm"
              type="button"
              onClick={() => handleTriggerAi(customAiPrompt)}
              loading={aiBusy}
              disabled={!customAiPrompt.trim()}
              className="w-full justify-center"
            >
              <Wand2 className="mr-1.5 h-3.5 w-3.5" />
              Terapkan Perubahan dengan AI
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
