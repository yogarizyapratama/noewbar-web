import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Noewbar — Jasa Otomasi Bisnis & AI Terstandarisasi',
  description: 'Solusi otomasi alur operasional siap pakai untuk toko grosir, kontraktor tender LPSE, dan administrasi gudang. Sekali pasang, aktif dalam 24 jam.',
  keywords: ['jasa otomasi bisnis', 'ai automation agency indonesia', 'lpse tender bot', 'cek mutasi otomatis', 'ocr nota excel'],
  authors: [{ name: 'Noewbar Team' }],
  openGraph: {
    title: 'Noewbar — Jasa Otomasi Bisnis & AI Terstandarisasi',
    description: 'Solusi otomasi alur operasional siap pakai untuk toko grosir, kontraktor tender, dan gudang.',
    url: 'https://seco.dpdns.org',
    siteName: 'Noewbar',
    locale: 'id_ID',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#090D16',
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
      <body className="bg-[#090D16] text-slate-100 antialiased selection:bg-amber-500 selection:text-slate-950 min-h-screen flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
