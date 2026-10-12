# AGENTS.md — Aturan Agen untuk Repo Noewbar CS Pro

Aturan ini berlaku untuk **semua agen AI dan pengembang** yang bekerja di repo ini.
Baca `docs/AI-CONTEXT.md` lebih dulu; dokumen ini adalah aturan kerjanya.

---

## 0. Konteks Wajib Sebelum Bertindak

1. Root repo: `/Users/mac/Documents/YOGA/YOGA GOKS/noewbar`
2. **Repo ini BUKAN git repository.** `git log` -> exit 128. Jangan pakai `git diff`, `git stash`, atau alur berbasis git untuk memverifikasi perubahan. Verifikasi lewat filesystem + gate.
3. Aktifkan Node **setiap shell baru**:
   ```bash
   export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22.23.3
   ```
4. Urutan baca konteks:
   `docs/AI-CONTEXT.md` -> `docs/ARCHITECTURE.md` -> `docs/AUDIT-REPORT.md` -> `DESIGN.md`.

---

## 1. Aturan Mutlak Domain

Melanggar salah satu berarti merusak jaminan keamanan atau bisnis. Tidak ada pengecualian.

| # | Aturan |
|---|---|
| A1 | **AI tidak pernah bisa menetapkan `payment_status = VERIFIED`.** Hanya `verifyPayment()` dari sesi pemilik toko. `submitPaymentProof()` maksimal `PROOF_SUBMITTED`. |
| A2 | **OCR itu supportive-only.** Jangan pernah menyambungkan output OCR ke transisi state order. |
| A3 | **Order tidak bisa masuk `PROCESSING` sebelum pembayaran `VERIFIED`.** Ditegakkan `assertFulfilmentAllowed()`. |
| A4 | **Harga/stok/ongkir hanya dari tool.** Setiap jalur balasan baru wajib melewati `findUnbackedPrices()`. |
| A5 | **Zero-custody.** Tidak ada kode yang menampung dana atau menyatakan "uang sudah diterima". |
| A6 | **Isolasi tenant.** Setiap query order/percakapan wajib memfilter `tenant_id: session.sub`. |
| A7 | **Tidak ada data demo/dummy/hardcode di UI, kecuali katalog demo bawaan playground publik** (`api/playground`, `DEFAULT_PLAYGROUND_CATALOG`) yang memang untuk demo marketing dan tidak menyentuh tenant nyata. Di luar itu keadaan kosong harus jujur, bukan diisi contoh. |
| A8 | **Tidak ada kredensial sebagai default kode.** Hanya lewat `.env`. |
| A9 | **Skema Prisma hanya aditif.** Jangan ubah/hapus kolom tabel produksi (11 tabel). |
| A10 | **Tidak ada `em dash` (—) di UI.** Lihat `DESIGN.md`. |
| A11 | **Fail-closed, bukan fail-open.** Secret kosong = tolak akses, bukan izinkan. Input tak dikenal = tolak, bukan anggap valid. |
| A12 | **Basis Pengetahuan & Resi.** AI menjawab kebijakan toko hanya dari `knowledge_documents` / `tool_baca_panduan_toko`, dan resi dari `tool_cek_status_order`. |

---

## 2. Aturan Verifikasi (definisi "selesai")

Sebuah pekerjaan **belum selesai** sampai semuanya hijau dan dibuktikan output nyata:

```bash
npm run typecheck     # wajib exit 0
npm run build         # wajib sukses
npm run smoke         # 21/21 (app harus hidup)
npm run gates         # 63 pemeriksaan nyata
```

Bila memverifikasi perilaku scheduler, jalankan juga `npm run scheduler` (proses kedua, tidak ikut `npm run start`).

**Aturan bukti:**
- Jangan pernah mengklaim sesuatu "bekerja" tanpa output tool yang menunjukkan itu.
- Jangan pernah memfabrikasi output uji. Lebih baik melaporkan blocker dengan jujur.
- Saat menyajikan server untuk diuji, jalankan di latar belakang dan verifikasi kesiapan sebelum smoke test. Jangan pakai sleep buta.

