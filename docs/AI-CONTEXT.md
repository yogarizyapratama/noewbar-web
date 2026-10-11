# Konteks AI — Noewbar CS Pro

Dokumen ini ditujukan untuk **agen AI atau pengembang yang melanjutkan pekerjaan**. Isinya: di mana segalanya berada, apa yang tidak boleh diubah, dan jebakan yang sudah terbukti. Baca ini sebelum menyentuh kode.

**Dokumen terkait:** `AUDIT-REPORT.md` (bug & bukti), `ARCHITECTURE.md` (desain sistem), `DEVELOPMENT.md` (setup & alur kerja), `../AGENTS.md` (aturan agen).

---

## 1. Identitas Proyek

| | |
|---|---|
| Nama | Noewbar CS Pro (`noewbar-cs-pro` v1.0.0) |
| Jenis | SaaS multi-tenant otomasi Customer Service WhatsApp |
| Root | `/Users/mac/Documents/YOGA/YOGA GOKS/noewbar` |
| Stack | Next.js 14.2.35 (App Router, standalone) · TypeScript 5.6 · React 18.3 |
| DB | PostgreSQL 16 via Prisma 5.22 — **11 tabel** (termasuk `knowledge_documents`) |
| AI | 9router gateway (OpenAI-compatible), model kontrak `combo-ai`, fallback `combo-free` |
| WhatsApp | daemon Go (whatsmeow) `:8088` |
| Storage | MinIO S3 |
| Antrean | BullMQ di atas Redis |
| Realtime | SSE in-memory |
| Node | 22.23.3 (wajib `>=20.9.0`) |
| Git | **BUKAN git repository** (`git log` -> exit 128) |
| Skala | 43 file TS/TSX · 9.901 LOC · 12 API route · 3 halaman |

---

## 2. Aturan yang Tidak Boleh Dilanggar

Ini bukan preferensi gaya. Melanggarnya merusak jaminan keamanan atau bisnis.

1. **AI tidak pernah bisa `VERIFIED`.** Hanya `verifyPayment()` (dipanggil dari sesi pemilik toko) yang boleh. `submitPaymentProof()` secara struktural hanya mencapai `PROOF_SUBMITTED`.
2. **OCR itu supportive-only.** Jangan sambungkan output OCR ke transisi state order.
3. **Order tidak bisa masuk `PROCESSING` tanpa `payment_status = VERIFIED`.** Ditegakkan `assertFulfilmentAllowed()`.
4. **Backend adalah satu-satunya sumber harga/stok/ongkir.** Jangan pernah membiarkan model menyebut angka yang tidak berasal dari tool. Bila menambah jalur balasan baru, lewatkan tetap melalui `findUnbackedPrices()`.
5. **Zero-custody.** Jangan pernah menambahkan kode yang menampung dana atau menyatakan "uang diterima".
6. **Isolasi tenant.** Setiap query order/percakapan wajib memfilter `tenant_id`.
7. **Tidak ada data demo/dummy/hardcode di UI.** Simulator memakai katalog nyata dari `PLAYGROUND_SHEET_URL` atau menampilkan keadaan kosong yang jujur.
8. **Tidak ada kredensial sebagai default kode.** Lihat temuan S-1.
9. **Skema Prisma: hanya aditif.** Jangan ubah/hapus kolom tabel produksi.
10. **Jangan pakai `em dash` (—) di UI.** Lihat `DESIGN.md`.

---

## 3. Peta Cepat — "Saya mau mengubah X, bukanya di mana?"

