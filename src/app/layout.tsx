import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

/**
 * Root layout.
 *
 * Fonts are system stacks (see tailwind.config.ts) rather than a webfont download:
 * the landing page must clear the "above the fold in under a second" bar of
 * chapter 10.A, and a render-blocking webfont is the usual reason that fails.
 */

export const viewport: Viewport = {
  themeColor: "#0B0B0C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://noewbar.id"),
  title: "Noewbar CS Pro - Asisten WhatsApp untuk Toko Online",
  description:
    "Asisten WhatsApp yang menjaga toko online Anda tetap jualan saat Anda tidur. Balas chat dalam 2 detik, cek stok dari Google Sheets, hitung ongkir otomatis.",
  applicationName: "Noewbar CS Pro",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Noewbar CS Pro",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Noewbar CS Pro - Asisten WhatsApp untuk Toko Online",
    description:
      "Asisten WhatsApp yang menjaga toko online Anda tetap jualan saat Anda tidur. Balas chat dalam 2 detik, cek stok dari Google Sheets, hitung ongkir otomatis.",
    url: "/",
    siteName: "Noewbar CS Pro",
    locale: "id_ID",
    type: "website",
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "Noewbar CS Pro Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Noewbar CS Pro - Asisten WhatsApp untuk Toko Online",
    description:
      "Asisten WhatsApp yang menjaga toko online Anda tetap jualan saat Anda tidur. Balas chat dalam 2 detik, cek stok dari Google Sheets, hitung ongkir otomatis.",
    images: ["/icon-512.png"],
  },
  alternates: {
    canonical: "/",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Noewbar CS Pro",
    operatingSystem: "Cloud, Web, WhatsApp",
    applicationCategory: "BusinessApplication",
    offers: {
      "@type": "Offer",
      price: "199000",
      priceCurrency: "IDR",
      priceValidUntil: "2027-12-31",
      availability: "https://schema.org/InStock",
    },
    description:
      "Asisten AI WhatsApp multi-tenant untuk toko online dan UMKM di Indonesia dengan integrasi cek ongkir otomatis, manajemen stok Google Sheets, dan website builder.",
  };

  return (
    <html lang="id">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased min-h-screen">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
