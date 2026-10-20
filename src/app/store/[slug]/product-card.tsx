"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    sku: string;
    category: string;
    price: number | string | { toString(): string };
    discount_price?: number | string | { toString(): string } | null;
    description?: string | null;
    images?: unknown;
  };
  waNumber?: string;
  waLink?: (text: string) => string;
}

export function ProductCard({ product, waNumber, waLink }: ProductCardProps) {
  const [activeIdx, setActiveIdx] = useState(0);

  const price = Number(product.price);
  const disc = product.discount_price ? Number(product.discount_price) : null;
  const rawImages = Array.isArray(product.images) ? (product.images as string[]) : [];
  const images = rawImages.filter(
    (img): img is string => typeof img === "string" && Boolean(img.trim())
  );

  const currentImg = images[activeIdx] || images[0] || "/placeholder-product.svg";

  return (
    <div className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-slate-300">
      <div>
        {/* Main Photo Container */}
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-100 mb-3 border border-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentImg}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/placeholder-product.svg";
            }}
          />
          {images.length > 1 && (
            <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white shadow backdrop-blur-xs">
              {activeIdx + 1} / {images.length} Foto
            </span>
          )}
        </div>

        {/* Thumbnail Selector Strip if Multiple Photos (up to 5) */}
        {images.length > 1 && (
          <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
            {images.map((img, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveIdx(idx)}
                className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-md border transition-all ${
                  activeIdx === idx
                    ? "border-emerald-600 ring-2 ring-emerald-500/30"
                    : "border-slate-200 opacity-70 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img}
                  alt={`Thumbnail ${idx + 1}`}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = "/placeholder-product.svg";
                  }}
                />
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="font-mono text-2xs font-semibold text-slate-400">
            {product.sku}
          </span>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-2xs font-semibold text-slate-600">
            {product.category}
          </span>
        </div>

        <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
          {product.name}
        </h3>

        {product.description && (
          <p className="mt-1 text-xs line-clamp-2 text-slate-500">
            {product.description}
          </p>
        )}

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-lg font-extrabold text-slate-900">
            Rp {(disc ?? price).toLocaleString("id-ID")}
          </span>
          {disc && (
            <span className="text-xs text-slate-400 line-through">
              Rp {price.toLocaleString("id-ID")}
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 pt-3 border-t border-slate-100">
        <a
          href={
            waLink
              ? waLink(
                  `Halo kak, saya mau pesan produk ${product.name} (SKU: ${product.sku}) seharga Rp ${(disc ?? price).toLocaleString("id-ID")}. Apakah masih ready?`
                )
              : waNumber
              ? `https://wa.me/${waNumber}?text=${encodeURIComponent(
                  `Halo kak, saya mau pesan produk ${product.name} (SKU: ${product.sku}) seharga Rp ${(disc ?? price).toLocaleString("id-ID")}. Apakah masih ready?`
                )}`
              : "#kontak-toko"
          }
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-600 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <MessageCircle className="h-4 w-4" />
          Pesan via WhatsApp
        </a>
      </div>
    </div>
  );
}
