# Dokumentasi Noewbar CS Pro

Indeks dokumentasi. Dibuat dari audit menyeluruh 10 Oktober 2026 dengan verifikasi eksekusi nyata (bukan pembacaan kode saja).

## Mulai dari sini

**Pengembang baru / agen AI:** baca berurutan
1. [`AI-CONTEXT.md`](AI-CONTEXT.md) — peta cepat, peringatan aktif, kosakata domain
2. [`ARCHITECTURE.md`](ARCHITECTURE.md) — bagaimana sistem benar-benar tersusun
3. [`AUDIT-REPORT.md`](AUDIT-REPORT.md) — bug yang diketahui + bukti pengujian
4. [`../AGENTS.md`](../AGENTS.md) — aturan kerja yang mengikat
5. [`DEVELOPMENT.md`](DEVELOPMENT.md) — setup, perintah, pitfall

## Isi

| Dokumen | Untuk siapa | Isi |
|---|---|---|
| [`AUDIT-REPORT.md`](AUDIT-REPORT.md) | Semua | Hasil audit: 2 Critical, 3 Major, 3 Minor + bukti gate dan smoke. Kesesuaian fitur terhadap dokumen spesifikasi per chapter. |
| [`FIX-REPORT.md`](FIX-REPORT.md) | Semua | Perbaikan untuk kedelapan temuan: diff sebelum/sesudah, bukti gate per temuan, catatan operator. |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Pengembang | Diagram sistem, 5 prinsip arsitektur, peta 12 modul, permukaan API, 10 tabel DB, alur kritis (teks / bukti transfer / billing). |
| [`DEVELOPMENT.md`](DEVELOPMENT.md) | Pengembang | Prasyarat, setup, daftar variabel env, perintah harian, alur verifikasi 5-Gate, aturan Prisma nol-drift, 20+ pitfall terbukti. |
| [`AI-CONTEXT.md`](AI-CONTEXT.md) | Agen AI | Tabel "ingin ubah X, buka file mana", peringatan aktif yang bisa menyesatkan, pola kode yang harus diikuti, urutan perbaikan. |
| [`../AGENTS.md`](../AGENTS.md) | Agen AI & kontributor | 11 aturan mutlak domain, definisi "selesai", standar kode, batas kewenangan, tugas berulang, format laporan. |
| [`../DESIGN.md`](../DESIGN.md) | Desainer/FE | Aturan Anti-Slop UI (sudah ada sebelumnya). |

## Status Singkat

- **Typecheck:** bersih (exit 0)
- **Gate Suite:** 63/63 PASS (Gate 7 = regresi temuan audit, Gate 8 = regresi UI)
- **Smoke test:** 21/21 PASS
- **Temuan audit:** 8 (2 Critical, 3 Major, 3 Minor) — **semua sudah diperbaiki dan diverifikasi**; lihat [`FIX-REPORT.md`](FIX-REPORT.md)

Perbaikan yang paling penting untuk dijaga: **S-1** (kredensial tanpa default), **C-1** (`parallel_tool_calls: false`), **C-2** (bukti transfer tersambung ke order). Ketiganya punya pemeriksaan regresi di Gate 7.

**Catatan operasional:** scheduler adalah proses terpisah (`npm run scheduler`) dan tidak ikut `npm run start`. Tanpa itu, nudge/reservasi/rekonsiliasi tidak berjalan.


## Sumber Acuan

- Spesifikasi produk resmi: `~/Downloads/NOEWBAR_AI_Dokumen_Final.md`
- Kontrak uji: `scripts/gates.ts` (integrasi), `scripts/smoke-test.mjs` (HTTP)
