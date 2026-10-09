# Noewbar — Productized AI Automation Service

Official company web and lead acquisition platform for **Noewbar**, a productized AI automation service engineered for practical Indonesian businesses, suppliers, contractors, and retail operations.

Live Production URL: [https://seco.dpdns.org](https://seco.dpdns.org)

---

## ⚡ Core Philosophy: Productized, Bukan Palugada

Noewbar menolak model agensi konvensional "palugada" (semua dikerjakan tanpa standarisasi). Kami menyederhanakan otomasi AI menjadi 3 paket layanan berdefinisi tegas, ber-SLA terukur, dan langsung menghasilkan dampak nyata:

1. **Noewbar Radar Tender**
   - **Target:** Kontraktor & Vendor Pengadaan Barang/Jasa Pemerintah.
   - **Solusi:** Monitoring ratusan portal LPSE / SPSE se-Indonesia secara otomatis. Ekstraksi dokumen KAK/RKS tebal menjadi ringkasan syarat kualifikasi (HPS, kualifikasi teknis, sertifikasi wajib) dikirim via notifikasi WhatsApp & Telegram harian.
   
2. **Noewbar Kasir Guard**
   - **Target:** Kafe, Restoran, Toko Grosir, & Retail yang menerima transfer bank manual (BCA / Mandiri / BRI / BNI).
   - **Solusi:** Proteksi struk palsu dan penipuan transfer perbankan. Kasir kirim foto bukti transfer / QRIS, AI mengecek keaslian tipografi struk dan mencocokkan mutasi rekening riil via webhook bank dalam hitungan 5 detik.

3. **Noewbar Nota Vision**
   - **Target:** Distributor, Toko Bangunan, Bengkel, Apotek, dan Toko Fisik dengan arsip nota kertas tulisan tangan.
   - **Solusi:** Foto nota kertas/surat jalan tulisan tangan langsung diubah menjadi tabel data terstruktur (SKU, Qty, Harga Satuan, Diskon, Total) dan sinkron otomatis ke spreadsheet Excel / Google Sheets / database ERP.

---

## 🛠️ Stack & Architecture

- **Frontend & Fullstack Framework:** Next.js 14 (App Router), TypeScript, Tailwind CSS.
- **Design Philosophy:** Antigravity **Anti-Slop** Standard (Dark palette bersahabat `#090D16`/`#111827`, amber `#F59E0B` contrast, no generic AI orb/gradient slop, tipografi fungsional, rasio kontras WCAG AA, mobile touch target >= 44px).
- **Database:** PostgreSQL 16 (`noewbar_db`) running on internal Docker instance (`postgres-server`).
- **Alert & Notification:** Telegram Bot API (`node-fetch` direct webhook dispatcher).
- **Reverse Proxy & Security:** Nginx on host proxying `seco.dpdns.org` to `127.0.0.1:3001` with Cloudflare Edge CDN & SSL termination.
- **Process Orchestration:** Linux `systemd` daemon (`noewbar-web.service`).

---

## 🚀 Development & Deployment

### 1. Environment Setup

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Isi variabel:
```env
DATABASE_URL="postgres://secoadmin:secopostgres123@127.0.0.1:5432/noewbar_db"
TELEGRAM_BOT_TOKEN="<bot_token>"
TELEGRAM_ADMIN_CHAT_ID="<chat_id>"
PORT=3001
```

### 2. Install Dependencies & Build

```bash
yarn install --ignore-engines
yarn build
```

### 3. Production Service

Jalankan via Systemd:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now noewbar-web
sudo systemctl status noewbar-web
```

---

## 🔒 Security & Data Privacy

- Kredensial database dan Telegram terisolasi pada environment file server lokal (`.env.local`).
- API `/api/leads` menerapkan validasi input, sanitasi string, dan penanganan koneksi pool PostgreSQL yang aman.
- Nginx menerapkan header keamanan (`X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`).

---

© 2026 Noewbar Automation. All rights reserved.