**Saat `npm run gates` gagal, baca `degradationReason` sebelum menyimpulkan:**
- `400 ... "only supports single tool-calls at once"` pada **turn final composition** (bukan turn pertama) berarti history berisi turn `assistant` dengan **lebih dari satu** `tool_calls`. `parallel_tool_calls: false` hanya saran; upstream tetap bisa membatch, dan turn yang membatch lalu menolak **setiap** permintaan berikutnya. Jaring pengaman: `const requested = (msg.tool_calls ?? []).slice(0, 1)` di `orchestrator.ts`. Jalur AI baru yang menulis `tool_calls` sendiri wajib memotong ke satu. Bila muncul di turn **pertama**, berarti `TOOL_REQUEST_DEFAULTS` tidak tersebar (C-1).
- `Blocked unbacked price(s)` -> guard bekerja (perilaku benar).
- Error koneksi/timeout -> infrastruktur.

---

## 3. Alur Kerja

1. **Pahami sebelum mengubah.** Baca file yang relevan (lihat peta di `docs/AI-CONTEXT.md` bagian 3).
2. **Perubahan terkecil yang menyelesaikan masalah.** Jangan refactor di luar lingkup.
3. **Verifikasi menyeluruh** (bagian 2).
4. **Perbarui dokumen** bila arsitektur, kontrak, atau env berubah.
5. **Laporkan ringkas:** apa yang berubah, apa yang terbukti, apa yang tersisa. Jangan menarasikan ulang prosesnya.

**Jangan** menandai bug yang sudah diketahui di `docs/AUDIT-REPORT.md` sebagai "sudah diperbaiki" sampai gate membuktikannya.

---

## 4. Standar Kode

| Aspek | Aturan |
|---|---|
| Bahasa kode | Komentar & pesan error: Inggris |
| Bahasa pengguna | Teks ke pembeli: Indonesia santai (kak, ya, 🙏) |
| Bahasa dokumen | Indonesia |
| Validasi | zod di **setiap** route (via `parseBody()` atau `safeParse`) |
| Respons API | `ok({...})` / `fail(pesan, status, detail?)` dari `src/lib/http.ts` |
| Auth | Argon2id + HMAC-SHA256 sendiri. **Jangan** tambah dependensi auth eksternal. |
| Error yang bisa dijawab bot | Kembalikan hasil bertipe (`{ok:false, code}`), jangan throw |
| Penegakan aturan AI | Di kode (deterministik), bukan hanya di prompt |
| Idempotency | Lewat constraint unik + tangkap `P2002`, bukan baca-lalu-tulis |
| Markas standar | Pin `@@map` & nama kolom Prisma ke produksi |

---

## 5. Pitfall yang Sudah Terbukti (jangan ulangi)

Baca bagian 4 `docs/AI-CONTEXT.md` untuk detail. Semua temuan audit sudah diperbaiki (`docs/FIX-REPORT.md`), tetapi pola-pola di bawah ini paling mudah rusak kembali. Ringkas:

