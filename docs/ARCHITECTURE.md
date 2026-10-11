# Arsitektur Noewbar CS Pro

Dokumen ini menjelaskan bagaimana sistem benar-benar tersusun, berdasarkan pembacaan kode dan verifikasi runtime. Gunakan ini sebagai peta sebelum mengubah apa pun.

---

## 1. Gambaran Tingkat Tinggi

```
                 WhatsApp (pembeli)
                        │
                        ▼
        ┌──────────────────────────────┐
        │  Whatsmeow daemon (Go)       │  :8088
        │  gateway-whatsmeow/main.go   │  896 LOC
        │  - owns WA Web socket        │
        │  - /instances/init|qr|status │
        │  - /instances/send|send-media│
        │  - POST webhook ke app       │
        └──────────────┬───────────────┘
                       │ POST /api/wa-webhook  (header X-Noewbar-Secret)
                       ▼
        ┌──────────────────────────────────────────────┐
        │  Next.js 14 App Router   :3001               │
        │  .next/standalone/server.js                  │
        │                                              │
        │  api/wa-webhook ──► orchestrator ──► 9router │
        │       │                  │           (AI GW) │
        │       │                  └─► micro-tools     │
        │       │                        ├─ orders     │
        │       │                        ├─ shipping   │
        │       │                        ├─ nudge-queue│
        │       │                        └─ alerts     │
        │       ├──► media/inbound ──► MinIO           │
        │       ├──► ai/vision-ocr (supportive only)   │
        │       ├──► geo/geocode                       │
        │       └──► realtime/event-bus (SSE)          │
        └───────┬───────────┬───────────┬──────────────┘
                │           │           │
                ▼           ▼           ▼
          PostgreSQL    Redis      MinIO S3      Telegram API
          :5433         :6379      :9000/9001    (alert darurat)
          (10 tabel)   (BullMQ)    (assets)
```

---

## 2. Prinsip Arsitektur yang Dipegang

### 2.1 Backend adalah satu-satunya sumber kebenaran
Model AI **dilarang** menyatakan harga, stok, atau ongkir yang tidak berasal dari tool. Ditegakkan dua lapis:
- **Prompt**: `prompts.ts` `AGENT_SYSTEM_PROMPT` aturan #1 "DILARANG mengarang".
- **Kode**: `findUnbackedPrices()` di `orchestrator.ts` — memindai balasan, menolak angka Rupiah yang bukan nilai tool atau jumlah sah ≤3 nilai tool-backed. Bila ditemukan, balasan diganti `SAFE_FALLBACK_REPLY`.

### 2.2 Zero-custody
Sistem tidak pernah menampung dana. `orders/orders.ts` tidak punya kode pembayaran; ia hanya mencatat snapshot invoice. Dana mengalir langsung ke rekening/QRIS toko.

### 2.3 Gerbang tunggal menuju VERIFIED
`verifyPayment()` adalah **satu-satunya** fungsi yang bisa menghasilkan `payment_status = VERIFIED`, dan hanya dipanggil dari `POST /api/orders` action `verify` yang mensyaratkan sesi tenant (pemilik toko). `submitPaymentProof()` secara struktural hanya bisa mencapai `PROOF_SUBMITTED`. OCR bersifat *supportive-only* dan hidup di modul terpisah (`ai/vision-ocr.ts`) sehingga tidak punya akses ke state machine order.

### 2.4 Degradasi anggun (Rp 0/bulan)
- **Katalog**: Sheets -> cache in-memory TTL 5 menit -> array kosong + warning ke prompt.
- **Ongkir**: PostgreSQL `shipping_rates_cache` (< 10 ms) -> provider publik bila dikonfigurasi -> matriks zona deterministik yang **selalu** dilabeli `is_estimate: true`.
- **Nudge**: Redis delayed job -> baris DB `PENDING` sebagai sumber daya tahan -> sweeper DB.
- **AI**: rantai model `AI_MODEL` -> `AI_FALLBACK_MODELS`, berhenti pada konten non-kosong pertama.

### 2.5 Fail-closed pada input tidak tepercaya
- `daemonAuthorized()` menolak bila `WHATSMEOW_SECRET` kosong.
- `authorizedCron()` sama untuk maintenance.
- `requireTenant()` mengembalikan `null` untuk tenant `SUSPENDED`.
- `createOrder()` mengembalikan `STOCK_UNAVAILABLE` bila SKU tidak ada di snapshot stok (bukan menganggap tersedia).
- Semua body request divalidasi zod sebelum dipakai.

---

## 3. Peta Modul

### 3.1 Lapisan AI (`src/lib/ai/`)

