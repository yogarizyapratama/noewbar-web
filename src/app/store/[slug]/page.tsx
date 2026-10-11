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
                      {products.map((p) => {
                        const price = Number(p.price);
                        const disc = p.discount_price ? Number(p.discount_price) : null;
                        const images = Array.isArray(p.images) ? (p.images as string[]) : [];
                        const img = images[0] || null;

                        return (
                          <div
                            key={p.id}
                            className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-slate-300"
                          >
                            <div>
                              {img ? (
                                <div className="aspect-square w-full overflow-hidden rounded-lg bg-slate-100 mb-4 border border-slate-100">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={img}
                                    alt={p.name}
                                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                                  />
                                </div>
                              ) : (
                                <div className="aspect-square w-full rounded-lg bg-slate-50 mb-4 flex items-center justify-center border border-slate-100">
                                  <Package className="h-8 w-8 text-slate-300" />
                                </div>
                              )}

                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="font-mono text-2xs font-semibold text-slate-400">
                                  {p.sku}
                                </span>
                                <span className="rounded bg-slate-100 px-2 py-0.5 text-2xs font-semibold text-slate-600">
                                  {p.category}
                                </span>
                              </div>

                              <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                                {p.name}
                              </h3>

                              {p.description && (
                                <p className="mt-1 text-xs line-clamp-2 text-slate-500">
                                  {p.description}
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
                                href={waLink(
                                  `Halo kak, saya mau pesan produk ${p.name} (SKU: ${p.sku}) seharga Rp ${(disc ?? price).toLocaleString("id-ID")}. Apakah masih ready?`
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-600 transition-all"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                Pesan via WhatsApp
                              </a>
                            </div>
                          </div>
                        );
                      })}
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
