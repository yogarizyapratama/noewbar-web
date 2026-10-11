import { notFound } from "next/navigation";
import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import {
  CheckCircle2,
  ChevronDown,
  HelpCircle,
  MessageCircle,
  Package,
  ShoppingBag,
  Sparkles,
  Star,
} from "lucide-react";
import { ProductCard } from "./product-card";
import { getEmbedVideoUrl } from "@/lib/website/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const website = await prisma.website.findUnique({
    where: { slug: params.slug },
  });

  if (!website || website.status !== "PUBLISHED") {
    return { title: "Toko Tidak Ditemukan - Noewbar" };
  }

  return {
    title: website.title || `${website.name} - Toko Online Resmi`,
    description: website.description || `Katalog dan layanan belanja resmi ${website.name}.`,
  };
}

export default async function PublicStorePage({
  params,
}: {
  params: { slug: string };
}) {
  const website = await prisma.website.findUnique({
    where: { slug: params.slug },
    include: {
      tenant: {
        include: {
          products: {
            where: { status: "ACTIVE" },
            orderBy: { created_at: "desc" },
            take: 12,
          },
        },
      },
    },
  });

  if (!website || website.status !== "PUBLISHED") {
    notFound();
  }

  const sections = (website.published_sections || website.sections) as any[];
  const tenant = website.tenant;
  const products = tenant.products;
  const waNumber = tenant.owner_whatsapp.replace(/[^0-9]/g, "");

  const waLink = (msg: string) =>
    `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased selection:bg-emerald-100 selection:text-emerald-900">
      {/* Dynamic Sections Renderer */}
      {Array.isArray(sections) &&
        sections.map((section: any) => {
          if (!section.visibility) return null;

          // 1. ANNOUNCEMENT
          if (section.type === "announcement") {
            return (
              <div
                key={section.id}
                style={{
                  backgroundColor: section.style?.bg_color || "#065F46",
                  color: section.style?.text_color || "#ECFDF5",
                }}
                className="py-2.5 px-4 text-center text-xs font-semibold tracking-wide"
              >
                {section.content?.text || "Selamat datang di toko resmi kami!"}
              </div>
            );
          }

          // 2. HERO
          if (section.type === "hero") {
            return (
              <header
                key={section.id}
                style={{ backgroundColor: section.style?.bg_color || "#F8FAFC" }}
                className="relative overflow-hidden border-b border-slate-100 py-16 sm:py-24"
              >
                <div className="mx-auto max-w-5xl px-5 sm:px-8">
                  <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
                    <div>
                      {section.content?.badge && (
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 px-3 py-1 text-xs font-semibold text-emerald-800 mb-4 border border-emerald-200">
                          <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                          {section.content.badge}
                        </div>
                      )}
                      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl sm:leading-tight">
                        {section.content?.headline || website.name}
                      </h1>
                      <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
                        {section.content?.subheadline || website.description}
                      </p>

                      <div className="mt-8 flex flex-wrap gap-3">
                        <a
                          href={waLink(`Halo ${tenant.business_name}, saya ingin memesan produk dari website resmi.`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                          <MessageCircle className="h-4 w-4" />
                          {section.content?.cta_primary_text || "Pesan via WhatsApp"}
                        </a>
                        <a
                          href="#katalog"
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-all"
                        >
                          <ShoppingBag className="h-4 w-4 text-slate-500" />
                          {section.content?.cta_secondary_text || "Lihat Katalog"}
                        </a>
                      </div>
                    </div>

                    {section.content?.image_url && (
                      <div className="relative mx-auto w-full max-w-md lg:max-w-none">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={section.content.image_url}
                          alt={section.content?.headline || "Product Showcase"}
                          className="w-full rounded-2xl object-cover shadow-xl border border-slate-200 max-h-[420px]"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </header>
            );
          }

          // 3. BENEFITS
          if (section.type === "benefits") {
            const items = section.content?.items || [];
            return (
              <section
                key={section.id}
                style={{ backgroundColor: section.style?.bg_color || "#FFFFFF" }}
                className="py-14 sm:py-20 border-b border-slate-100"
              >
                <div className="mx-auto max-w-5xl px-5 sm:px-8">
                  <div className="text-center max-w-2xl mx-auto mb-12">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                      {section.content?.title || "Keunggulan Layanan"}
                    </h2>
                    {section.content?.subtitle && (
                      <p className="mt-2 text-sm text-slate-500">{section.content.subtitle}</p>
                    )}
                  </div>

                  <div className="grid gap-6 sm:grid-cols-3">
                    {items.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 transition-all hover:bg-white hover:shadow-md hover:border-slate-300"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 font-bold mb-4">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                        <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          }

          // 4. PRODUCT GRID
          if (section.type === "product_grid") {
            return (
              <section
                id="katalog"
                key={section.id}
                style={{ backgroundColor: section.style?.bg_color || "#F8FAFC" }}
                className="py-16 sm:py-24 border-b border-slate-100"
              >
                <div className="mx-auto max-w-5xl px-5 sm:px-8">
                  <div className="text-center max-w-2xl mx-auto mb-12">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                      {section.content?.title || "Katalog Produk Pilihan"}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      {section.content?.subtitle || "Pesan langsung dengan respon otomatis WhatsApp 24 jam"}
                    </p>
                  </div>

                  {products.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
                      <Package className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                      <p className="text-sm font-semibold text-slate-700">Produk Sedang Disiapkan</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Hubungi admin WhatsApp kami untuk daftar produk lengkap.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {products.map((p) => (
                        <ProductCard key={p.id} product={p} waLink={waLink} />
                      ))}
                    </div>
                  )}
                </div>
              </section>
            );
          }

          // 5. TESTIMONIALS
          if (section.type === "testimonials") {
            const items = section.content?.items || [];
            return (
              <section
                key={section.id}
                style={{ backgroundColor: section.style?.bg_color || "#FFFFFF" }}
                className="py-16 sm:py-20 border-b border-slate-100"
              >
                <div className="mx-auto max-w-5xl px-5 sm:px-8">
                  <div className="text-center max-w-2xl mx-auto mb-10">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                      {section.content?.title || "Ulasan Pembeli"}
                    </h2>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    {items.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-6"
                      >
                        <div className="flex items-center gap-1 text-amber-500 mb-3">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className="h-4 w-4 fill-amber-400" />
                          ))}
                        </div>
                        <p className="text-sm leading-relaxed text-slate-700 italic">
                          &ldquo;{item.text}&rdquo;
                        </p>
                        <p className="mt-4 text-xs font-bold text-slate-900 not-italic">
                          - {item.name}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          }

          // 6. FAQ
          if (section.type === "faq") {
            const items = section.content?.items || [];
            return (
              <section
                key={section.id}
                style={{ backgroundColor: section.style?.bg_color || "#F8FAFC" }}
                className="py-16 sm:py-20 border-b border-slate-100"
              >
                <div className="mx-auto max-w-3xl px-5 sm:px-8">
                  <div className="text-center mb-10">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                      {section.content?.title || "Pertanyaan yang Sering Diajukan"}
                    </h2>
                  </div>

                  <div className="space-y-3">
                    {items.map((item: any, idx: number) => (
                      <details
                        key={idx}
                        className="group rounded-xl border border-slate-200 bg-white p-5 transition-colors"
                      >
                        <summary className="flex cursor-pointer items-center justify-between font-semibold text-slate-900 text-sm list-none">
                          <span className="flex items-center gap-2">
                            <HelpCircle className="h-4 w-4 text-emerald-600" />
                            {item.q}
                          </span>
                          <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
                        </summary>
                        <p className="mt-3 text-xs leading-relaxed text-slate-600 border-t border-slate-100 pt-3">
                          {item.a}
                        </p>
                      </details>
                    ))}
                  </div>
                </div>
              </section>
            );
          }

          // VIDEO SHOWCASE
          if (section.type === "video_showcase") {
            const vid = getEmbedVideoUrl(section.content?.video_url);
            return (
              <section
                key={section.id}
                style={{
                  backgroundColor: section.style?.bg_color || "#0F172A",
                  color: section.style?.text_color || "#FFFFFF",
                }}
                className="py-16 sm:py-24 border-b border-slate-800"
              >
                <div className="mx-auto max-w-4xl px-5 text-center">
                  {section.content?.badge && (
                    <span className="inline-block rounded-full bg-emerald-500/20 text-emerald-400 px-3 py-1 text-xs font-bold mb-3 border border-emerald-500/30">
                      {section.content.badge}
                    </span>
                  )}
                  <h2 className="text-2xl font-extrabold sm:text-3xl max-w-2xl mx-auto">
                    {section.content?.title || "Video Produk"}
                  </h2>
                  {section.content?.description && (
                    <p className="mt-3 text-xs sm:text-sm opacity-80 max-w-xl mx-auto leading-relaxed">
                      {section.content.description}
                    </p>
                  )}

                  <div className="mt-8 overflow-hidden rounded-2xl shadow-2xl border border-slate-700 bg-black aspect-video max-w-3xl mx-auto">
                    {vid.isEmbed && vid.url ? (
                      <iframe
                        src={vid.url}
                        title={section.content?.title || "Video Player"}
                        className="h-full w-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : vid.isMp4 && vid.url ? (
                      <video
                        src={vid.url}
                        controls
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center text-slate-400">
                        <p className="text-sm font-semibold">Video Siap Diputar</p>
                        <p className="mt-1 text-xs">Masukkan tautan YouTube atau berkas video pada editor.</p>
                      </div>
                    )}
                  </div>

                  {section.content?.button_text && (
                    <div className="mt-8">
                      <a
                        href={waLink(`Halo ${tenant.business_name}, saya tertarik dengan produk di video ${section.content?.title || ""}.`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-xs font-bold text-white shadow-lg hover:bg-emerald-700 transition-all"
                      >
                        <MessageCircle className="h-4 w-4" />
                        {section.content.button_text}
                      </a>
                    </div>
                  )}
                </div>
              </section>
            );
          }

          // GALLERY MEDIA
          if (section.type === "gallery_media") {
            const items = section.content?.items || [];
            return (
              <section
                key={section.id}
                style={{ backgroundColor: section.style?.bg_color || "#FFFFFF" }}
                className="py-16 sm:py-20 border-b border-slate-100"
              >
                <div className="mx-auto max-w-5xl px-5 sm:px-8">
                  <div className="text-center max-w-2xl mx-auto mb-10">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                      {section.content?.title || "Galeri Foto"}
                    </h2>
                    {section.content?.subtitle && (
                      <p className="mt-2 text-sm text-slate-500">{section.content.subtitle}</p>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                    {items.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm transition-all hover:shadow-md"
                      >
                        <div className="aspect-square w-full overflow-hidden bg-slate-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.image_url || "/placeholder-product.svg"}
                            alt={item.caption || `Foto Galeri ${idx + 1}`}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                        {item.caption && (
                          <div className="p-3 text-center bg-white border-t border-slate-100">
                            <p className="text-xs font-semibold text-slate-800">{item.caption}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          }

          // TEXT BANNER / ABOUT
          if (section.type === "text_banner") {
            return (
              <section
                key={section.id}
                style={{ backgroundColor: section.style?.bg_color || "#F8FAFC" }}
                className="py-16 sm:py-24 border-b border-slate-100"
              >
                <div className="mx-auto max-w-5xl px-5 sm:px-8">
                  <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
                    <div>
                      {section.content?.badge && (
                        <span className="inline-block rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 mb-3">
                          {section.content.badge}
                        </span>
                      )}
                      <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                        {section.content?.title || "Tentang Brand Kami"}
                      </h2>
                      <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
                        {section.content?.paragraph || ""}
                      </p>

                      {Array.isArray(section.content?.bullet_points) && section.content.bullet_points.length > 0 && (
                        <ul className="mt-6 space-y-2.5 text-xs text-slate-700">
                          {section.content.bullet_points.map((pt: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                              <span>{pt}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {section.content?.button_text && (
                        <div className="mt-8">
                          <a
                            href={waLink(`Halo ${tenant.business_name}, saya ingin tahu lebih banyak tentang toko Anda.`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-600 transition-all"
                          >
                            <MessageCircle className="h-4 w-4" />
                            {section.content.button_text}
                          </a>
                        </div>
                      )}
                    </div>

                    {section.content?.image_url && (
                      <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-md">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={section.content.image_url}
                          alt={section.content?.title || "Foto Cerita"}
                          className="h-full w-full object-cover max-h-[400px]"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </section>
            );
          }

          // COUNTDOWN PROMO
          if (section.type === "countdown_promo") {
            return (
              <section
                key={section.id}
                style={{
                  backgroundColor: section.style?.bg_color || "#065F46",
                  color: section.style?.text_color || "#FFFFFF",
                }}
                className="py-12 sm:py-16"
              >
                <div className="mx-auto max-w-4xl px-5 text-center">
                  {section.content?.badge && (
                    <span className="inline-block rounded-full bg-amber-400 text-slate-950 px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider mb-3 shadow-sm">
                      {section.content.badge}
                    </span>
                  )}
                  <h2 className="text-2xl font-extrabold sm:text-4xl tracking-tight">
                    {section.content?.title || "Promo Kilat Terbatas"}
                  </h2>
                  <p className="mt-3 text-xs sm:text-sm opacity-90 max-w-lg mx-auto leading-relaxed">
                    {section.content?.subtitle || "Dapatkan harga promo terbaik sebelum penawaran berakhir."}
                  </p>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    {section.content?.discount_tag && (
                      <span className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 font-mono text-sm font-bold backdrop-blur-xs">
                        {section.content.discount_tag}
                      </span>
                    )}
                    <span className="rounded-xl bg-white px-5 py-2 font-mono text-sm font-extrabold text-slate-900 shadow-sm">
                      Sisa Waktu: {section.content?.countdown_hours || 12} Jam
                    </span>
                  </div>

                  <div className="mt-8">
                    <a
                      href={waLink(`Halo ${tenant.business_name}, saya ingin klaim ${section.content?.title || "promo flash sale"} sekarang!`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-7 py-3.5 text-xs font-bold text-slate-950 shadow-xl hover:bg-amber-300 transition-all hover:scale-105"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {section.content?.button_text || "Klaim Promo via WhatsApp"}
                    </a>
                  </div>
                </div>
              </section>
            );
          }

          // 7. WHATSAPP CTA
          if (section.type === "whatsapp_cta") {
            return (
              <section
                key={section.id}
                style={{
                  backgroundColor: section.style?.bg_color || "#065F46",
                  color: section.style?.text_color || "#FFFFFF",
                }}
                className="py-16 sm:py-24"
              >
                <div className="mx-auto max-w-3xl px-5 text-center">
                  <h2 className="text-3xl font-extrabold sm:text-4xl">
                    {section.content?.title || "Siap Memesan Hari Ini?"}
                  </h2>
                  <p className="mt-4 text-sm sm:text-base leading-relaxed opacity-90">
                    {section.content?.subtitle || "Hubungi admin kami untuk cek ketersediaan stok dan konfirmasi ongkir otomatis."}
                  </p>
                  <div className="mt-8">
                    <a
                      href={waLink(`Halo ${tenant.business_name}, saya ingin tanya ketersediaan produk.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-4 text-sm font-bold text-emerald-900 shadow-xl hover:bg-emerald-50 transition-all hover:scale-105"
                    >
                      <MessageCircle className="h-5 w-5 text-emerald-700" />
                      {section.content?.button_text || "Chat WhatsApp Toko"}
                    </a>
                  </div>
                </div>
              </section>
            );
          }

          // 8. FOOTER
          if (section.type === "footer") {
            return (
              <footer
                key={section.id}
                style={{
                  backgroundColor: section.style?.bg_color || "#0F172A",
                  color: section.style?.text_color || "#94A3B8",
                }}
                className="py-8 px-5 border-t border-slate-800"
              >
                <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                  <div>
                    <p className="font-bold text-white">{section.content?.brand_name || website.name}</p>
                    <p className="mt-0.5 text-slate-400">{section.content?.tagline || website.description}</p>
                  </div>
                  <p className="text-slate-500">
                    {section.content?.copyright || "Hak Cipta Dilindungi."} &bull; Powered by Noewbar CS Pro
                  </p>
                </div>
              </footer>
            );
          }

          return null;
        })}

      {/* Floating WhatsApp Quick Contact Button */}
      <a
        href={waLink(`Halo ${tenant.business_name}, saya melihat website resmi Anda dan ingin bertanya.`)}
        target="_blank"
        rel="noopener noreferrer"
        title="Chat WhatsApp Sekarang"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xl hover:bg-emerald-700 hover:scale-110 active:scale-95 transition-all"
      >
        <MessageCircle className="h-7 w-7" />
        <span className="sr-only">Chat WhatsApp</span>
      </a>
    </div>
  );
}
