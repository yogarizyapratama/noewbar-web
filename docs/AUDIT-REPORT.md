# Noewbar CS Pro — Audit Menyeluruh

**Tanggal:** 10 Oktober 2026
**Auditor:** Hermes Agent (audit berbasis eksekusi nyata, bukan pembacaan saja)
**Objek:** `/Users/mac/Documents/YOGA/YOGA GOKS/noewbar`
**Acuan spesifikasi:** `~/Downloads/NOEWBAR_AI_Dokumen_Final.md` (dokumen final, ±720 baris)
**Runtime:** Node `22.23.3` (nvm), Next.js `14.2.35`, PostgreSQL 16.15, Redis 7, MinIO S3, Whatsmeow daemon (Go 896 LOC), 9router AI gateway

> **STATUS: SEMUA 8 TEMUAN SUDAH DIPERBAIKI DAN DIVERIFIKASI.**
> Lihat [`docs/FIX-REPORT.md`](FIX-REPORT.md) untuk diff per temuan dan bukti gate.
> Gate suite kini **63/63 PASS, exit 0** (41 pemeriksaan asli + 16 regresi temuan audit di Gate 7 + 6 regresi UI di Gate 8).
> Bagian temuan di bawah dipertahankan sebagai catatan historis apa yang salah dan mengapa.

---

## 1. Ringkasan Eksekutif

Platform **berfungsi nyata** di semua jalur kritis: autentikasi, katalog Google Sheets, mesin ongkir, AI tool-calling, orkestrasi order, verifikasi pembayaran hybrid, billing Midtrans, storage MinIO, dan realtime SSE semuanya terhubung ke dependensi asli dan lulus uji.

Namun audit menemukan **5 bug fungsional** dan **3 kelemahan arsitektur** yang membuat sebagian fitur yang tertulis di dokumen **tidak benar-benar bekerja end-to-end**. Yang paling penting:

> **Rantai bukti transfer tidak tersambung.** Foto bukti transfer dari pembeli di-*ingest* dan di-OCR, tetapi **tidak pernah** memindahkan order ke `PROOF_SUBMITTED`. "Galeri Struk Pembeli" (chapter 10.B) karena itu praktis selalu kosong kecuali pemilik toko mem-POST manual dengan `order_id` yang ia harus tebak sendiri.

Status keseluruhan: **semua perbaikan wajib sudah diterapkan** (S-1, C-1, C-2, M-1, M-2) dan diverifikasi dengan gate. Tiga di antaranya tetap perlu diingat sebagai area yang paling mudah rusak kembali.

| Kategori | Jumlah |
|---|---|
| 🔴 Critical (fungsi inti tidak jalan E2E) | 2 |
| 🟠 Major (fitur dokumen tidak pernah aktif) | 3 |
| 🟡 Minor (kualitas kode / kebocoran informasi) | 3 |
| ✅ Terverifikasi bekerja nyata | 41/41 gate, 21/21 smoke, tsc bersih |

---

## 2. Metode & Bukti Eksekusi

Semua klaim di bawah berasal dari eksekusi nyata terhadap dependensi hidup, bukan asumsi.

