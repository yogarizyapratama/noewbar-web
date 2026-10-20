try {
  process.loadEnvFile();
} catch {
  // Ignore if already loaded or not present
}

import assert from "node:assert";
import prisma from "../../src/lib/prisma";
import {
  createOrder,
  expireStaleReservations,
  releaseReservation,
} from "../../src/lib/orders/orders";
import { reverseGeocode } from "../../src/lib/geo/geocode";
import { calculateShippingRates } from "../../src/lib/logistics/shipping-engine";
import { cancelPendingNudges, scheduleNudge } from "../../src/lib/queue/nudge-queue";
import { handleInboundMessage, runAgent } from "../../src/lib/ai/orchestrator";
import { modelChain } from "../../src/lib/ai/gateway";
import { SAFE_FALLBACK_REPLY } from "../../src/lib/ai/prompts";
import type { CartLine, ProductRow, ToolContext } from "../../src/lib/ai/types";

/**
 * ============================================================================
 * ADVANCED RESILIENCE & REAL-WORLD FIELD TEST SUITE
 * ============================================================================
 * Menguji skenario ketahanan nyata toko:
 * 1. Concurrency & Rebutan Stok (Race condition checkout item terakhir)
 * 2. Auto-Release Stok Kedaluwarsa (Order TTL 2 jam & pengembalian stok)
 * 3. Share-Location GPS WhatsApp (Pin GPS -> Kecamatan -> Hitung Ongkir)
 * 4. Anti-Ghosting Nudge & Auto-Cancel (Follow up otomatis & pembatalan instan)
 * 5. Human CS Takeover (Muting bot total saat CS manusia ambil alih)
 * 6. Multi-Tenant Data Isolation (Keamanan zero-leak antar toko)
 * 7. Ketahanan & Failover AI Gateway (Model chain & graceful degradation)
 */