| Ingin mengubah | File |
|---|---|
| Perilaku/kepribadian bot | `src/lib/ai/prompts.ts` |
| Tool yang tersedia bagi model | `src/lib/ai/micro-tools.ts` (+ `TOOL_NAMES` di `types.ts`) |
| Loop agen / fallback model / guard harga | `src/lib/ai/orchestrator.ts` |
| Klien gateway AI | `src/lib/ai/gateway.ts` |
| OCR bukti transfer | `src/lib/ai/vision-ocr.ts` |
| Lifecycle order & reservasi stok | `src/lib/orders/orders.ts` |
| State machine order/payment | `src/lib/orders/state.ts` |
| Nudge anti-ghosting | `src/lib/queue/nudge-queue.ts` |
| Billing & notifikasi Midtrans | `src/lib/billing/midtrans.ts` |
| Kuitansi PDF | `src/lib/billing/receipt-pdf.ts` |
| Parsing katalog Sheets | `src/lib/catalog/sheets.ts` |
| Tarif ongkir & cache | `src/lib/logistics/shipping-engine.ts` |
| Reverse geocode | `src/lib/geo/geocode.ts` |
| Upload/download MinIO | `src/lib/storage/minio.ts` |
| Klien daemon WhatsApp | `src/lib/wa/daemon-client.ts` |
| Idempotency webhook | `src/lib/webhooks/idempotency.ts` |
| Event realtime | `src/lib/realtime/event-bus.ts` |
| Kill-switch & anti-abuse | `src/lib/system/killswitch.ts` |
| Scheduler (nudge + reservasi + reconcile) | `src/lib/system/scheduler.ts`, `scripts/scheduler.ts` |
| Auth & sesi | `src/lib/auth.ts`, `src/lib/crypto.ts` |
| Kontrak env | `src/lib/env.ts` |
| Respons API | `src/lib/http.ts` |
| Ingest media masuk | `src/lib/media/inbound.ts` |
| Endpoint webhook WhatsApp | `src/app/api/wa-webhook/route.ts` |
| Endpoint order & resi pengiriman | `src/app/api/orders/route.ts` |
| Basis Pengetahuan Toko (SOP, FAQ, Size Chart) | `src/lib/knowledge/knowledge-store.ts`, `src/app/api/knowledge/route.ts` |
| Input Resi & Update Pengiriman | `src/lib/orders/orders.ts` (`shipOrder`) |
| Cron/maintenance | `src/app/api/maintenance/route.ts` |
| Test integrasi | `scripts/gates.ts`, `scripts/smoke-test.mjs` |

---

## 4. Peringatan Aktif (baca sebelum debug)

Semua temuan audit **sudah diperbaiki** (lihat `FIX-REPORT.md`). Bagian ini menyimpan jebakannya karena pola-pola inilah yang paling mudah rusak kembali.

### 4.1 Gate 3 pernah flaky — bukan gangguan jaringan (C-1, SUDAH diperbaiki)
Gate 3 pernah memberi 39/41 lalu 41/41 dengan input identik. Penyebabnya: tanpa `parallel_tool_calls: false`, model yang membatch >1 tool call mendapat `400 "This model only supports single tool-calls at once!"`. Pesan error itu **bukan** kegagalan infrastruktur.

Sekarang `TOOL_REQUEST_DEFAULTS` di `gateway.ts` memaksa `parallel_tool_calls: false` dan `isSingleToolCallError()` melewati model yang tetap menolak. **Bila Gate 3 gagal lagi**, periksa `degradationReason` lebih dulu, lalu pastikan flag itu tidak terlepas dari body request saat menambah jalur AI baru.

### 4.2 Bukti transfer sudah tersambung (C-2, SUDAH diperbaiki)
Dulu foto bukti di-ingest dan di-OCR tetapi **tidak ada kode** yang memanggil `submitPaymentProof()`, sehingga order tetap `UNPAID` dan Galeri Struk kosong. Sekarang `wa-webhook/route.ts` mencari order aktif milik pembeli (`payment_status in [UNPAID, REJECTED]`) lalu melampirkan buktinya.

Batas kerasnya tetap: jalur inbound **maksimal `PROOF_SUBMITTED`**. Bila ada order stuck `UNPAID` padahal buyer sudah kirim struk, periksa dulu apakah buyer itu benar-benar punya order aktif — bukan menambah pemanggilan `verifyPayment` dari webhook.

### 4.3 Scheduler itu proses terpisah (M-1, M-2, SUDAH diperbaiki)
Dulu `ensureNudgeWorker()` nol pemanggil dan `sweepDueNudges` / `expireStaleReservations` / `reconcileSubscriptions` hanya jalan bila ada yang POST `/api/maintenance`.

Sekarang `src/lib/system/scheduler.ts` menyediakan `runMaintenanceSweep()`, dipakai bersama oleh endpoint dan proses `npm run scheduler`. **Yang mudah terlewat:** scheduler **bukan** bagian dari `npm run start`. Bila nudge atau reservasi tidak pernah kedaluwarsa, periksa apakah proses kedua itu benar-benar hidup:

```bash
ps aux | grep -c "[s]cripts/scheduler.ts"
```

Jangan menyimpulkan "logika nudge rusak" tanpa memeriksa apakah ada yang memanggilnya.

**Jangan pakai `src/instrumentation.ts` untuk ini.** Percobaan itu sudah gagal: Next menarik Prisma/ioredis/bullmq ke pass webpack Edge dan build mati dengan `Can't resolve 'crypto'`, walau sudah di-dynamic import di dalam cabang `NEXT_RUNTIME !== "nodejs"`.