1. **`next start` salah.** Pakai `npm run start` (standalone). Aset 404 -> `npm run copy:static`.
2. **Node 18 gagal.** Butuh `>=20.9.0`, gunakan 22.23.3.
3. **Env dibaca saat import.** Ubah `.env` -> restart penuh, hot reload tidak cukup.
4. **`chat_messages.conversation_id` bertipe UUID + FK.** Menulis `""` gagal; upsert conversation dulu (**m-3**, sudah diperbaiki di `media/inbound.ts`).
5. **`event_key` unique.** `P2002` adalah jalur normal (duplikat), bukan error.
6. **Multi tool-call bisa 400.** Setiap jalur AI baru **wajib** menyebarkan `TOOL_REQUEST_DEFAULTS` (`parallel_tool_calls: false`) ke body request (**C-1**), **dan** history yang dibangun wajib dipotong ke satu `tool_calls` per turn `assistant`. Flag saja tidak cukup: satu turn yang membatch meracuni semua turn sesudahnya, termasuk turn final tanpa `tools`.
7. **Scheduler adalah proses terpisah.** `npm run start` tidak menjalankannya; tanpa `npm run scheduler`, worker BullMQ tidak start dan nudge/reservasi/rekonsiliasi tidak jalan (**M-1**, **M-2**). Cek: `ps aux | grep "[s]cripts/scheduler.ts"`.
8. **Jangan pakai `src/instrumentation.ts` untuk job terjadwal.** Sudah dicoba, **gagal build** (`Can't resolve 'crypto'` dari Prisma/ioredis/bullmq ke pass Edge).
9. **OCR butuh byte inline** sebagai data URL; gateway gagal fetch URL MinIO privat.
10. **SSE sengaja tanpa nama event.** Jangan tambahkan baris `event:`.
11. **Redaction tool** menyamarkan potongan mirip kredensial. Jangan "perbaiki" `***`.
12. **Playground tidak boleh menyentuh tenant nyata** (**m-5**).
13. **Jangan pakai flag BSD-incompatible** di macOS (mis. `cat -A`).
14. **Status WhatsApp wajib `IsLoggedIn()`, bukan `IsConnected()`.** Transport Whatsmeow nyambung ke WhatsApp **sebelum** pairing, jadi `IsConnected()` bernilai true meski `whatsmeow_device` masih 0 baris. Memakai `IsConnected()` membuat daemon melaporkan `CONNECTED` palsu. Pengecualian: titik shutdown tetap `IsConnected()` (memang soal transport).
15. **`AI_FALLBACK_MODELS` wajib ada di `.env`.** `combo-ai` bisa menjawab HTTP 200 dengan `finish_reason: "in_progress"` dan konten kosong. Tanpa rantai fallback (`combo-free`), seluruh bot menjadi bisu saat upstream itu kena. Field ini ada di `.env.example` tetapi mudah terlewat saat menyalin `.env`.
16. **`write_file` menolak menimpa file besar yang belum dibaca penuh** di context aktif. Workaround: `rm -f` lalu tulis, atau pakai `patch`.
17. **Chrome yang sedang jalan memegang write-lock profil** sehingga browser automation Hermes gagal start. Verifikasi UI lewat byte yang benar-benar dikirim server (HTML + CSS + chunk JS) alih-alih click-through, atau minta user menutup Chrome.

---

## 6. Batas Kewenangan

**Agen BOLEH tanpa bertanya:**
- Membaca file, menjalankan typecheck/build/gate, menjalankan query baca.
- Menambah/memperbarui dokumen di `docs/`.
- Memperbaiki bug yang sudah terdaftar di `docs/AUDIT-REPORT.md`.

**Agen HARUS bertanya lebih dulu:**
- Mengubah kredensial, secret, atau `.env`.
- Operasi destruktif pada database produksi.
- Mengubah/menghapus kolom Prisma yang ada (melanggar A9).
- Refactor besar di luar lingkup permintaan.
- Menambahkan dependensi baru.
- Mengubah kontrak tool AI atau nama tool (memutus percakapan berjalan).

**Agen DILARANG keras:**
- Menulis nilai rahasia ke dalam kode atau dokumen.
- Melemahkan guard fail-closed untuk "mempermudah testing".
- Memberi AI jalur apa pun menuju `VERIFIED`.
- Mengisi UI dengan data contoh/dummy.
- Mengklaim pekerjaan selesai tanpa menjalankan gate.

---

## 7. Tugas Berulang

### Menambah tool AI baru
1. Tipe hasil di `src/lib/ai/types.ts`
2. Implementasi `toolXxx()` di `micro-tools.ts`
3. Entri skema di `TOOL_SCHEMAS`
4. `case` di `executeTool()`
5. Daftarkan di `TOOL_NAMES` (**tanpa ini `isKnownTool()` menolaknya**)
6. Baris alur di `AGENT_SYSTEM_PROMPT`
7. Pemeriksaan di `scripts/gates.ts`

### Mengubah skema Prisma
1. Pastikan **murni aditif** (A9)
2. `npm run prisma:generate` -> `npm run prisma:push`
3. Buktikan nol-drift: `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` (output kosong)
4. `npm run gates`

### Menambah job terjadwal
Lihat `docs/DEVELOPMENT.md` bagian 10. Job terjadwal hidup di `src/lib/system/scheduler.ts` (dipakai bersama `POST /api/maintenance`) dan dijalankan proses terpisah `scripts/scheduler.ts` (`npm run scheduler`) tiap 60 s. **Jangan** pakai `src/instrumentation.ts` — gagal build. Alternatif: crontab memanggil `POST /api/maintenance`.

