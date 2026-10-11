import type { Metadata, Viewport } from "next";
import "./globals.css";

/**
 * Root layout.
 *
 * Fonts are system stacks (see tailwind.config.ts) rather than a webfont download:
 * the landing page must clear the "above the fold in under a second" bar of
 * chapter 10.A, and a render-blocking webfont is the usual reason that fails.
 */

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
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
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