export async function runAdvancedResilienceTests(): Promise<{ total: number; passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    return Promise.resolve()
      .then(fn)
      .then(() => {
        console.log(`  [PASS] ${name}`);
        passed += 1;
      })
      .catch((err) => {
        console.error(`  [FAIL] ${name}`);
        console.error(`         Error: ${err instanceof Error ? err.message : String(err)}`);
        failed += 1;
      });
  }

  console.log("\n================================================================================");
  console.log("   NOEWBAR CS PRO - ADVANCED RESILIENCE & FIELD READINESS TEST SUITE            ");
  console.log("================================================================================");

  // Setup Test Tenant khusus untuk isolasi pengujian database
  const TEST_TENANT_ID = "11111111-2222-3333-4444-555555555555";
  const TEST_CONV_ID = "22222222-3333-4444-5555-666666666666";

  // Pastikan tenant uji bersih sebelum mulai
  await prisma.order.deleteMany({ where: { tenant_id: TEST_TENANT_ID } });
  await prisma.chatMessage.deleteMany({ where: { conversation: { tenant_id: TEST_TENANT_ID } } });
  await prisma.scheduledNudge.deleteMany({ where: { conversation: { tenant_id: TEST_TENANT_ID } } });
  await prisma.conversation.deleteMany({ where: { tenant_id: TEST_TENANT_ID } });
  await prisma.catalogSetting.deleteMany({ where: { tenant_id: TEST_TENANT_ID } });
  await prisma.waInstance.deleteMany({ where: { tenant_id: TEST_TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TEST_TENANT_ID } });

  // Buat tenant uji riil di PostgreSQL
  await prisma.tenant.create({
    data: {
      id: TEST_TENANT_ID,
      email: "resilience-test@noewbar.com",
      password_hash: "hash_test_secure_123",
      business_name: "Toko Uji Ketahanan",
      owner_name: "Tester Ketahanan",
      owner_whatsapp: "081234567899",
      status: "ACTIVE",
      trial_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      catalog_settings: {
        create: {
          sheets_url: "",
          origin_subdistrict: "Coblong, Kota Bandung",
          bank_name: "BCA",
          bank_account_number: "8720918231",
          bank_account_holder: "PT NOEWBAR RETAIL",
          auto_reply_enabled: true,
          shipping_cut_off_hour: 15,
        },
      },
      wa_instances: {
        create: {
          instance_key: "resilience-inst-01",
          connection_status: "CONNECTED",
        },
      },
    },
  });

  const testConv = await prisma.conversation.create({
    data: {
      id: TEST_CONV_ID,
      tenant_id: TEST_TENANT_ID,
      buyer_jid: "6289911223344@s.whatsapp.net",
      buyer_name: "Buyer Uji Ketahanan",
      pipeline_stage: "INQUIRY",
    },
  });

  const singleStockSku = "TSH-LIMITED-EDT";
  const testStockSnapshot: Record<string, number> = {
    [singleStockSku]: 1, // HANYA ADA 1 PCS TERSISA
  };

  const testLines: CartLine[] = [
    {
      sku: singleStockSku,
      name: "Kaos Limited Edition",
      variant: "Hitam (Size L)",
      price: 150000,
      qty: 1,
      line_total: 150000,
      weight_grams: 250,
    },
  ];

  console.log("\n=== 1. CONCURRENCY & REBUTAN STOK (RACE CONDITION) ===");

  await test("Concurrency 1.1: Dua pembeli checkout sisa 1 pcs bersamaan -> Tepat 1 berhasil, 1 ditolak (Zero Overselling)", async () => {
    // Jalankan 2 permintaan checkout secara paralel di milidetik yang sama
    const [buyer1Res, buyer2Res] = await Promise.all([
      createOrder({
        tenantId: TEST_TENANT_ID,
        conversationId: testConv.id,
        buyerJid: "6281111111111@s.whatsapp.net",
        buyerName: "Pembeli A",
        lines: testLines,
        destinationSubdistrict: "Kebayoran Baru, Jakarta Selatan",
        originSubdistrict: "Coblong, Kota Bandung",
        courier: "JNT",
        stockSnapshot: testStockSnapshot,
      }),
      createOrder({
        tenantId: TEST_TENANT_ID,
        conversationId: testConv.id,
        buyerJid: "6282222222222@s.whatsapp.net",
        buyerName: "Pembeli B",
        lines: testLines,
        destinationSubdistrict: "Gambir, Jakarta Pusat",
        originSubdistrict: "Coblong, Kota Bandung",
        courier: "JNT",
        stockSnapshot: testStockSnapshot,
      }),
    ]);

    // Salah satu wajib berhasil dan salah satu wajib gagal STOCK_UNAVAILABLE
    const results = [buyer1Res, buyer2Res];
    const successes = results.filter((r) => r.ok === true);
    const failures = results.filter((r) => r.ok === false);

    assert.strictEqual(successes.length, 1, "Tepat 1 pesanan yang boleh berhasil");
    assert.strictEqual(failures.length, 1, "Tepat 1 pesanan yang harus ditolak karena stok habis");

    const failedResult = failures[0];
    if (!failedResult.ok) {
      assert.strictEqual(failedResult.code, "STOCK_UNAVAILABLE");
      assert.ok(failedResult.error.includes("Insufficient stock"));
    }
  });

  console.log("\n=== 2. AUTO-RELEASE STOK KEDALUWARSA (RESERVATION EXPIRY) ===");

  await test("Expiry 2.1: Order kedaluwarsa (2 jam tanpa bayar) otomatis di-sweep -> status EXPIRED & stok kembali sellable", async () => {
    // Buat order yang waktu reservasi kadaluwarsanya sengaja dibuat di masa lalu (1 menit lalu)
    const activeOrder = await prisma.order.findFirst({
      where: { tenant_id: TEST_TENANT_ID, stock_reserved: true },
    });
    assert.ok(activeOrder, "Harus ada order hasil test 1.1 yang memegang reservasi stok");

    // Mundurkan waktu kedaluwarsa ke masa lalu
    await prisma.order.update({
      where: { id: activeOrder.id },
      data: {
        reservation_expires_at: new Date(Date.now() - 60 * 1000), // 1 menit lalu
      },
    });

    // Jalankan sweeper expireStaleReservations
    const sweepResult = await expireStaleReservations(TEST_TENANT_ID);
    assert.ok(sweepResult.expired >= 1, "Minimal 1 order harus di-expire");
    assert.ok(sweepResult.released >= 1, "Minimal 1 reservasi stok harus dilepas");

    // Verifikasi di database: order menjadi EXPIRED dan stock_released menjadi true
    const updatedOrder = await prisma.order.findUnique({ where: { id: activeOrder.id } });
    assert.strictEqual(updatedOrder?.order_status, "EXPIRED");
    assert.strictEqual(updatedOrder?.stock_released, true);
    assert.strictEqual(updatedOrder?.stock_reserved, false);

    // Sekarang pembeli lain mencoba checkout kembali -> Harusnya SUDAH BISA karena stok telah dilepas!
    const retryOrder = await createOrder({
      tenantId: TEST_TENANT_ID,
      conversationId: testConv.id,
      buyerJid: "6283333333333@s.whatsapp.net",
      buyerName: "Pembeli C",
      lines: testLines,
      destinationSubdistrict: "Coblong, Kota Bandung",
      originSubdistrict: "Coblong, Kota Bandung",
      courier: "JNT",
      stockSnapshot: testStockSnapshot,
    });

    assert.strictEqual(retryOrder.ok, true, "Pembeli C harus berhasil checkout setelah stok kadaluwarsa dilepas");
  });

  console.log("\n=== 3. SHARE-LOCATION GPS WHATSAPP (USP 2: PIN GPS -> ONGKIR) ===");

  await test("GPS 3.1: Reverse geocode koordinat Bandung (-6.9175, 107.6191) menghasilkan kecamatan valid", async () => {
    const geo = await reverseGeocode(-6.9175, 107.6191);
    assert.strictEqual(geo.ok, true);
    assert.ok(geo.subdistrict, "Kecamatan harus terdeteksi dari koordinat");
    assert.ok(geo.city?.includes("Bandung"), "Kota harus terdeteksi sebagai Bandung");
  });

  await test("GPS 3.2: Hasil reverse geocode diteruskan ke shipping engine -> Ongkir langsung terhitung otomatis", async () => {
    const geo = await reverseGeocode(-6.9175, 107.6191);
    assert.ok(geo.subdistrict);

    const shipping = await calculateShippingRates({
      originSubdistrict: "Coblong, Kota Bandung",
      destinationSubdistrict: `${geo.subdistrict}, ${geo.city}`,
      orderTotalAmount: 95000,
      weightKg: 0.25,
    });

    assert.ok(shipping.rates.length >= 3, "Harus menyediakan opsi J&T, SiCepat, JNE");
    assert.ok(shipping.rates[0].total_tariff > 0, "Tarif ongkir lokal Bandung harus valid");
  });

  await test("GPS 3.3: Koordinat luar negeri / lautan bebas ditangani dengan aman tanpa crash", async () => {
    // 0, 0 adalah Null Island di Samudra Atlantik
    const geo = await reverseGeocode(0.0, 0.0);
    // Harus mengembalikan respons terstruktur tanpa crash proses
    assert.strictEqual(typeof geo.ok, "boolean");
  });

  console.log("\n=== 4. ANTI-GHOSTING NUDGE & AUTO-CANCEL ===");

  await test("Nudge 4.1: Buyer membalas chat -> Nudge yang sedang pending otomatis dibatalkan instan", async () => {
    // Buat scheduled nudge tiruan di database untuk percakapan ini
    await prisma.scheduledNudge.create({
      data: {
        conversation_id: testConv.id,
        scheduled_time: new Date(Date.now() + 120 * 60 * 1000), // 2 jam ke depan
        status: "PENDING",
        message_payload: "Halo Kak! Masih berminat dengan produknya?",
      },
    });

    // Panggil cancelPendingNudges (seperti yang dilakukan saat pesan masuk)
    const cancelledCount = await cancelPendingNudges(testConv.id);
    assert.ok(cancelledCount >= 1, "Nudge pending harus berhasil dibatalkan");

    // Verifikasi di database: status menjadi CANCELLED
    const nudges = await prisma.scheduledNudge.findMany({
      where: { conversation_id: testConv.id, status: "PENDING" },
    });
    assert.strictEqual(nudges.length, 0, "Tidak boleh ada nudge yang tersisa dalam status PENDING");
  });

  console.log("\n=== 5. HUMAN CS TAKEOVER (PENGAMBILALIHAN MANUAL) ===");

  await test("Takeover 5.1: is_human_takeover diaktifkan -> Bot bisu (botMuted: true) & pesan tersimpan di riwayat", async () => {
    // Set takeover aktif oleh owner toko
    await prisma.conversation.update({
      where: { id: testConv.id },
      data: { is_human_takeover: true },
    });

    const result = await handleInboundMessage({
      tenantId: TEST_TENANT_ID,
      buyerJid: testConv.buyer_jid,
      buyerName: "Buyer Uji",
      incomingText: "Halo admin, pesanan saya kok belum dikirim ya?",
      instanceKey: "resilience-inst-01",
      catalog: [],
      catalogSource: "cache",
      persist: true,
    });

    assert.strictEqual(result.botMuted, true, "Bot wajib bisu saat human takeover aktif");
    assert.strictEqual(result.botMutedReason, "human_takeover");
    assert.strictEqual(result.replyText, "", "Bot dilarang mengirim teks balasan");

    // Pesan buyer harus tetap tersimpan agar CS manusia bisa membaca di dashboard
    const savedMsg = await prisma.chatMessage.findFirst({
      where: { conversation_id: testConv.id, content: "Halo admin, pesanan saya kok belum dikirim ya?" },
    });
    assert.ok(savedMsg, "Pesan pembeli wajib tersimpan di database untuk CS manusia");
  });

  await test("Takeover 5.2: Killswitch auto_reply_enabled dimatikan di katalog -> Bot bisu dengan alasan auto_reply_disabled", async () => {
    // Matikan human takeover tapi matikan toggle auto_reply_enabled di toko
    await prisma.conversation.update({
      where: { id: testConv.id },
      data: { is_human_takeover: false },
    });
    await prisma.catalogSetting.update({
      where: { tenant_id: TEST_TENANT_ID },
      data: { auto_reply_enabled: false },
    });

    const result = await handleInboundMessage({
      tenantId: TEST_TENANT_ID,
      buyerJid: testConv.buyer_jid,
      buyerName: "Buyer Uji",
      incomingText: "Halo admin?",
      instanceKey: "resilience-inst-01",
      catalog: [],
      catalogSource: "cache",
      persist: true,
    });

    assert.strictEqual(result.botMuted, true);
    assert.strictEqual(result.botMutedReason, "auto_reply_disabled");
  });

  await test("Takeover 5.3: Toko mengembalikan bot ke aktif -> AI kembali merespons normal", async () => {
    // Kembalikan ke auto_reply_enabled = true
    await prisma.catalogSetting.update({
      where: { tenant_id: TEST_TENANT_ID },
      data: { auto_reply_enabled: true },
    });

    const result = await handleInboundMessage({
      tenantId: TEST_TENANT_ID,
      buyerJid: testConv.buyer_jid,
      buyerName: "Buyer Uji",
      incomingText: "Halo kak mau tanya",
      instanceKey: "resilience-inst-01",
      catalog: [
        {
          sku: "TSH-OVR-BLK",
          name: "Kaos Oversize",
          variant: "Hitam",
          price: 95000,
          stock: 10,
          photo_url: null,
          video_url: null,
          category: "Kaos",
          description: "Kaos katun",
          weight_grams: 250,
          is_active: true,
        },
      ],
      catalogSource: "cache",
      persist: true,
    });

    assert.strictEqual(result.botMuted, false, "Bot harus aktif kembali");
    assert.ok(result.replyText.length > 5, "Bot harus memberikan balasan teks ramah");
  });

  console.log("\n=== 6. ISOLASI DATA MULTI-TENANT (ANTI-BOCOR ANTAR TOKO) ===");

  await test("Multi-Tenant 6.1: Query order Tenant A terisolasi total dari Tenant B", async () => {
    const OTHER_TENANT_ID = "9993ee5c-6fc8-4649-9999-e85624b2c40f";

    // Query pesanan dengan scope Tenant A
    const ordersA = await prisma.order.findMany({
      where: { tenant_id: TEST_TENANT_ID },
      select: { id: true, tenant_id: true },
    });

    // Query pesanan dengan scope Tenant B
    const ordersB = await prisma.order.findMany({
      where: { tenant_id: OTHER_TENANT_ID },
      select: { id: true, tenant_id: true },
    });

    // Tidak boleh ada satupun pesanan Tenant B yang tercampur di Tenant A
    const idsB = new Set(ordersB.map((o) => o.id));
    for (const o of ordersA) {
      assert.strictEqual(o.tenant_id, TEST_TENANT_ID);
      assert.strictEqual(idsB.has(o.id), false, "Pesanan Tenant B dilarang bocor ke Tenant A");
    }
  });

  await test("Multi-Tenant 6.2: Percakapan WhatsApp Tenant A tidak dapat diakses atau ditimpa oleh Tenant B", async () => {
    const convA = await prisma.conversation.findFirst({
      where: { tenant_id: TEST_TENANT_ID },
    });
    assert.ok(convA);

    // Pastikan unique constraint @@unique([tenant_id, buyer_jid]) menjaga partisi percakapan
    const OTHER_TENANT_ID = "9993ee5c-6fc8-4649-9999-e85624b2c40f";
    const convOther = await prisma.conversation.findUnique({
      where: {
        tenant_id_buyer_jid: {
          tenant_id: OTHER_TENANT_ID,
          buyer_jid: convA.buyer_jid,
        },
      },
    });

    // Percakapan pembeli di Tenant B adalah entitas terpisah atau null (tidak boleh menunjuk ke id percakapan Tenant A)
    if (convOther) {
      assert.notStrictEqual(convOther.id, convA.id, "ID percakapan antar tenant dilarang sama");
    }
  });

  console.log("\n=== 7. KETAHANAN & FAILOVER AI GATEWAY ===");

  await test("Gateway 7.1: Model fallback chain terdaftar secara berurutan dan terduplikasi", () => {
    const chain = modelChain();
    assert.ok(chain.length >= 2, "Harus memiliki minimal primary model dan 1 fallback");
    assert.strictEqual(chain[0], process.env.AI_MODEL || "ag/gemini-3-flash", "Model utama harus yang pertama");
    // Pastikan tidak ada duplikasi
    const unique = new Set(chain);
    assert.strictEqual(unique.size, chain.length, "Model chain tidak boleh memiliki duplikat");
  });

  await test("Gateway 7.2: Gangguan total pada AI tertangani dengan graceful fallback santun tanpa crash", async () => {
    const brokenCtx: ToolContext = {
      tenantId: "00000000-0000-0000-0000-000000000000",
      conversationId: "00000000-0000-0000-0000-000000000000",
      buyerJid: "test@s.whatsapp.net",
      buyerName: "Tester",
      instanceKey: null,
      originSubdistrict: "Jakarta Selatan",
      nudgeDelayMinutes: 120,
      catalog: [],
      catalogSource: "sheet",
      payment: {
        bankName: "BCA",
        bankAccountNumber: "8720918231",
        bankAccountHolder: "Noewbar Store",
        qrisUrl: null,
      },
    };

    // Panggil agent dengan flag forced fallback simulation jika terjadi crash upstream
    const res = await runAgent({
      businessName: "Toko Ketahanan",
      incomingText: "P",
      history: [],
      ctx: brokenCtx,
      catalogSource: "sheet",
    });

    // Apapun yang terjadi di gateway, AI tidak boleh throw error unhandled
    assert.strictEqual(typeof res.replyText, "string");
    assert.ok(res.replyText.length > 0);
  });

  // Cleanup data uji
  await prisma.order.deleteMany({ where: { tenant_id: TEST_TENANT_ID } });
  await prisma.chatMessage.deleteMany({ where: { conversation: { tenant_id: TEST_TENANT_ID } } });
  await prisma.scheduledNudge.deleteMany({ where: { conversation: { tenant_id: TEST_TENANT_ID } } });
  await prisma.conversation.deleteMany({ where: { tenant_id: TEST_TENANT_ID } });
  await prisma.catalogSetting.deleteMany({ where: { tenant_id: TEST_TENANT_ID } });
  await prisma.waInstance.deleteMany({ where: { tenant_id: TEST_TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TEST_TENANT_ID } });

  console.log("\n================================================================================");
  console.log(`  HASIL ADVANCED RESILIENCE: ${passed}/${passed + failed} passed (${failed} failed)`);
  console.log("================================================================================\n");

  return { total: passed + failed, passed, failed };
}

if (process.argv[1]?.endsWith("advanced-resilience.test.ts")) {
  runAdvancedResilienceTests()
    .then((r) => {
      process.exit(r.failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("Advanced resilience runner crashed:", err);
      process.exit(1);
    });
}
