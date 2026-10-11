# Panduan Pengembangan Noewbar CS Pro

Praktis dan sudah terverifikasi di mesin ini. Semua perintah diasumsikan dijalankan dari root repo:

```
cd "/Users/mac/Documents/YOGA/YOGA GOKS/noewbar"
```

---

## 1. Prasyarat

| Kebutuhan | Versi terverifikasi | Catatan |
|---|---|---|
| Node.js | **22.23.3** via nvm | `package.json` minta `>=20.9.0` (Next.js 14.2.35). Node 18 akan gagal. |
| PostgreSQL | 16.15 | `:5433`, user `mac`, trust auth di mesin ini |
| Redis | 7 | `:6379` untuk BullMQ |
| MinIO | S3-compatible | `:9000` API, `:9001` console |
| Whatsmeow daemon | Go, 896 LOC | `:8088`, binary `gateway-whatsmeow/whatsmeow-daemon` |
| 9router AI gateway | OpenAI-compatible | diakses via `AI_GATEWAY_URL` |

Aktifkan Node dengan benar **di setiap shell baru**:

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22.23.3
```

---

## 2. Setup Pertama Kali

```bash
npm install                 # menjalankan prisma generate via postinstall
cp .env.example .env        # lalu isi nilainya (lihat bagian 3)
npm run prisma:generate
npm run prisma:push         # no-op bila skema sudah sesuai (lihat bagian 6)
npm run build               # next build + copy:static
npm run start               # node .next/standalone/server.js
```

> ⚠️ **Gunakan `npm run start`, bukan `next start`.** Build dikonfigurasi `output: standalone`, dan `next start` memperingatkan *"does not work with output: standalone"* serta tidak menyajikan aset statis dengan benar. `npm run start` menjalankan `node .next/standalone/server.js`. `npm run start:next` disediakan hanya untuk debugging.

---

## 3. Variabel Lingkungan

`.env` **wajib** ada dan **tidak boleh** di-commit (sudah terdaftar di `.gitignore`).

Kunci yang dipakai (nilai rahasia tidak didokumentasikan di sini):

```
# Database
DATABASE_URL

# MinIO S3
MINIO_ENDPOINT  MINIO_PORT  MINIO_USE_SSL
MINIO_ACCESS_KEY  MINIO_SECRET_KEY  MINIO_BUCKET  MINIO_PUBLIC_URL

# 9router AI gateway
AI_GATEWAY_URL  AI_MODEL  AI_API_KEY  AI_FALLBACK_MODELS

# Whatsmeow daemon
WHATSMEOW_URL  WHATSMEOW_SECRET

# Telegram alert
TELEGRAM_BOT_TOKEN  TELEGRAM_ADMIN_CHAT_ID

# Midtrans
MIDTRANS_SERVER_KEY  MIDTRANS_CLIENT_KEY
MIDTRANS_IS_PRODUCTION  MIDTRANS_NOTIFICATION_URL

# Redis
REDIS_URL

# Auth
NEXTAUTH_SECRET  NEXTAUTH_URL

# App
NEXT_PUBLIC_APP_URL  NEXT_PUBLIC_APP_NAME  PORT
SUPERADMIN_EMAIL  SUPERADMIN_PASSWORD_HASH

# Playground
PLAYGROUND_SHEET_URL

