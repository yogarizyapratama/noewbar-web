import type { Metadata } from "next";
import "./globals.css";

/**
 * Root layout.
 *
 * Fonts are system stacks (see tailwind.config.ts) rather than a webfont download:
 * the landing page must clear the "above the fold in under a second" bar of
 * chapter 10.A, and a render-blocking webfont is the usual reason that fails.
 */

export const metadata: Metadata = {
  title: "Noewbar CS Pro - Asisten WhatsApp untuk Toko Online",
  description:
    "Asisten WhatsApp yang menjaga toko online Anda tetap jualan saat Anda tidur. Balas chat dalam 2 detik, cek stok dari Google Sheets, hitung ongkir otomatis.",
  applicationName: "Noewbar CS Pro",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