| File | Tanggung jawab |
|---|---|
| `orchestrator.ts` | Loop tool-calling terbatas (`MAX_TOOL_ROUNDS=5`), fallback model, guard anti-halusinasi harga, `handleInboundMessage()` yang memuat konteks tenant + conversation + riwayat + persistensi |
| `gateway.ts` | Satu klien OpenAI-compatible ke 9router; `modelChain()` + `chatWithFallback()` |
| `micro-tools.ts` | 5 tool nativ + `TOOL_SCHEMAS` + `executeTool()` dispatch + `recordToolTraces()` |
| `prompts.ts` | `AGENT_SYSTEM_PROMPT`, `buildSystemPrompt()`, `fenceUntrusted()`, konstanta window |
| `vision-ocr.ts` | OCR bukti transfer; **hanya** mengembalikan insight, tidak pernah menyentuh state order |
| `types.ts` | `ProductRow`, `ToolContext`, `ToolExecutionResult`, `TOOL_NAMES` |

**Kontrak tool** (`micro-tools.ts`):

| Tool | Fungsi | Efek samping |
|---|---|---|
| `tool_cari_produk` | Cari ≤3 produk relevan | hitung stok jual (`availableStock`) |
| `tool_ambil_foto_video` | Ambil URL media asli dari katalog | tidak ada |
| `tool_cek_ongkir` | Hitung tarif 3 kurir | tulis `shipping_rates_cache` |
| `tool_atur_nudge` | Snapshot order + kode unik + reservasi 2 jam + jadwal nudge | tulis `orders`, `scheduled_nudges`, Redis job |
| `tool_oper_manusia` | Alihkan ke pemilik toko | matikan bot untuk pembeli, alert WA+Telegram |

### 3.2 Lapisan Order (`src/lib/orders/`)

**Dua state machine terpisah** (`state.ts`) — ini inti desainnya:

```
order_status:    DRAFT → PENDING_CONFIRMATION → PENDING_PAYMENT → PROCESSING
                 → READY_TO_SHIP → SHIPPED → COMPLETED
                 (+ CANCELLED, EXPIRED sebagai terminal)

payment_status:  UNPAID → PROOF_SUBMITTED → UNDER_REVIEW → VERIFIED
                 UNPAID/PROOF_SUBMITTED/UNDER_REVIEW → REJECTED
                 REJECTED → PROOF_SUBMITTED (bukti ulang)
                 VERIFIED → (terminal)
```

**Gerbang keras** (`assertFulfilmentAllowed`): `PROCESSING` ditolak bila `payment_status !== VERIFIED`. Inilah satu-satunya yang mencegah struk palsu masuk ke antrean pemenuhan.

**Reservasi stok atomik**: `reservedQtyForSku()` menjumlahkan `qty` dari `orders.items` (jsonb) untuk order yang `stock_reserved=true AND stock_released=false AND reservation_expires_at > NOW()`. `sellable = catalogStock - reserved`. Dua pembeli simultan tidak bisa menjual barang terakhir.

### 3.3 Lapisan Antrean (`src/lib/queue/nudge-queue.ts`)
BullMQ di atas Redis. Setiap nudge ditulis ke DB **lebih dulu**, baru di-enqueue dengan `jobId = nudgeId` (idempoten). Pesan pembeli yang kembali membatalkan nudge (`cancelPendingNudges`). `deliverNudge()` idempoten: baris non-`PENDING` dilewati.

### 3.4 Lapisan Billing (`src/lib/billing/`)
- `midtrans.ts`: verifikasi SHA-512 (`timingSafeEqual`), pemroses notifikasi idempoten, aritmetika grace period, rekonsiliasi, Snap checkout.
- `receipt-pdf.ts`: generator kuitansi PDF (pdfkit) untuk dikirim via WhatsApp.

### 3.5 Lapisan Realtime (`src/lib/realtime/event-bus.ts`)
Pub/sub in-memory. Kanal `tenant:<uuid>` + `admin`. Event adalah **sinyal "ada yang berubah"**, bukan payload data — konsumen memuat ulang dari API. Tanpa riwayat, sehingga klien yang telat konek tidak masalah. Antarmuka siap dinaikkan ke Redis pub/sub untuk multi-instance.

### 3.6 Lapisan Integrasi
| Modul | Integrasi |
|---|---|
| `catalog/sheets.ts` | Google Sheets CSV export, alias header, parsing Rupiah Indonesia, cache TTL |
| `logistics/shipping-engine.ts` | cache PG -> provider publik -> matriks zona |
| `storage/minio.ts` | S3 upload/head/delete, matriks ukuran, key per tenant |
| `wa/daemon-client.ts` | HTTP client daemon + `safeFetchWithSecret()` |
| `alerts/telegram.ts` + `alerts/dispatcher.ts` | alert darurat WA + Telegram |
| `geo/geocode.ts` | reverse-geocode GPS -> kecamatan |
| `system/killswitch.ts` | flag kill-switch + jendela anti-abuse |
| `webhooks/idempotency.ts` | ledger idempotency `webhook_events` |
| `auth.ts` + `crypto.ts` | Argon2id + token HMAC-SHA256, tanpa dependensi auth eksternal |