# Opsional: provider ongkir publik (tanpa kunci)
COURIER_PUBLIC_API_URL
```

### Aturan kredensial (WAJIB)

1. **Jangan pernah** menaruh nilai rahasia sebagai default di `src/lib/env.ts`. Lihat temuan **S-1** di `AUDIT-REPORT.md`: default kredensial membuat guard fail-closed (`if (!env.WHATSMEOW_SECRET) return false`) tidak pernah aktif.
2. `WHATSMEOW_SECRET` dan `NEXTAUTH_SECRET` **wajib** diisi. Bila kosong, aplikasi harus menolak berjalan di produksi — bukan diam-diam memakai nilai default.
3. `SUPERADMIN_PASSWORD_HASH` harus berupa PHC Argon2id lengkap. Placeholder non-`$argon2` akan **selalu gagal login** (memang disengaja: gagal-tertutup).
   ```bash
   # generate hash (endpoint PUT /api/auth dengan sesi admin, atau helper kripto)
   npm run prisma:generate   # bila perlu
   ```
4. Rotasi kredensial = edit `.env` lalu **restart** proses app. Tidak ada hot-reload untuk env.

---

## 4. Perintah Sehari-hari

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | dev server `:3001` dengan hot reload |
| `npm run build` | build produksi + salin aset statis ke standalone |
| `npm run start` | jalankan build standalone |
| `npm run typecheck` | `tsc --noEmit` — **harus exit 0 sebelum commit** |
| `npm run lint` | eslint |
| `npm run gates` | **Gate Suite 63 pemeriksaan nyata** - lihat bagian 5 |
| `npm run smoke` | smoke test HTTP 21 pemeriksaan (app harus hidup) |
| `npm run scheduler` | proses scheduler: nudge + reservasi + reconcile tiap 60 s (lihat bagian 10) |
| `npm run sse:verify` | verifikasi kanal SSE tenant |
| `npm run artifacts:verify` | verifikasi artefak PDF/OCR |
| `npm run prisma:generate` | regenerate klien Prisma |
| `npm run prisma:push` | sinkronkan skema (harus no-op) |

---

## 5. Alur Verifikasi (5-Gate Protocol)

Sebelum menyatakan pekerjaan selesai, jalankan berurutan:

```bash
nvm use 22.23.3
npm run typecheck     # 1. tipe bersih
npm run build         # 2. build lolos
npm run start &       # 3. app harus hidup untuk smoke
npm run scheduler &   #    proses kedua: tanpa ini nudge/reservasi tidak jalan
npm run smoke         # 4. kontrak HTTP (21 pemeriksaan)
npm run gates         # 5. integrasi nyata (63 pemeriksaan)
```

**Gate Suite** (`scripts/gates.ts`) menyentuh dependensi asli dan membuat lalu membersihkan datanya sendiri:

| Gate | Cakupan |
|---|---|
| 1 | Konektivitas PostgreSQL, MinIO, 9router, Redis, daemon Whatsmeow |
| 2 | Parsing CSV Sheets, normalisasi Rupiah, cache ongkir, gratis ongkir |
| 3 | Tool-calling AI nyata, guard harga, tanpa degradasi |
| 4 | Upload MinIO, baca publik anonim, matriks ukuran, isolasi tenant, cleanup |
| 5 | Signature Midtrans SHA-512, idempotency, aritmetika grace period |
| 6 | Siklus order: reservasi, oversell, verifikasi hybrid, state machine, kripto |
| 7 | **Regresi temuan audit** — S-1, C-1, C-2, M-1/M-2, m-3, m-5 **+ jendela riwayat** (`AI_MAX_HISTORY_MESSAGES`) |

**Gate 7 itu jaring pengaman.** Ia memeriksa perilaku, bukan sekadar keberadaan kode: menjalankan `runMaintenanceSweep()` sungguhan, membuat conversation sungguhan, menulis 17 pesan lalu membuktikan hanya `window` pesan yang diputar ulang, mendaftarkan tenant tanpa data katalog, dan membuktikan PostgreSQL menolak `conversation_id` kosong. Bila Anda memperbaiki atau mengubah salah satu area itu, **tambahkan pemeriksaannya ke Gate 7** — jangan andalkan ingatan atau review manual.

**Membaca hasil Gate 3.** Gate ini pernah flaky (39/41 lalu 41/41 dengan input identik); penyebabnya bug C-1 yang kini sudah diperbaiki. Bila gagal lagi, baca `degradationReason`:

- `400 ... "This model only supports single tool-calls at once!"` -> flag `parallel_tool_calls: false` lepas dari body request (C-1 kambuh).
- Error jaringan/timeout -> infrastruktur.
- `Blocked unbacked price(s)` -> guard bekerja (sebenarnya perilaku benar).


---

## 6. Prisma & Skema (nol-drift)

Skema punya **10 tabel**, dengan `@@map` dan nama kolom yang dipin persis ke produksi.

**Aturan:**
1. **Hanya penambahan aditif.** Jangan mengubah nama/tipe kolom yang ada; jangan hapus.
2. Setelah mengubah `prisma/schema.prisma`: `npm run prisma:generate` lalu `npm run prisma:push`.
3. Repo ini **bukan git repository** (`git log` -> exit 128), jadi `git diff` tidak bisa dipakai untuk membuktikan nol-drift. Gunakan cara lain:
   ```bash
   npx prisma migrate diff \
     --from-schema-datasource prisma/schema.prisma \
     --to-schema-datamodel prisma/schema.prisma \
     --script
   ```
   Output kosong = tanpa drift.
4. Setelah mengubah skema, **selalu** jalankan `npm run gates` — Gate 1 memverifikasi jumlah tabel dan Gate 6 membuat order nyata.

---

## 7. Pitfall yang Sudah Ditemukan (jangan diulang)

### Build & runtime
- **`next start` salah.** Pakai `npm run start` (standalone). Kalau aset statis 404, jalankan `npm run copy:static`.
- **Node 18 gagal.** Next.js 14.2.35 butuh `>=20.9.0`. Pastikan `nvm use 22.23.3` di setiap shell.
- **Env dibaca saat import.** `src/lib/env.ts` memvalidasi zod saat modul dimuat. Mengubah `.env` butuh restart penuh; hot reload tidak cukup.
- **`scripts/gates.ts` memuat `.env` sendiri** (`loadEnv()`) sebelum mengimpor modul yang membaca `process.env`, jadi `npm run gates` bekerja tanpa ekspor manual.

### Database
- **`chat_messages.conversation_id` bertipe `@db.Uuid` + FK.** Menulis `""` gagal (`invalid length: expected length 32 for simple format, found 0`). Ini penyebab bug **m-3**: media dari pembeli yang belum punya conversation dibuang. Selalu upsert conversation dulu (`resolveConversationId` di `media/inbound.ts`).
- **Reservasi stok dihitung di SQL** (`reservedQtyForSku`, `jsonb_array_elements`). Bila mengubah struktur `orders.items`, ubah query ini juga.
- **`webhook_events.event_key` unique.** Duplikat memicu `P2002`; itu **jalur normal**, bukan error — ditangkap dan dilaporkan sebagai `DUPLICATE`.

### AI
- **Multi tool-call bisa membuat 400.** Temuan **C-1**: `TOOL_REQUEST_DEFAULTS` memaksa `parallel_tool_calls: false`. Setiap jalur AI baru **wajib** menyebarkannya ke body request (`...TOOL_REQUEST_DEFAULTS`), dan `isSingleToolCallError()` harus melewati model yang tetap menolak.
- **Jangan pakai `src/instrumentation.ts` untuk job terjadwal.** Sudah dicoba dan **gagal build**: Next menarik Prisma/ioredis/bullmq ke pass webpack Edge dan mati dengan `Module not found: Can't resolve 'crypto'` (+ `@node-rs/argon2-wasm32-wasi`), meski sudah di-dynamic import di dalam cabang `NEXT_RUNTIME !== "nodejs"`. Job terjadwal hidup di `src/lib/system/scheduler.ts` + `scripts/scheduler.ts`.
- **Scheduler adalah proses kedua.** `npm run start` **tidak** menjalankannya. Tanpa proses itu, worker BullMQ tidak pernah start dan nudge/reservasi tidak jalan (**M-1**/**M-2**). Cek dengan `ps aux | grep "[s]cripts/scheduler.ts"`.
- **Media harus dikirim inline sebagai data URL** untuk OCR. Gateway melakukan fetch sisi-server terhadap URL gambar, yang gagal untuk origin MinIO privat; `vision-ocr.ts` mengubah byte menjadi `data:<mime>;base64,...`.
- **Redaction tool** menyamarkan potongan kode yang mirip kredensial (`apiKey: ***`). Saat membaca `orchestrator.ts:28` / `gateway.ts:16`, itu *hasil redaksi lingkungan*, bukan kode rusak.

### Frontend / API
- **CORS bukan masalah di sini** karena UI disajikan oleh server yang sama; jangan tambahkan allowlist yang justru memutus fetch.
- **SSE mengirim event tanpa nama.** `realtime/route.ts` sengaja **tidak** menulis baris `event:` sehingga `EventSource.onmessage` menerima semuanya; tipe berada di dalam payload JSON. Jangan "perbaiki" dengan `event: chat` — itu akan memutus listener yang ada.
- **Playground tidak boleh menyentuh tenant nyata.** Temuan **m-5**: jangan pakai `business_name` tenant asli di halaman publik.

### Operasional
- **Scheduler bukan bagian dari `npm run start`.** Lihat bagian 10. Tanpa proses kedua, reservasi tidak kedaluwarsa, nudge tidak terkirim, langganan tidak direkonsiliasi.
- **Repo bukan git.** Jangan mengandalkan `git` untuk apa pun; verifikasi lewat filesystem dan gate.

---

## 8. Konvensi Kode

1. **Bahasa.** Komentar dan pesan error kode: Inggris. Teks yang dilihat pengguna/pembeli: Indonesia santai (kak, ya, 🙏). Dokumen: Indonesia.
2. **Tanpa dependensi auth eksternal.** Argon2id + HMAC-SHA256 sendiri di `crypto.ts`.
3. **Validasi zod di setiap route.** Gunakan `parseBody()` dari `http.ts` atau `safeParse` eksplisit.
4. **Respons API konsisten.** `ok({...})` / `fail(pesan, status, detail?)` dari `http.ts`.
5. **Isolasi tenant.** Setiap query order harus memuat `tenant_id: session.sub`. Ini bukan opsional.
6. **Jangan pakai `em dash` (—)** di UI. Lihat `DESIGN.md`.
7. **Guardrail AI ditegakkan di kode, bukan hanya prompt.** Setiap aturan "model tidak boleh" harus punya penegak deterministik (contoh: `findUnbackedPrices`).
8. **Tool baru** harus: ditambahkan ke `TOOL_NAMES`, ke `TOOL_SCHEMAS`, ke `switch` di `executeTool()`, dan ke `AGENT_SYSTEM_PROMPT` bila perlu dijelaskan ke model.

---

## 9. Menambah Tool AI Baru

1. Definisikan tipe hasil di `src/lib/ai/types.ts`.
2. Implementasi fungsi `toolXxx(ctx, args)` di `micro-tools.ts`.
3. Tambahkan entri skema ke `TOOL_SCHEMAS` (nama, deskripsi, parameter, `required`).
4. Tambahkan `case "tool_xxx"` ke `executeTool()` — kembalikan `{ tool, payload, toolPayload, summary, media, escalated }`.
5. Daftarkan nama di `TOOL_NAMES` (`types.ts`) — tanpa ini `isKnownTool()` menolaknya.
6. Tambahkan baris alur kerja di `AGENT_SYSTEM_PROMPT` (`prompts.ts`).
7. Tambahkan pemeriksaan ke `scripts/gates.ts`.

---

## 10. Job Terjadwal (scheduler)

Job terjadwal berjalan sebagai **proses Node terpisah**, berbagi satu modul job dengan endpoint `/api/maintenance` supaya keduanya tidak bisa berbeda perilaku.

**Arsitektur:**

| Berkas | Peran |
|---|---|
| `src/lib/system/scheduler.ts` | `runMaintenanceSweep()` — definisi job tunggal. Dipakai endpoint **dan** proses scheduler. |
| `scripts/scheduler.ts` | Proses long-lived: memuat `.env`, sweep pertama saat boot, lalu tiap 60 s, plus handler `SIGINT`/`SIGTERM`. |

```bash
npm run scheduler                                # dev
npm run scheduler > /tmp/scheduler.log 2>&1 &    # latar belakang
```

**Menambah job baru:** tulis fungsinya di `src/lib/system/scheduler.ts` di dalam `runMaintenanceSweep`, bungkus `isolate()` supaya kegagalannya tidak menghentikan job lain:

```ts
const myJob = await isolate(async () => {
  // job Anda
  return { processed: 0 };
});
```

Endpoint `/api/maintenance` langsung ikut memakai job itu tanpa perubahan tambahan.

> **Kenapa bukan `src/instrumentation.ts`?** Sudah dicoba dan **gagal build**: Next menarik Prisma/ioredis/bullmq ke pass webpack Edge sehingga muncul `Module not found: Can't resolve 'crypto'` (dan `@node-rs/argon2-wasm32-wasi`), walaupun import-nya dinamis di dalam cabang `NEXT_RUNTIME !== "nodejs"`. Guard runtime tidak menyelamatkan build karena Next menyelesaikan import lebih dulu. Proses terpisah menghindari webpack sepenuhnya.

**Alternatif tanpa proses kedua:** crontab memanggil endpoint yang sudah ada (perhatikan `reconcile` hanya berjalan untuk panggilan platform-wide):

```bash
* * * * * curl -s -X POST -H "x-noewbar-secret: $WHATSMEOW_SECRET" \
  http://127.0.0.1:3001/api/maintenance > /dev/null
```

Bila memakai cron eksternal, **jangan** jalankan `npm run scheduler` bersamaan. Scheduler adalah proses mandiri, jadi tidak ada dua sweeper selama Anda tidak menyalakannya dua kali.


---

## 11. Checklist Sebelum Commit

- [ ] `npm run typecheck` -> exit 0
- [ ] `npm run build` -> sukses
- [ ] `npm run smoke` -> 21/21 (app hidup)
- [ ] `npm run gates` -> semua PASS (atau kegagalan dijelaskan, bukan diabaikan)
- [ ] Tidak ada nilai rahasia baru yang di-hardcode
- [ ] Bila skema berubah: murni aditif + `prisma:push` + gate hijau
- [ ] Bila tool AI berubah: `TOOL_NAMES` + `TOOL_SCHEMAS` + `executeTool` + prompt semuanya sinkron
- [ ] Tidak ada `em dash` di UI
