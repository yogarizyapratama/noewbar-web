import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Noewbar — Jasa Otomasi Bisnis & AI Terstandarisasi',
  description: 'Solusi otomasi alur operasional siap pakai untuk toko grosir, retail, kontraktor lelang LPSE, dan gudang. Sekali pasang, aktif dalam 24–48 jam bergaransi.',
  keywords: [
    'jasa otomasi bisnis',
    'bot whatsapp bisnis',
    'cek mutasi otomatis',
    'anti struk palsu',
    'lpse tender bot',
    'ocr nota excel',
    'sync stok marketplace',
  ],
  authors: [{ name: 'Noewbar Team' }],
  openGraph: {
    title: 'Noewbar — Jasa Otomasi Bisnis & AI Terstandarisasi',
    description: 'Solusi otomasi alur operasional siap pakai untuk toko grosir, retail, kontraktor tender, dan gudang.',
    url: 'https://seco.dpdns.org',
    siteName: 'Noewbar',
    locale: 'id_ID',
    type: 'website',
  },
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.ico',
    apple: '/icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#070A12',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="scroll-smooth">
      <body className="bg-[#070A12] text-slate-100 antialiased selection:bg-sky-600 selection:text-white min-h-screen flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