---

## 4. Permukaan API

| Route | Metode | Fungsi | Auth |
|---|---|---|---|
| `/api/auth` | POST/GET/DELETE/PUT | login, register trial, probe sesi, logout, generate hash admin | rate-limited |
| `/api/wa-webhook` | POST/GET | inbound WhatsApp (teks/media/lokasi) | secret daemon |
| `/api/wa/qr` | GET/POST | pairing QR instance | sesi tenant |
| `/api/orders` | POST/GET | verify/review/submit_proof/release/sweep + papan order | sesi tenant |
| `/api/billing/checkout` | POST/GET | Snap token + snapshot langganan | sesi tenant |
| `/api/billing/webhook` | POST/GET | notifikasi Midtrans | SHA-512 |
| `/api/realtime` | GET | SSE `?scope=tenant\|admin` | sesi |
| `/api/maintenance` | POST/GET | cron job + health board | secret cron / sesi |
| `/api/dashboard` | GET | data dashboard tenant | sesi tenant |
| `/api/conversations` | GET | daftar & detail percakapan | sesi tenant |
| `/api/superadmin` | POST/GET | konsol operator platform | sesi admin |
| `/api/playground` | POST/GET | simulator publik | rate-limited |

---

## 5. Skema Data (10 tabel)

8 tabel inti chapter 9 (nol-drift terhadap produksi):
`tenants`, `wa_instances`, `catalog_settings`, `conversations`, `chat_messages`, `scheduled_nudges`, `shipping_rates_cache`, `subscriptions`.

2 tabel aditif dari chapter yang lebih lanjut:
- `orders` — chapter 8.C (dua state machine + reservasi stok + bukti pembayaran)
- `webhook_events` — chapter 16 (ledger idempotency)

Setiap model mem-pin `@@map` ke nama tabel snake_case dan setiap kolom ke nama kolom persisnya, sehingga `prisma db push` adalah no-op terhadap skema produksi. **Aturan: hanya penambahan aditif; jangan pernah mengubah/menghapus kolom yang sudah ada.**

---

## 6. Alur Kritis

### 6.1 Pesan teks masuk
```
daemon → POST /api/wa-webhook
  → daemonAuthorized()            (fail-closed, 401)
  → isBotDisabled()               (kill-switch)
  → zod validate
  → idempotency insert (wa:<message_id>)  → duplicate? return
  → resolve wa_instance → tenant
  → tenant SUSPENDED? return
  → readCatalog(tenant, sheets_url)  → sheet | cache
  → handleInboundMessage()
      → upsert conversation
      → cancelPendingNudges()          (chapter 14.3)
      → is_human_takeover? persist & return
      → auto_reply_enabled? return
      → ambil riwayat (≤ AI_MAX_HISTORY_MESSAGES, default 12 pesan)
      → runAgent()
          → loop: chat completion (tools) → executeTool → pesan tool
          → turn komposisi final (tanpa tool)
          → findUnbackedPrices() guard
      → persist balasan + media + tool trace
      → pipeline_stage = QUOTED bila tool_atur_nudge dipanggil
  → recordBotSend() anti-abuse      → exceeded? freeze ke PAIRING
  → waDaemon.sendText() + sendMedia()
```

### 6.2 Bukti transfer (sudah tersambung, C-2 diperbaiki)
```
daemon → webhook media_url=...
  → ingestInboundMedia() → MinIO + chat_messages
      └─ resolveConversationId() upsert conversation dulu (m-3)
  → analyzeProofMedia()  → OCR (supportive, tidak pernah auto-verify)
  → order aktif milik buyer? (payment_status in [UNPAID, REJECTED])
      └─ ya → submitPaymentProof()  → maksimal PROOF_SUBMITTED
              └─ notifyTenant({type:"proof"})
  → VERIFIED tetap hanya lewat verifyPayment() dari sesi pemilik toko
```

### 6.3 Pembayaran langganan
```
POST /api/billing/checkout → createSubscriptionOrder() (status TRIAL)
  → Midtrans Snap /transactions → token
Pembayaran → POST /api/billing/webhook
  → processMidtransNotification()
      → verifyMidtransSignature()   (SHA-512, fail = 403 tanpa DB)
      → insert webhook_events        (duplikat = DUPLICATE, 200)
      → settlement/capture → perpanjang dari expires_at LAMA
      → aktualkan subscription ACTIVE + tenant ACTIVE
  → notifyTenant({type:"billing"}) + notifyAdmin
  → background: generate kuitansi PDF → kirim WhatsApp ke owner
```