| Perintah | Hasil | Bukti |
|---|---|---|
| `npx tsc --noEmit` | **exit 0** | tidak ada error tipe di 43 file TS/TSX |
| `node scripts/smoke-test.mjs` | **21/21 PASS** | HTTP nyata ke `:3001` |
| `npm run gates` (run #1) | **39/41 PASS, exit 1** | Gate 3 gagal (lihat C-1) |
| `npm run gates` (run #2) | **41/41 PASS, exit 0** | Gate 3 lulus — membuktikan nondeterminisme C-1 |
| `lsof -iTCP:3001` | `next-server 14.2.35` pid 63110 | build produksi hidup via `.next/standalone/server.js` |
| `lsof -iTCP:8088` | `whatsmeow-daemon` pid 51134 | daemon WhatsApp aktif, 0 sesi terhubung |
| Port scan | PG `:5433` (pid 58069), Redis `:6379` (pid 828) | dependensi pendukung hidup |
| `git log` | **exit 128** | repo **bukan** git repository |
| `find . -name "*.md"` | hanya `DESIGN.md` | **tidak ada `docs/`** sebelum audit ini |

**Gate Suite run #2 (lengkap, 41/41):**

```
GATE 1 - Pre-flight
  [PASS] PostgreSQL 16.15 | 10 tabel public (harus >= 10)
  [PASS] MinIO S3 reachable (HTTP 403 anon pada bucket = benar)
  [PASS] 9router gateway advertises combo-ai — 61 model, 396 ms
  [PASS] Redis reachable (PING PONG)
  [PASS] Whatsmeow daemon reachable — :8088 aktif
GATE 2 - Catalog + logistics
  [PASS] Sheet CSV canonical headers — kolom: sku,name,variant,price,stock,photo_url,video_url
  [PASS] Indonesian price/stock parsed — 185000 / 14 / 0
  [PASS] Sheet URL -> CSV export
  [PASS] Shipping deterministic — JNT 11000 | SICEPAT 11900 | JNE 12600 (estimasi)
  [PASS] Second call served from PostgreSQL cache
  [PASS] Honesty flag: semua tarif is_estimate=true saat provider kosong
  [PASS] Free shipping >= Rp 200.000 — tarif 0/0/0
GATE 3 - AI orchestration
  [PASS] Model calls tool_cari_produk instead of guessing — 2 tool, 42.557 ms
  [PASS] Request routed through combo-ai contract endpoint
  [PASS] Invented price detected and blocked — "Rp 999.000" ditolak, "Rp 185.000" lolos
  [PASS] Reply produced without degradation — 303 karakter
GATE 4 - MinIO
  [PASS] Upload / HeadObject / anonymous public read byte-exact
  [PASS] Max-size matrix — video 20MB ditolak, gif ditolak, webp diterima
  [PASS] Tenant isolation — tenants/<uuid>/products/GMS-01.jpg
  [PASS] Gate artifacts cleaned up — 0 sisa
GATE 5 - Midtrans billing
  [PASS] SHA-512 valid diterima; tampered ditolak; amount-bound replay ditolak
  [PASS] Settlement mengaktifkan langganan (+30 hari)
  [PASS] Grace period menghitung dari expires_at LAMA, bukan tanggal bayar
  [PASS] Duplicate webhook diserap (tidak memperpanjang dua kali)
  [PASS] Unsigned webhook ditolak sebelum menyentuh DB
GATE 6 - Order lifecycle
  [PASS] Order snapshot + 3-digit unique code
  [PASS] Reservasi stok 2 jam armed
  [PASS] Oversell diblokir (stok 1, terreservasi 1 -> sisa jual 0)
  [PASS] Proof upload hanya -> PROOF_SUBMITTED, verified_at null
  [PASS] Order TIDAK BISA masuk PROCESSING sebelum payment VERIFIED
  [PASS] Verifikasi owner -> VERIFIED + PROCESSING
  [PASS] Transisi ilegal & verifikasi ganda ditolak
  [PASS] Release reservasi idempoten
  [PASS] Argon2id round-trip, password salah ditolak
  [PASS] Token sesi valid; token diubah ditolak
  [PASS] Test tenant dibersihkan — database bersih
```

---

## 3. Inventaris Fitur vs Dokumen

| Chapter | Fitur dokumen | Status | Catatan |
|---|---|---|---|
| 2 | USP 1 — katalog Google Sheets tanpa OAuth | ✅ Ada & nyata | `catalog/sheets.ts`, alias header case-tolerant |
| 2 | USP 2 — Share Location -> kecamatan -> ongkir | ⚠️ Parsial | webhook menerima GPS & reverse-geocode, tapi **tidak ada** yang meneruskan kecamatan hasil geocode ke AI (lihat m-4) |
| 2 | USP 3 — anti-ghosting nudge | ⚠️ Parsial | dijadwalkan nyata, tetapi worker BullMQ **tidak pernah start** (M-2) |
| 2 | USP 4 — hybrid payment verification | ❌ **Putus** | OCR jalan, tapi tidak ada jembatan foto -> order (C-2) |
| 3 | topologi single-VPS | ✅ | sesuai |
| 4 | webhook inbound + guardrail | ✅ | kill-switch, tenant isolation, anti-abuse semua nyata |
| 5 | daemon Whatsmeow Go | ✅ | 896 LOC, `/health`, `/instances/*`, secret-gated |
| 6 | micro-tools nativ < 50 ms | ✅ | 5 tool, dispatch switch, trace tersimpan |
| 6 | model rotation via 9router | ⚠️ | kontrak OK, tapi multi-tool-call bikin 400 (C-1) |
| 7 | Midtrans Snap + webhook | ✅ | signature, idempotency, grace period terbukti |
| 8.A | matriks ukuran upload | ✅ | dibuktikan gate |
| 8.B | pipeline media inbound | ✅ | tersimpan untuk pembeli baru juga (m-3 diperbaiki: `resolveConversationId`) |
| 8.C.4 | OCR supportive-only | ✅ | tidak pernah auto-verify |
| 8.C.4 | step 6 alert owner saat bukti masuk | ✅ | berjalan otomatis dari webhook (C-2 diperbaiki; maks `PROOF_SUBMITTED`) |
| 10.A.5 | Playground publik | ✅ | bekerja tanpa membocorkan nama bisnis tenant nyata (m-5 diperbaiki) |
| 10.A.7 | billing checkout | ✅ | 3 mode jujur: unconfigured / snap / snap_failed |
| 10.B | Galeri Struk Pembeli | ✅ | terisi otomatis dari bukti inbound (C-2 diperbaiki, maks `PROOF_SUBMITTED`) |
| 11.4 | kill-switch global | ✅ | in-process, < 100 ms |
| 11.4 | anti-abuse 120 pesan / 3 menit | ✅ | freeze ke `PAIRING` |
| 12 | cron: nudge sweeper, expiry, reconcile | ✅ | M-1 diperbaiki: `npm run scheduler` (proses terpisah) + `POST /api/maintenance` berbagi `runMaintenanceSweep()` |
| 12 | degradasi Sheets -> cache | ✅ | TTL 5 menit, warning diteruskan ke prompt |
| 14.2 | Argon2id + HMAC cookie | ✅ | OWASP baseline m=19456 t=2 p=1 |
| 14.4 | grace period 3 hari | ✅ | aritmetika dari expiry lama terbukti |
| 15 | 5-Gate Protocol | ✅ | `scripts/gates.ts` 63 pemeriksaan nyata |
| 16 | idempotency webhook | ✅ | unique `event_key` P2002 |
| 16 | prompt injection fencing | ✅ | `fenceUntrusted()` + instruksi tolak |
| 16 | anti-halusinasi harga | ✅ | `findUnbackedPrices()` + jumlah sah ≤3 nilai |
| 17.B | gratis ongkir >= Rp 200.000 | ✅ | dibuktikan gate |

---

## 4. Temuan Bug (urut prioritas)

### 🔴 C-1 — Multi tool-call membuat 400 dari gateway

**File:** `src/lib/ai/orchestrator.ts:179-186`
**Severity:** Critical (balasan bot jatuh ke template maaf)

`orchestrator.ts` mengirim seluruh `TOOL_SCHEMAS` dengan `tool_choice: "auto"` dan **tidak** menetapkan `parallel_tool_calls`. Upstream yang menjawab (`combo-ai` dirotasi 9router ke `combo-free`) menolak request yang berisi >1 tool call dalam satu pesan:

```
AI gateway error: 400 [400]: {"errors":[{"message":"AiError: ... \"This model
only supports single tool-calls at once!\" ... code\":400}}],"success\":false}
```

**Bukti nondeterminisme:** run #1 gagal dengan error di atas (`degraded=true`, balasan 86 karakter = `SAFE_FALLBACK_REPLY`); run #2 dengan pertanyaan identik lulus 41/41 karena model kebetulan mengirim dua tool call di **round terpisah**, bukan satu pesan.

**Dampak:** setiap kali model memutuskan memanggil 2 tool sekaligus (kasus sangat umum: "cari produk **dan** cek ongkir"), pembeli menerima *"Mohon maaf Kak, untuk pertanyaan ini saya perlu bantu sambungkan ke admin toko kami dulu ya 🙏"* padahal sistem sehat. Ini yang membuat percakapan terasa putus-putus.

**Perbaikan:** tambahkan `parallel_tool_calls: false` pada pemanggilan chat completion (dan pada `chatWithFallback`).

---

### 🔴 C-2 — Rantai bukti transfer tidak tersambung ke order

**File:** `src/app/api/wa-webhook/route.ts:131-175`
**Severity:** Critical (chapter 8.C.4 step 6 & chapter 10.B tidak berfungsi)

Saat pembeli mengirim foto bukti transfer, webhook melakukan:
1. `ingestInboundMedia()` -> upload MinIO + baris `chat_messages` ✅
2. `analyzeProofMedia()` -> OCR supportive ✅
3. `webhook_events` baris `proof_ocr` ✅
4. `notifyTenant(tenant.id, { type: "proof" })` ✅
5. **selesai** — `return ok({...})`

Tidak ada langkah yang memanggil `submitPaymentProof()`. Padahal satu-satunya pemanggil (`orders/route.ts` action `submit_proof`) mensyaratkan **`order_id` UUID eksplisit** + sesi pemilik toko.

**Bukti nol-pemanggil:**

```
grep -rn "submitPaymentProof" src
  src/lib/orders/orders.ts:269  (definisi)
  src/app/api/orders/route.ts:9  (import)
  src/app/api/orders/route.ts:89 (dipanggil dari action submit_proof — butuh order_id dari sesi)
```

Tidak ada jalur dari "foto masuk" -> "order ini". `payment_status` karenanya **tidak pernah** otomatis menjadi `PROOF_SUBMITTED`.

**Dampak:** Galeri Struk Pembeli kosong; alert owner "BUKTI TRANSFER MASUK" (chapter 8.C.4 step 6) tidak pernah terkirim otomatis; pemilik toko harus membuka order satu per satu dan menandai bukti secara manual — persis alur yang ingin dihapus oleh produk ini.

**Perbaikan (pilih satu):**
- **(a)** Di webhook, cari order aktif terbaru milik `(tenant_id, buyer_jid)` dengan `payment_status IN ('UNPAID','REJECTED')`, lalu panggil `submitPaymentProof({ orderId, mediaUrl, ocr })` + `escalateToOwner(...)`.
- **(b)** Tambahkan kolom `orders.proof_message_id` dan kaitkan lewat `message_id` media.

Rekomendasi: **(a)** karena tidak butuh migrasi skema.

---

### 🟠 M-1 — Tidak ada scheduler/cron sama sekali

**Severity:** Major (chapter 12 tidak berfungsi mandiri)

`grep -rn "cron\|setInterval\|schedule" src` hanya menemukan `setInterval` heartbeat SSE di `realtime/route.ts`. Tidak ada `instrumentation.ts`, tidak ada `middleware.ts`, tidak ada crontab.

Tiga job chapter 12 **hanya** berjalan bila ada yang mem-POST `/api/maintenance`:

| Job | Fungsi | Pemanggil satu-satunya |
|---|---|---|
| `sweepDueNudges(25)` | kirim nudge jatuh tempo | `POST /api/maintenance` |
| `expireStaleReservations()` | lepas reservasi 2 jam kedaluwarsa | `POST /api/maintenance` & `POST /api/orders` |
| `reconcileSubscriptions()` | rekonsiliasi webhook hilang + grace/suspend | `POST /api/maintenance` (scope cron) |

**Dampak:** tanpa pemanggil periodik, **reservasi stok tidak pernah kedaluwarsa sendiri** (stok bisa "terkunci" selamanya oleh order yang ditinggal pembeli), langganan lewat jatuh tempo tidak otomatis masuk `GRACE_PERIOD`/`SUSPENDED`, dan nudge anti-ghosting — **fitur jual utama** — tidak pernah terkirim.

**Perbaikan (yang benar-benar diterapkan):**
- `src/lib/system/scheduler.ts` mengekspor `runMaintenanceSweep()` yang menjalankan ketiga job, dipakai bersama `POST /api/maintenance` supaya tidak bisa drift.
- `scripts/scheduler.ts` menjalankannya tiap 60 s sebagai **proses Node terpisah** (`npm run scheduler`), dengan sweep pertama saat boot.

> **Peringatan:** saran awal di dokumen ini adalah `src/instrumentation.ts` + `setInterval`. Itu **gagal build** (`Can't resolve 'crypto'` — Prisma/ioredis/bullmq masuk ke pass webpack Edge) dan akhirnya tidak dipakai. Jangan mengulanginya.
- Untuk deployment multi-instance, jalankan satu instance scheduler saja, atau ganti dengan BullMQ repeatable job.

---

### 🟠 M-2 — `ensureNudgeWorker()` nol pemanggil

**File:** `src/lib/queue/nudge-queue.ts:270`
**Severity:** Major

```
grep -rn "ensureNudgeWorker" src scripts
  src/lib/queue/nudge-queue.ts:270:export function ensureNudgeWorker(): boolean {
```

Hanya definisi, **tidak ada pemanggil**. Worker BullMQ karena itu **tidak pernah start**, sehingga delayed job yang sudah masuk Redis tidak pernah dikonsumsi. Nudge hanya selamat lewat `sweepDueNudges` — yang, per M-1, juga tidak dijadwalkan.

**Catatan:** `scheduleNudge()` tetap menulis baris DB `PENDING` lebih dulu (desain degradasi yang benar), jadi tidak ada nudge yang *hilang* — tetapi tidak ada yang *mengantar*.

**Perbaikan (diterapkan):** `ensureNudgeWorker()` dipanggil dari `runMaintenanceSweep()` (`src/lib/system/scheduler.ts`) lewat `safeStartWorker()`, yang membungkusnya `try/catch` supaya Redis mati tidak membatalkan sweep. Guard `g.__noewbarWorkerStarted` membuatnya idempoten.

---

### 🟠 M-3 — Media dari pembeli baru dibuang

**File:** `src/lib/media/inbound.ts:60-68` dipanggil dari `wa-webhook/route.ts:136-146`
**Severity:** Major

Webhook mencari conversation yang **sudah ada**:

```ts
const conversation = await prisma.conversation.findUnique({
  where: { tenant_id_buyer_jid: { tenant_id: tenant.id, buyer_jid: payload.sender_jid } },
});
const ingest = await ingestInboundMedia({ conversationId: conversation?.id ?? null, ... });
```

lalu `inbound.ts` menulis:

```ts
conversation_id: params.conversationId ?? "",   // <-- string kosong ke kolom @db.Uuid
```

Kolom `chat_messages.conversation_id` bertipe `@db.Uuid` dengan FK ke `conversations`. String kosong bukan UUID valid -> INSERT gagal -> ditangkap `try/catch` di `ingestInboundMedia` -> `{ ok: false, error: "invalid input syntax for type uuid: \"\"" }`.

**Dampak:** pembeli yang **pertama kali** menghubungi toko lewat foto (mis. langsung kirim struk) kehilangan medianya — file sudah terupload ke MinIO, tapi baris chat tidak ada, dashboard tidak menampilkan apa pun, dan webhook membalas `media_ingested: false`.

**Perbaikan:** buat/lookup conversation sebelum ingest (helper `upsertConversation(tenantId, buyerJid, senderName)`), atau jangan tulis baris `chat_messages` bila `conversationId` null dan return media URL saja.

---

### 🟡 m-4 — Hasil reverse-geocode tidak diteruskan ke AI

**File:** `src/app/api/wa-webhook/route.ts:178-192`
**Severity:** Minor (fitur USP 2 tidak tuntas)

Branch share-location memanggil `reverseGeocode()`, lalu `notifyTenant(...)` dan `return`. Kecamatan hasil geocode **tidak** disimpan ke conversation maupun diteruskan ke `handleInboundMessage`, sehingga AI tidak pernah tahu lokasi pembeli dan tidak bisa langsung memanggil `tool_cek_ongkir`.

**Perbaikan:** simpan `geo.subdistrict` ke conversation (mis. baris `chat_messages` `message_type: 'LOCATION'`), lalu jalankan `handleInboundMessage` dengan hint lokasi di `incomingText`.

---

### 🟡 m-5 — Playground membocorkan identitas tenant nyata

**File:** `src/app/api/playground/route.ts:86-108`
**Severity:** Minor (kebocoran informasi di halaman publik)

```ts
const sampleTenant = await prisma.tenant.findFirst({
  where: { catalog_settings: { isNot: null } },
  orderBy: { created_at: "asc" },
});
...
businessName: sampleTenant?.business_name ?? "Toko Demo Simulator",
```

Tenant **pertama yang terdaftar** dipakai sebagai konteks simulator, dan `business_name` aslinya dikirim ke prompt serta bisa muncul di balasan simulator yang diakses publik di landing page.

**Perbaikan:** gunakan nama netral tetap (mis. `"Toko Simulator"`) dan origin `"Jakarta Selatan"` tanpa membaca tenant; katalog tetap dari `PLAYGROUND_SHEET_URL` (sudah benar).

---

### 🟡 m-6 — Dead code di `verifyPayment`

**File:** `src/lib/orders/orders.ts:360-361`

```ts
const nextOrderStatus: OrderState = orderStatus === "PROCESSING" ? "PROCESSING" : "PROCESSING";
```

Kedua cabang identik. Maksud aslinya jelas (`DRAFT|PENDING_*|...` -> `PROCESSING`), tapi bentuk sekarang menyamarkan niat. Sederhanakan menjadi `const nextOrderStatus: OrderState = "PROCESSING";`.

---

## 5. Kelemahan Keamanan (harus ditangani sebelum produksi)

### S-1 — Kredensial asli di-hardcode sebagai default zod

**File:** `src/lib/env.ts:19-61`
**Severity:** High

Nilai default untuk `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `AI_GATEWAY_URL`, `WHATSMEOW_SECRET`, `NEXTAUTH_SECRET`, dan `SUPERADMIN_EMAIL` diisi dengan **endpoint & kredensial nyata**. Dua konsekuensi:

1. **Melanggar aturan fail-closed.** Webhook dirancang menolak bila secret kosong:
   ```ts
   if (!env.WHATSMEOW_SECRET) return false;   // wa-webhook/route.ts:57
   ```
   Karena default zod **selalu** non-kosong, guard ini **tidak pernah aktif**. Siapa pun yang membaca repo mengetahui secret webhook default dan bisa memicu balasan AI atas nama toko mana pun (biaya token + spam ke pembeli).
2. **Sesi bisa diforge.** `NEXTAUTH_SECRET` default ter-commit -> token HMAC-SHA256 bisa dibuat sendiri oleh penyerang -> mengambil alih sesi tenant mana pun.

**Perbaikan:**
- Hapus semua default kredensial; jadikan wajib (`z.string().min(1)`) atau kosong (`z.string().default("")`).
- Untuk `WHATSMEOW_SECRET` & `NEXTAUTH_SECRET`, **wajib** diisi dan app harus **gagal start** bila kosong di `NODE_ENV=production` (fail-closed, bukan fail-open).
- `.env` sudah benar ada di `.gitignore` (terverifikasi) — perluas ke `.env.*` bila ada varian.

### S-2 — Kepatuhan fail-closed yang belum seragam

`daemonAuthorized()` (wa-webhook) dan `authorizedCron()` (maintenance) sudah fail-closed. Namun karena S-1, keduanya tidak pernah benar-benar menolak. Setelah S-1 diperbaiki keduanya otomatis berperilaku benar; tambahkan test negatif (secret kosong -> 401) ke gate suite.

---

## 6. Yang Sudah Terverifikasi Benar (jangan diubah tanpa alasan)

- **Zero-custody**: `orders.ts` tidak pernah menyentuh dana pembeli; hanya snapshot invoice.
- **Gerbang tunggal VERIFIED**: `verifyPayment` owner-only; AI tidak punya jalur ke sana (dibuktikan gate 6).
- **Anti-halusinasi harga**: `findUnbackedPrices` memblokir `Rp 999.000` dan meloloskan jumlah sah ≤3 nilai tool-backed.
- **Idempotency webhook**: unique `event_key` + P2002; duplicate diserap, langganan tidak diperpanjang dua kali.
- **Grace period**: diperpanjang dari `expires_at` lama, bukan tanggal bayar (siklus bulanan tidak bergeser).
- **Oversell**: reservasi 2 jam dikurangi dari stok katalog sebelum order diterima; fail-closed bila SKU tak ada di snapshot.
- **Konsistensi estimasi**: selama `COURIER_PUBLIC_API_URL` kosong, semua tarif ditandai `is_estimate: true` — tidak menipu pembeli.
- **Prompt injection**: teks pembeli di-fence `<pesan_pembeli>` dan diinstruksikan sebagai DATA.
- **Tenant isolation**: setiap query order memfilter `tenant_id`; SSE per-channel `tenant:<id>`.

---

## 7. Rekomendasi Urutan Kerja (sudah dieksekusi)

1. **S-1** (keamanan, paling murah, paling besar dampak) — hapus default kredensial di `env.ts`. ✅
2. **C-1** — `parallel_tool_calls: false`; ini yang paling sering membuang pesan pembeli. ✅
3. **C-2** — sambungkan bukti transfer ke order; tanpa ini fitur jual utama tidak ada. ✅
4. **M-1 + M-2** — worker + sweeper + reconciler tiap 60 s. ✅ Diterapkan lewat `src/lib/system/scheduler.ts` + `scripts/scheduler.ts` (**bukan** `instrumentation.ts`, yang gagal build).
5. **m-3** — upsert conversation sebelum ingest media. ✅
6. **m-4, m-5, m-6** — perbaikan kecil. ✅
7. Tambahkan test regresi ke `scripts/gates.ts`. ✅ **Gate 7** kini menutup S-1, C-1, C-2, M-1/M-2, m-3, dan m-5 (16 pemeriksaan).


---

## 8. Catatan Nondeterminisme AI

Gate 3 terbukti **flaky** (39/41 lalu 41/41 dengan input identik). Sebabnya bukan test, melainkan C-1: apakah model membatch tool call atau tidak bergantung pada rotasi upstream 9router. **Sudah diperbaiki** dengan `parallel_tool_calls: false` (`TOOL_REQUEST_DEFAULTS`); run pasca-perbaikan menunjukkan model membatch 2 tool call dalam satu turn dan tetap `[PASS] Reply produced without degradation`. Bila Gate 3 gagal lagi, baca `degradationReason` untuk membedakan `400 single tool-calls` dari kegagalan jaringan sungguhan.

---

## 9. Resolusi Bug Webhook & Upgrade Suite (Sesi 11 Okt 2026)

### 9.1 Tiga Bug Webhook Diperbaiki (B-1, B-2, B-3)
1. **B-1 (Share-Location Tanpa Teks):** Pembeli yang share GPS tanpa pesan teks sebelumnya diabaikan (`replied: false`). Sekarang diinjeksi pesan sintetis otomatis untuk menghitung ongkir ke kecamatan hasil reverse-geocode.
2. **B-2 (Caption Pesan Bergambar):** Pesan gambar dengan keterangan teks sebelumnya langsung return early setelah upload media. Sekarang jika ada caption/body, pesan diteruskan ke pipeline pemrosesan AI.
3. **B-3 (Konfirmasi Tanda Terima Bukti Transfer):** Struk yang masuk sebelumnya tidak memberi umpan balik ke pembeli. Sekarang bot langsung membalas WhatsApp pembeli secara otomatis bahwa bukti transfer telah diterima dan sedang diperiksa admin.

### 9.2 Fitur Baru yang Selesai Diimplementasikan
1. **Basis Pengetahuan Toko (Knowledge Base Dokumen):**
   - Model `KnowledgeDocument` di PostgreSQL (`knowledge_documents`).
   - Storage lib `src/lib/knowledge/knowledge-store.ts` dan API `/api/knowledge`.
   - Form dokumen di `PanelKatalog` (FAQ, SOP, Size Chart, Kebijakan Retur) dengan fitur tambah, toggle status, dan hapus.
   - Injeksi otomatis konteks dokumen ke `buildSystemPrompt` + tool baru `tool_baca_panduan_toko`.
2. **Siklus Pengiriman & Tracking Resi:**
   - Kolom `tracking_number` & `shipped_at` pada model `Order`.
   - Action `ship` di API `/api/orders` dan fungsi `shipOrder()` di `src/lib/orders/orders.ts`.
   - Tool AI ke-6: `tool_cek_status_order` (AI dapat menjawab status order dan nomor resi saat ditanya pembeli).
   - Form input resi di `PanelPesanan` untuk pesanan terverifikasi.
3. **Atribut Katalog Lengkap:**
   - Kolom `description`, `category`, `weight_grams`, dan `is_active` di `ProductRow`.
   - Parsing alias fleksibel di `src/lib/catalog/sheets.ts` dan scoring bobot di `toolCariProduk`.
4. **Export CSV Rekap Pesanan:**
   - Tombol Rekap CSV di `PanelPesanan` untuk download laporan order harian format spreadsheet.

