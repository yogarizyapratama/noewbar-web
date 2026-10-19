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
import {
  getEmbedVideoUrl,
  getSectionTheme,
  getStorefrontPadding,
  sanitizeSafeUrl,
} from "@/lib/website/types";
import { cn } from "@/lib/utils";

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
          wa_instances: {
            where: { connection_status: "CONNECTED" },
            select: { phone_number: true },
            take: 1,
          },
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
  const formatWa = (phone?: string | null) => {
    if (!phone) return "";
    const digits = phone.replace(/[^0-9]/g, "");
    if (digits.startsWith("0")) return "62" + digits.slice(1);
    if (digits.startsWith("8")) return "62" + digits;
    return digits;
  };

  const connectedBotPhone = tenant.wa_instances?.[0]?.phone_number;
  const defaultWaNumber = formatWa(connectedBotPhone || tenant.owner_whatsapp || "");

  const makeWaLink = (msg: string, overrideNumber?: string | null) => {
    const targetNumber = overrideNumber && overrideNumber.trim() ? formatWa(overrideNumber) : defaultWaNumber;
    return `https://wa.me/${targetNumber}?text=${encodeURIComponent(msg)}`;
  };

  const waLink = (msg: string) => makeWaLink(msg);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased selection:bg-emerald-100 selection:text-emerald-900">
      {/* Dynamic Sections Renderer */}
      {Array.isArray(sections) &&
        sections.map((section: any) => {
          if (!section.visibility) return null;

          const theme = getSectionTheme(section.style);
          const padClass = getStorefrontPadding(section.style?.padding);

          // 1. ANNOUNCEMENT
          if (section.type === "announcement") {
            return (
              <div
                key={section.id}
                style={{
                  backgroundColor: theme.bg,
                  color: theme.text,
                }}
                className={cn(
                  "text-center font-semibold tracking-wide transition-all",
                  section.style?.padding === "sm"
                    ? "py-1.5 px-4 text-xs"
                    : section.style?.padding === "lg"
                    ? "py-3.5 px-6 text-sm"
                    : "py-2.5 px-4 text-xs"
                )}
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
                style={{ backgroundColor: theme.bg, color: theme.text }}
                className={cn("relative overflow-hidden border-b border-black/10 transition-colors", padClass)}
              >
                <div className="mx-auto max-w-5xl px-5 sm:px-8">
                  <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
                    <div>
                      {section.content?.badge && (
                        <div
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold mb-4 border",
                            theme.isDark
                              ? "bg-white/10 text-emerald-300 border-white/20"
                              : "bg-emerald-50 text-emerald-800 border-emerald-200"
                          )}
                        >
                          <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                          {section.content.badge}
                        </div>
                      )}
                      <h1
                        style={{ color: theme.text }}
                        className="text-3xl font-extrabold tracking-tight sm:text-5xl sm:leading-tight"
                      >
                        {section.content?.headline || website.name}
                      </h1>
                      <p
                        style={{ color: theme.mutedText }}
                        className="mt-4 text-base leading-relaxed sm:text-lg"
                      >
                        {section.content?.subheadline || website.description}
                      </p>

                      <div className="mt-8 flex flex-wrap gap-3">
                        <a
                          href={
                            sanitizeSafeUrl(section.content?.custom_url) ||
                            makeWaLink(
                              section.content?.custom_message?.trim() ||
                                `Halo ${tenant.business_name}, saya ingin memesan produk dari website resmi.`,
                              section.content?.custom_whatsapp
                            )
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                        >
                          <MessageCircle className="h-4 w-4" />
                          {section.content?.cta_primary_text || "Pesan via WhatsApp"}
                        </a>
                        <a
                          href="#katalog"
                          className={cn(
                            "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
                            theme.isDark
                              ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
                              : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                          )}
                        >
                          <ShoppingBag className="h-4 w-4" />
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
                          className="w-full rounded-2xl object-cover shadow-xl border border-black/10 max-h-[420px]"
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
                style={{ backgroundColor: theme.bg, color: theme.text }}
                className={cn("border-b border-black/10 transition-colors", padClass)}
              >
                <div className="mx-auto max-w-5xl px-5 sm:px-8">
                  <div className="text-center max-w-2xl mx-auto mb-12">
                    <h2
                      style={{ color: theme.text }}
                      className="text-2xl font-bold tracking-tight sm:text-3xl"
                    >
                      {section.content?.title || "Keunggulan Layanan"}
                    </h2>
                    {section.content?.subtitle && (
                      <p style={{ color: theme.mutedText }} className="mt-2 text-sm">
                        {section.content.subtitle}
                      </p>
                    )}
                  </div>

                  <div className="grid gap-6 sm:grid-cols-3">
                    {items.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}
                        className="rounded-xl border p-6 transition-all hover:shadow-md"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 font-bold mb-4">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <h3 style={{ color: theme.cardText }} className="text-base font-bold">
                          {item.title}
                        </h3>
                        <p style={{ color: theme.cardMuted }} className="mt-2 text-xs leading-relaxed">
                          {item.desc}
                        </p>
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
                style={{ backgroundColor: theme.bg, color: theme.text }}
                className={cn("border-b border-black/10 transition-colors", padClass)}
              >
                <div className="mx-auto max-w-5xl px-5 sm:px-8">
                  <div className="text-center max-w-2xl mx-auto mb-12">
                    <h2
                      style={{ color: theme.text }}
                      className="text-2xl font-bold tracking-tight sm:text-3xl"
                    >
                      {section.content?.title || "Katalog Produk Pilihan"}
                    </h2>
                    <p style={{ color: theme.mutedText }} className="mt-2 text-sm">
                      {section.content?.subtitle || "Pesan langsung dengan respon otomatis WhatsApp 24 jam"}
                    </p>
                  </div>

                  {products.length === 0 ? (
                    <div
                      style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}
                      className="rounded-xl border border-dashed p-12 text-center"
                    >
                      <Package className="mx-auto h-8 w-8 opacity-50 mb-2" />
                      <p style={{ color: theme.cardText }} className="text-sm font-semibold">
                        Produk Sedang Disiapkan
                      </p>
                      <p style={{ color: theme.cardMuted }} className="mt-1 text-xs">
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
                style={{ backgroundColor: theme.bg, color: theme.text }}
                className={cn("border-b border-black/10 transition-colors", padClass)}
              >
                <div className="mx-auto max-w-5xl px-5 sm:px-8">
                  <div className="text-center max-w-2xl mx-auto mb-10">
                    <h2
                      style={{ color: theme.text }}
                      className="text-2xl font-bold tracking-tight sm:text-3xl"
                    >
                      {section.content?.title || "Ulasan Pembeli"}
                    </h2>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    {items.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}
                        className="rounded-xl border p-6 transition-all shadow-xs"
                      >
                        <div className="flex items-center gap-1 text-amber-500 mb-3">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className="h-4 w-4 fill-amber-400" />
                          ))}
                        </div>
                        <p style={{ color: theme.cardMuted }} className="text-sm leading-relaxed italic">
                          &ldquo;{item.text}&rdquo;
                        </p>
                        <p style={{ color: theme.cardText }} className="mt-4 text-xs font-bold not-italic">
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
                style={{ backgroundColor: theme.bg, color: theme.text }}
                className={cn("border-b border-black/10 transition-colors", padClass)}
              >
                <div className="mx-auto max-w-3xl px-5 sm:px-8">
                  <div className="text-center mb-10">
                    <h2
                      style={{ color: theme.text }}
                      className="text-2xl font-bold tracking-tight sm:text-3xl"
                    >
                      {section.content?.title || "Pertanyaan yang Sering Diajukan"}
                    </h2>
                  </div>

                  <div className="space-y-3">
                    {items.map((item: any, idx: number) => (
                      <details
                        key={idx}
                        style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}
                        className="group rounded-xl border p-5 transition-colors"
                      >
                        <summary
                          style={{ color: theme.cardText }}
                          className="flex cursor-pointer items-center justify-between font-semibold text-sm list-none"
                        >
                          <span className="flex items-center gap-2">
                            <HelpCircle className="h-4 w-4 text-emerald-500" />
                            {item.q}
                          </span>
                          <ChevronDown className="h-4 w-4 opacity-50 transition-transform group-open:rotate-180" />
                        </summary>
                        <p
                          style={{ color: theme.cardMuted }}
                          className="mt-3 text-xs leading-relaxed border-t border-black/10 pt-3"
                        >
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
                  backgroundColor: theme.bg,
                  color: theme.text,
                }}
                className={cn("border-b border-black/10 transition-colors", padClass)}
              >
                <div className="mx-auto max-w-4xl px-5 text-center">
                  {section.content?.badge && (
                    <span
                      className={cn(
                        "inline-block rounded-md px-2.5 py-1 text-xs font-bold mb-3 border",
                        theme.isDark
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : "bg-emerald-50 text-emerald-800 border-emerald-200"
                      )}
                    >
                      {section.content.badge}
                    </span>
                  )}
                  <h2
                    style={{ color: theme.text }}
                    className="text-2xl font-extrabold sm:text-3xl max-w-2xl mx-auto"
                  >
                    {section.content?.title || "Video Produk"}
                  </h2>
                  {section.content?.description && (
                    <p
                      style={{ color: theme.mutedText }}
                      className="mt-3 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed"
                    >
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
                        href={
                          sanitizeSafeUrl(section.content?.custom_url) ||
                          makeWaLink(
                            section.content?.custom_message?.trim() ||
                              `Halo ${tenant.business_name}, saya tertarik dengan produk di video ${section.content?.title || ""}.`,
                            section.content?.custom_whatsapp
                          )
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
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
                style={{ backgroundColor: theme.bg, color: theme.text }}
                className={cn("border-b border-black/10 transition-colors", padClass)}
              >
                <div className="mx-auto max-w-5xl px-5 sm:px-8">
                  <div className="text-center max-w-2xl mx-auto mb-10">
                    <h2
                      style={{ color: theme.text }}
                      className="text-2xl font-bold tracking-tight sm:text-3xl"
                    >
                      {section.content?.title || "Galeri Foto"}
                    </h2>
                    {section.content?.subtitle && (
                      <p style={{ color: theme.mutedText }} className="mt-2 text-sm">
                        {section.content.subtitle}
                      </p>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                    {items.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}
                        className="group relative overflow-hidden rounded-xl border shadow-sm transition-all hover:shadow-md"
                      >
                        <div className="aspect-square w-full overflow-hidden bg-black/10">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.image_url || "/placeholder-product.svg"}
                            alt={item.caption || `Foto Galeri ${idx + 1}`}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                        {item.caption && (
                          <div
                            style={{ backgroundColor: theme.cardBg }}
                            className="p-3 text-center border-t border-black/10"
                          >
                            <p style={{ color: theme.cardText }} className="text-xs font-semibold">
                              {item.caption}
                            </p>
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
                style={{ backgroundColor: theme.bg, color: theme.text }}
                className={cn("border-b border-black/10 transition-colors", padClass)}
              >
                <div className="mx-auto max-w-5xl px-5 sm:px-8">
                  <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
                    <div>
                      {section.content?.badge && (
                        <span
                          className={cn(
                            "inline-block rounded-md px-2.5 py-1 text-xs font-semibold mb-3 border",
                            theme.isDark
                              ? "bg-white/10 text-white border-white/20"
                              : "bg-slate-100 text-slate-800 border-slate-200"
                          )}
                        >
                          {section.content.badge}
                        </span>
                      )}
                      <h2
                        style={{ color: theme.text }}
                        className="text-2xl font-bold tracking-tight sm:text-3xl"
                      >
                        {section.content?.title || "Tentang Brand Kami"}
                      </h2>
                      <p
                        style={{ color: theme.mutedText }}
                        className="mt-4 text-sm leading-relaxed sm:text-base"
                      >
                        {section.content?.paragraph || ""}
                      </p>

                      {Array.isArray(section.content?.bullet_points) && section.content.bullet_points.length > 0 && (
                        <ul className="mt-6 space-y-2.5 text-xs">
                          {section.content.bullet_points.map((pt: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2" style={{ color: theme.text }}>
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
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
                            className={cn(
                              "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
                              theme.isDark
                                ? "bg-white text-slate-900 hover:bg-slate-100"
                                : "bg-slate-900 text-white hover:bg-slate-800"
                            )}
                          >
                            <MessageCircle className="h-4 w-4" />
                            {section.content.button_text}
                          </a>
                        </div>
                      )}
                    </div>

                    {section.content?.image_url && (
                      <div className="overflow-hidden rounded-2xl border border-black/10 shadow-md">
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
                  backgroundColor: theme.bg,
                  color: theme.text,
                }}
                className={cn("border-b border-black/10 transition-colors", padClass)}
              >
                <div className="mx-auto max-w-4xl px-5 text-center">
                  {section.content?.badge && (
                    <span className="inline-block rounded-md bg-amber-400 text-slate-950 px-3 py-1 text-xs font-extrabold uppercase tracking-wider mb-3 border border-amber-500/30 shadow-xs">
                      {section.content.badge}
                    </span>
                  )}
                  <h2
                    style={{ color: theme.text }}
                    className="text-2xl font-extrabold sm:text-4xl tracking-tight"
                  >
                    {section.content?.title || "Promo Kilat Terbatas"}
                  </h2>
                  <p
                    style={{ color: theme.mutedText }}
                    className="mt-3 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed"
                  >
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
                      href={
                        sanitizeSafeUrl(section.content?.custom_url) ||
                        makeWaLink(
                          section.content?.custom_message?.trim() ||
                            `Halo ${tenant.business_name}, saya ingin klaim ${section.content?.title || "promo flash sale"} sekarang!`,
                          section.content?.custom_whatsapp
                        )
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-3 text-sm font-bold text-slate-950 shadow-xs hover:bg-amber-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
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
                  backgroundColor: theme.bg,
                  color: theme.text,
                }}
                className={cn("border-b border-black/10 transition-colors", padClass)}
              >
                <div className="mx-auto max-w-3xl px-5 text-center">
                  <h2
                    style={{ color: theme.text }}
                    className="text-3xl font-extrabold sm:text-4xl"
                  >
                    {section.content?.title || "Siap Memesan Hari Ini?"}
                  </h2>
                  <p
                    style={{ color: theme.mutedText }}
                    className="mt-4 text-sm sm:text-base leading-relaxed"
                  >
                    {section.content?.subtitle || "Hubungi admin kami untuk cek ketersediaan stok dan konfirmasi ongkir otomatis."}
                  </p>
                  <div className="mt-8">
                    <a
                      href={
                        sanitizeSafeUrl(section.content?.custom_url) ||
                        makeWaLink(
                          section.content?.custom_message?.trim() ||
                            `Halo ${tenant.business_name}, saya ingin tanya ketersediaan produk.`,
                          section.content?.custom_whatsapp
                        )
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-bold text-emerald-900 shadow-md hover:bg-emerald-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-600"
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
                  backgroundColor: theme.bg,
                  color: theme.text,
                }}
                className={cn("border-t border-black/10 transition-colors", padClass)}
              >
                <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                  <div>
                    <p style={{ color: theme.text }} className="font-bold">
                      {section.content?.brand_name || website.name}
                    </p>
                    <p style={{ color: theme.mutedText }} className="mt-0.5">
                      {section.content?.tagline || website.description}
                    </p>
                  </div>
                  <p style={{ color: theme.mutedText }}>
                    {section.content?.copyright || "Hak Cipta Dilindungi."} &bull; Powered by Noewbar CS Pro
                  </p>
                </div>
              </footer>
            );
          }

          return null;
        })}

      {/* Floating WhatsApp Quick Contact Button */}
      {defaultWaNumber && (
        <a
          href={waLink(`Halo ${tenant.business_name}, saya melihat katalog online resmi Anda dan ingin bertanya.`)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat WhatsApp Sekarang"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-3.5 text-white shadow-xl hover:bg-emerald-700 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 group min-h-[48px]"
        >
          <MessageCircle className="h-6 w-6 shrink-0" />
          <span className="font-semibold text-xs pr-1 hidden sm:inline-block">
            Chat WhatsApp
          </span>
        </a>
      )}
    </div>
  );
}