### 4.4 `chat_messages.conversation_id` bertipe UUID + FK (m-3, SUDAH diperbaiki)
Menulis `""` gagal dengan `invalid input syntax for type uuid`. Media dari pembeli tanpa conversation akan dibuang diam-diam (`try/catch`). Upsert conversation dulu.

### 4.5 Redaction menyamarkan kode yang mirip kredensial
Baris seperti `apiKey: *** || "not-set"` (`orchestrator.ts:28`) dan `Authorization: *** ${auth}` adalah hasil redaksi tool, bukan kode rusak. Jangan "perbaiki".

---

## 5. Pola Kode yang Harus Diikuti

### Menegakkan aturan AI di kode, bukan hanya prompt
```ts
// Setiap "AI tidak boleh X" harus punya penegak deterministik
const unbacked = findUnbackedPrices(replyText, toolOutcomes);
if (unbacked.length > 0) {
  degraded = true;
  replyText = SAFE_FALLBACK_REPLY;
}
```

### Fail-closed pada input tidak tepercaya
```ts
if (!env.WHATSMEOW_SECRET) return false;      // bukan return true
return safeEqual(provided, env.WHATSMEOW_SECRET);
```
```ts
if (catalogStock === undefined) {
  return { ok: false, code: "STOCK_UNAVAILABLE" };   // bukan anggap tersedia
}
```

### Idempotency lewat constraint unik, bukan pengecekan baca-lalu-tulis
```ts
try {
  await prisma.webhookEvent.create({ data: { event_key: key, ... } });
} catch (err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return { status: "DUPLICATE" };
  }
  throw err;
}
```

### Degradasi berlapis dengan pelabelan jujur
```ts
// cache -> provider -> estimasi (SELALU is_estimate: true)
rates.push({ source: "estimate", is_estimate: true, ... });
```

### Error yang bisa dijawab bot: kembalikan hasil bertipe, jangan throw
```ts
export type CreateOrderResult =
  | { ok: true; ... }
  | { ok: false; error: string; code: "EMPTY_CART" | "STOCK_UNAVAILABLE" | "SHIPPING_FAILED" };
```
Alasannya: bot harus bisa menjawab "stok habis" secara jujur, bukan melempar exception dan diam.

---

## 6. Perintah Verifikasi Cepat

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22.23.3

npm run typecheck        # harus exit 0
npm run gates            # 63 pemeriksaan nyata (butuh semua dependensi hidup)
npm run smoke            # 21 pemeriksaan HTTP (app harus hidup)
npm run sse:verify       # kanal SSE tenant
npm run artifacts:verify # artefak PDF/OCR
```

Gate 1-6 adalah pemeriksaan asli; **Gate 7** khusus menjaga temuan audit agar tidak kembali (S-1, C-1, C-2, M-1/M-2, m-3, m-5) **plus jendela riwayat** (`AI_MAX_HISTORY_MESSAGES` wired ke `MAX_HISTORY_MESSAGES`, batas 1..50, dan bukti fungsional bahwa query benar-benar memotong ke jendela itu) **plus field katalog opsional saat daftar** (`sheets_url`/`origin_subdistrict` boleh kosong, registrasi tetap berhasil, dan `fetchCatalog("")` gagal-closed bukan crash). Totalnya 16 pemeriksaan. Bila Anda memperbaiki sesuatu di daftar itu, tambahkan pemeriksaannya ke Gate 7, jangan hanya mengandalkan ingatan.

Scheduler berjalan sebagai proses terpisah dan **tidak** ikut `npm run start`:
```bash
npm run scheduler > /tmp/noewbar-scheduler.log 2>&1 &
```

Saat menjalankan server untuk diuji, gunakan latar belakang:
```bash
npm run start > /tmp/noewbar-app.log 2>&1 &
# lalu verifikasi kesiapan sebelum smoke test
curl -sf http://127.0.0.1:3001/api/maintenance -H "Cookie: ..." || true
```

---

## 7. Temuan Audit & Status

Kedelapan temuan **sudah diperbaiki dan diverifikasi**. Rincian diff per temuan beserta bukti gate ada di `FIX-REPORT.md`. Tabel ini ringkasannya:

| # | Temuan | File | Perbaikan | Status |
|---|---|---|---|---|
| 1 | S-1 | `src/lib/env.ts` | Hapus semua default kredensial; wajib-isi + gagal start | Selesai |
| 2 | C-1 | `src/lib/ai/orchestrator.ts`, `gateway.ts` | `TOOL_REQUEST_DEFAULTS` + `isSingleToolCallError()` | Selesai |
| 3 | C-2 | `src/app/api/wa-webhook/route.ts` | Cari order aktif milik buyer -> `submitPaymentProof()` (maks `PROOF_SUBMITTED`) | Selesai |
| 4 | M-1 + M-2 | `src/lib/system/scheduler.ts` (baru), `scripts/scheduler.ts` (baru) | Worker + sweeper + reconciler tiap 60 s, proses terpisah | Selesai |
| 5 | m-3 | `src/lib/media/inbound.ts` | Upsert conversation sebelum ingest | Selesai |
| 6 | m-4 | `src/app/api/wa-webhook/route.ts` | Teruskan kecamatan hasil geocode ke AI | Selesai |
| 7 | m-5 | `src/app/api/playground/route.ts` | Nama bisnis netral, query tenant dihapus | Selesai |
| 8 | m-6 | `src/lib/orders/orders.ts` | `nextOrderStatus` dinyatakan lugas | Selesai |

Pemeriksaan regresi untuk semuanya ada di **Gate 7** (`scripts/gates.ts`).

**Belum ditangani (di luar 8 temuan ini):** rate limiter masih in-memory, sehingga dengan lebih dari satu instance batas efektifnya menjadi batas x jumlah instance. Butuh store eksternal (Redis) bila aplikasi di-scale horizontal.


---

## 8. Ringkasan Alur End-to-End

```
Pembeli WhatsApp
   │
   ▼  (socket WA)