---

## 7. Multi-Tenant & Isolasi Konteks Percakapan

Ya, sistem ini **multi-tenant**, dan konteks percakapan AI **terisolasi per tenant**.

### Bagaimana tenant ditentukan
Nomor WhatsApp bukan penentu tenant. Yang menentukan adalah `instance_key` milik daemon:

```
payload daemon (instance_key) → wa_instances.instance_key (@unique)
                                    └─ tenant_id → Tenant
```

Karena `instance_key` **unique** dan setiap instance milik tepat satu tenant, satu nomor WhatsApp hanya bisa melayani satu tenant. `tenantId` yang diteruskan ke AI selalu `tenant.id` hasil lookup ini — **tidak pernah** dari payload pembeli, sehingga pembeli tidak bisa memalsukan tenant.

### Kunci isolasi konteks
`conversations` punya constraint `@@unique([tenant_id, buyer_jid])`. Artinya:

- identitas percakapan = **(tenant, nomor pembeli)**, bukan nomor pembeli saja;
- nomor pembeli yang sama menghubungi dua tenant berbeda akan menghasilkan **dua conversation terpisah** dengan riwayat masing-masing;
- satu nomor ke tenant yang sama selalu memakai **baris yang sama** (inilah yang membuat percakapan nyambung).

Riwayat yang dikirim ke model diambil dengan filter `conversation_id`, dan conversation itu sudah ter-scope tenant:

```ts
const historyRows = await prisma.chatMessage.findMany({
  where: { conversation_id: conversation.id },   // sudah milik satu tenant
  orderBy: { created_at: "desc" },
  take: MAX_HISTORY_MESSAGES,                    // 12 (env AI_MAX_HISTORY_MESSAGES)
});
```

Jadi tidak ada jalur yang bisa membocorkan riwayat antar tenant.

### Yang tersimpan per percakapan
Teks pembeli, balasan bot, balasan agen manusia, dan pesan media (gambar/dokumen/lokasi) tersimpan di `chat_messages` — **persisten di PostgreSQL**, jadi konteks tetap ada setelah restart server.

### Bukti runtime (dijalankan, bukan diklaim)
Probe dengan satu nomor pembeli yang sama pada dua tenant menghasilkan:

| Pemeriksaan | Hasil |
|---|---|
| Dua conversation berbeda | `true` (`eba4a8e3` vs `63c563d6`) |
| Nomor pembeli identik | `true` |
| Riwayat tenant A memuat pesan tenant B | `false` |
| Tenant A hanya melihat conversation miliknya | 1 |
| Pesan lanjutan memakai baris yang sama | `true` |
| Total conversation untuk nomor itu | 2 |

### Batasan yang perlu diketahui
- **Riwayat dibatasi `MAX_HISTORY_MESSAGES` (default 12, ≈6 pasang tanya-jawab)**, hanya tipe `TEXT` dan `IMAGE`. Nilainya disetel lewat `AI_MAX_HISTORY_MESSAGES` (rentang 1..50; app menolak start di luar itu). Konteks lebih lama dari jendela ini tidak dikirim ke model.
- **Jendela ini adalah tombol kualitas, bukan tombol biaya.** Diukur dari prompt nyata: `TOOL_SCHEMAS` ≈1.000 token + `AGENT_SYSTEM_PROMPT` ≈600 token dikirim ulang tiap ronde, dan `MAX_TOOL_ROUNDS = 5` — jadi biaya tetap ≈8.000 token/balasan, sementara 12 pesan riwayat (rata-rata 101 char ≈27 token) hanya ≈7% dari input. Menaikkan 6→12 menambah sekitar +7% token input. Yang mahal adalah skema tool × 5 ronde, bukan riwayat.
- **Pesan gambar ikut memakan slot riwayat**, jadi jendela yang terlalu kecil bisa habis oleh 2-3 foto pembeli. Ini salah satu alasan 12 lebih baik dari 6.
- **Untuk percakapan sangat panjang, jendela bukan solusi yang tepat.** Perbaikan berikutnya adalah menyuntikkan ulang *state order* (nomor order, produk, qty, alamat) ke prompt — deterministik dan hemat token — bukan memperbesar jendela tanpa batas.
- **Persona AI per tenant** berasal dari `tenants.business_name` + `catalog_settings` tenant tersebut, jadi gaya balasan dan katalognya ikut terpisah.
- `is_human_takeover` mematikan balasan bot untuk percakapan itu saja, tidak tenant-wide.

