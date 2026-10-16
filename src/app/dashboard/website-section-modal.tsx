"use client";

import { useState } from "react";
import {
  HelpCircle,
  Image as ImageIcon,
  Layers,
  Layout,
  MessageCircle,
  Package,
  Plus,
  Star,
  Tag,
  Video,
  X,
} from "lucide-react";
import {
  AVAILABLE_SECTION_TEMPLATES,
  type WebsiteSection,
} from "@/lib/website/types";
import { Modal, cn } from "@/components/ui";

interface WebsiteSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSection: (section: WebsiteSection) => void;
}

const CATEGORIES = [
  "Semua",
  "Header & Hero",
  "Media & Galeri",
  "Promosi & Penawaran",
  "Konten & Informasi",
  "Pemesanan & Kontak",
];

function getCategoryIcon(type: string) {
  switch (type) {
    case "hero":
      return <Layout className="h-5 w-5 text-signal" />;
    case "video_showcase":
      return <Video className="h-5 w-5 text-ink-700" />;
    case "gallery_media":
      return <ImageIcon className="h-5 w-5 text-ink-700" />;
    case "countdown_promo":
      return <Tag className="h-5 w-5 text-warn" />;
    case "product_grid":
      return <Package className="h-5 w-5 text-signal" />;
    case "testimonials":
      return <Star className="h-5 w-5 text-warn" />;
    case "faq":
      return <HelpCircle className="h-5 w-5 text-ink-700" />;
    case "whatsapp_cta":
      return <MessageCircle className="h-5 w-5 text-signal" />;
    default:
      return <Layers className="h-5 w-5 text-ink-500" />;
  }
}

export function WebsiteSectionModal({
  isOpen,
  onClose,
  onAddSection,
}: WebsiteSectionModalProps) {
  const [selectedCat, setSelectedCat] = useState("Semua");

  if (!isOpen) return null;

  const filtered = AVAILABLE_SECTION_TEMPLATES.filter((bp) => {
    if (selectedCat === "Semua") return true;
    return bp.category === selectedCat;
  });

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div
        className="flex h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-ink-200 bg-white shadow-overlay overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div>
            <h3 className="text-base font-extrabold text-ink flex items-center gap-2">
              <Plus className="h-5 w-5 text-signal" />
              Katalog Section & Widget Halaman
            </h3>
            <p className="text-xs text-ink-500 mt-0.5">
              Pilih block section siap pakai untuk disisipkan langsung ke landing page toko online Anda.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-2 border-b border-ink-100 bg-ink-50/60 px-6 py-2.5 overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCat(cat)}
              className={cn(
                "min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all",
                selectedCat === cat
                  ? "bg-white text-ink shadow-xs border border-ink-200 font-bold"
                  : "text-ink-600 hover:text-ink hover:bg-ink-100"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Blueprints Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((bp) => (
              <div
                key={bp.type}
                className="group flex flex-col justify-between rounded-xl border border-ink-200 bg-white p-4 shadow-flat transition-all hover:border-signal hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-ink-50 border border-ink-100 group-hover:scale-105 transition-transform">
                      {getCategoryIcon(bp.type)}
                    </div>
                    <span className="rounded bg-ink-100 px-2 py-0.5 text-[10px] font-bold text-ink-600">
                      {bp.category}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-ink group-hover:text-signal transition-colors">
                    {bp.title}
                  </h4>
                  <p className="mt-1 text-xs text-ink-500 leading-relaxed line-clamp-3">
                    {bp.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-ink-100">
                  <button
                    type="button"
                    onClick={() => {
                      onAddSection(bp.defaultSection());
                      onClose();
                    }}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg bg-ink py-2 text-xs font-bold text-white shadow-raised hover:bg-signal transition-all"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Sisipkan Section Ini
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