Daemon Go :8088  ──POST /api/wa-webhook──►  Next.js :3001
                                                │
                          daemonAuthorized ─────┤ fail-closed 401
                          kill-switch ──────────┤
                          idempotency (P2002) ──┤
                          resolve instance ─────┤
                                                ▼
                    ┌──────────── media? ─────────────┐
                    │ ingestInboundMedia → MinIO     │
                    │ analyzeProofMedia → OCR        │
                    │ resolveConversationId (upsert) │
                    │ order aktif buyer?             │
                    │   → submitPaymentProof         │
                    │     (maks PROOF_SUBMITTED)     │
                    └────────────────────────────────┘
                                                │
                          location? ─ reverseGeocode ── notify
                                    └─ kecamatan disuntik ke konteks AI (m-4)
                                                │
                          teks ─► readCatalog(Sheets→cache)
                                    │
                                    ▼
                              handleInboundMessage
                                    │ upsert conversation
                                    │ cancelPendingNudges
                                    │ cek human_takeover / auto_reply
                                    │ ambil riwayat ≤6
                                    ▼
                                 runAgent
                                    │ loop tools (≤5 round, ≤8 call)
                                    │   cari_produk / ambil_foto_video
                                    │   cek_ongkir / atur_nudge / oper_manusia
                                    │ turn komposisi final
                                    │ guard findUnbackedPrices
                                    ▼
                              persist balasan + media + trace
                                                │
                          anti-abuse (120/3mnt) ┤ exceeded → freeze PAIRING
                                                ▼
                              waDaemon.sendText / sendMedia
                                                │
                                                ▼
                                         Pembeli menerima balasan
```

---

## 9. Kosakata Domain

| Istilah | Arti dalam sistem ini |
|---|---|
| **Nudge** | Pengingat anti-ghosting otomatis ke pembeli yang menghilang setelah quote |
| **Unique code** | Angka 3 digit (100-999) ditambahkan ke total invoice untuk mencocokkan transfer |
| **Reservasi** | Penguncian stok 2 jam saat order dibuat, dilepas idempoten saat kedaluwarsa |
| **Supportive-only** | Output AI yang membantu manusia memutuskan, tidak pernah menjadi keputusan |
| **Hybrid verification** | AI mengumpulkan bukti, manusia memverifikasi |
| **Kill-switch** | Flag proses yang mematikan balasan bot seketika secara global |
| **Anti-abuse trap** | Freeze instance yang mengirim >120 pesan dalam 3 menit |
| **Grace period** | 3 hari setelah jatuh tempo sebelum tenant di-SUSPEND |
| **fenceUntrusted** | Membungkus teks pembeli sebagai DATA, mencegah prompt injection |
| **is_estimate** | Penanda jujur bahwa tarif ongkir adalah perkiraan, bukan tarif resmi |