### Menyiapkan environment baru
1. `npm install`
2. `cp .env.example .env` dan isi
3. `npm run prisma:generate && npm run prisma:push`
4. `npm run build && npm run start`
5. `npm run gates`

---

## 8. Format Laporan

Ringkas dan faktual:

```
Berubah:  <file:baris> — <apa>
Terbukti: <perintah> -> <hasil nyata>
Sisa:     <yang belum dikerjakan / blocker>
```

Jangan mengulang proses langkah demi langkah. Jangan memakai kata pengisi. Klaim harus didukung output tool.

---

## 9. Referensi

| Dokumen | Isi |
|---|---|
| `docs/FIX-REPORT.md` | Perbaikan 8 temuan audit + bukti gate per temuan |
| `docs/AUDIT-REPORT.md` | 8 temuan bug + bukti eksekusi gate 63/63, 21/21 smoke |
| `docs/ARCHITECTURE.md` | Desain sistem, peta modul, alur kritis, 10 tabel |
| `docs/DEVELOPMENT.md` | Setup, env, perintah, pitfall, alur verifikasi |
| `docs/AI-CONTEXT.md` | Peta cepat untuk agen, peringatan aktif, kosakata domain |
| `DESIGN.md` | Aturan visual (Anti-Slop UI) |
| `~/Downloads/NOEWBAR_AI_Dokumen_Final.md` | Spesifikasi produk resmi (acuan) |
| `scripts/gates.ts` | Kontrak uji integrasi (63 pemeriksaan, Gate 7 = regresi temuan audit + jendela riwayat + katalog opsional saat daftar, Gate 8 = regresi UI) |
| `scripts/smoke-test.mjs` | Kontrak uji HTTP (21 pemeriksaan) |

---

## 10. Arsitektur UI (setelah refactor)

Sebelum refactor, tidak ada lapisan komponen sama sekali: tiga halaman monolitik
(landing 738, dashboard 1148, superadmin 639 baris) menulis ulang setiap kartu dan
tombol secara inline, `lucide-react` terpasang tetapi nol import (padahal diwajibkan
`DESIGN.md`), dan seluruh halaman memakai satu nilai padding `p-4` dengan `text-xs`.

| Berkas | Peran |
|---|---|
| `src/components/ui.tsx` | Satu-satunya pustaka dasar: Button, IconButton, Card, Badge, StatusDot, Stat, PageHeader, SectionHeading, EmptyState/LoadingState/ErrorState, Segmented, TextField, Kbd, Meter, NoResults, `rupiah`, `timeAgo`, `cn` |
| `src/components/app-shell.tsx` | Sidebar berikon + grouping + collapse (tersimpan di localStorage), topbar sticky, command palette Cmd+K |
| `src/app/dashboard/page.tsx` | Orkestrator tipis: satu baris `{tab === "x" && <PanelX ... />}` per tab, bukan lookup map |
| `src/app/dashboard/panel-*.tsx` | Satu panel per tab: status, whatsapp, katalog, pesanan, chat, billing |
| `src/app/superadmin/*` | `admin-login.tsx` + konsol operator |
| `tailwind.config.ts` | Token: rampa `ink-50..900`, radius 4/8/12/16, 3 elevasi, skala tipografi, `ambient`, keyframes |
| `src/app/globals.css` | Komponen bersama: `.btn-accent`, `.card`/`.card-flat`/`.card-overlay`, `.segmented`, `.skeleton` |

**Aturan yang mengikat setelah refactor:**

1. Kartu, tombol, badge, dan state kosong/loading/error **wajib** diambil dari
   `src/components/ui.tsx`. Menulis ulang inline adalah regresi yang dijaga Gate 8.
2. Panel baru ditambahkan sebagai berkas `panel-<nama>.tsx` dan didaftarkan sebagai
   satu baris kondisional di `dashboard/page.tsx`.
3. Setiap view yang membaca data hidup merender tiga state (R-27). State kosong
   harus jujur, tidak boleh diisi contoh.
4. `DESIGN.md` adalah kontrak visual yang mengikat: rampa `ink`, tiga elevasi, satu
   aksen `signal` yang hanya dipakai untuk state yang dikonfirmasi probe.
