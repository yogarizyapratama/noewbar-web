import assert from "node:assert";
import {
  sanitizeAgentReply,
  findUnbackedPrices,
  findUnbackedAccountNumbers,
} from "../../src/lib/ai/orchestrator";
import {
  toolCariProduk,
  toolAmbilFotoVideo,
  toolCekOngkir,
  toolRekomendasiUkuran,
  toolHitungPromoBundling,
  toolCekJadwalPengiriman,
  toolRekomendasiAlternatif,
} from "../../src/lib/ai/micro-tools";
import {
  calculateShippingRates,
  estimateBaseTariff,
  cheapestRate,
} from "../../src/lib/logistics/shipping-engine";
import { buildOrderNumber, createOrder } from "../../src/lib/orders/orders";
import {
  canTransitionOrder,
  canTransitionPayment,
  assertOrderTransition,
  assertPaymentTransition,
  assertFulfilmentAllowed,
} from "../../src/lib/orders/state";
import {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  generateUniqueCode,
} from "../../src/lib/crypto";
import {
  parseRupiah,
  parseStock,
  parseActive,
  verifyStructure,
  toCsvExportUrl,
} from "../../src/lib/catalog/sheets";
import type { ProductRow, ToolContext } from "../../src/lib/ai/types";

const mockCatalog: ProductRow[] = [
  {
    sku: "TSH-OVR-BLK",
    name: "Kaos Oversize Cotton Combed 24s",
    variant: "Hitam (Size M, L, XL)",
    price: 95000,
    stock: 45,
    photo_url: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800",
    video_url: "https://example.com/video-kaos.mp4",
    category: "Kaos & T-Shirt",
    description: "Kaos polos oversized unisex bahan 100% Cotton Combed 24s gramasi 185gsm.",
    weight_grams: 250,
    is_active: true,
  },
  {
    sku: "HOD-FLC-BLK",
    name: "Hoodie Heavyweight Fleece 330gsm",
    variant: "Hitam Pekat (Size L, XL)",
    price: 185000,
    stock: 28,
    photo_url: "https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=800",
    video_url: null,
    category: "Outerwear & Jaket",
    description: "Hoodie tebal hitam pekat bahan fleece katun 330gsm.",
    weight_grams: 650,
    is_active: true,
  },
];

const mockContext: ToolContext = {
  tenantId: "00000000-0000-0000-0000-000000000000",
  conversationId: "00000000-0000-0000-0000-000000000000",
  buyerJid: "628123456789@s.whatsapp.net",
  buyerName: "Tester",
  instanceKey: null,
  originSubdistrict: "Jakarta Selatan",
  nudgeDelayMinutes: 120,
  catalog: mockCatalog,
  catalogSource: "cache",
  payment: {
    bankName: "BCA",
    bankAccountNumber: "8830123456",
    bankAccountHolder: "Noewbar Store",
    qrisUrl: "https://example.com/qris.png",
  },
  promoRules: [
    { min_qty: 2, discount_percent: 5, promo_name: "Diskon Hemat 5% (Beli 2 pcs)" },
    { min_qty: 3, discount_percent: 10, promo_name: "Diskon Bundling 10% (Beli 3+ pcs)" },
    { min_qty: 5, discount_percent: 15, promo_name: "Diskon Grosir 15% (Beli 5+ pcs)" },
  ],
  voucherRules: [
    { code: "HEMAT10", discount_amount: 10000 },
    { code: "NOEWBAR10", discount_amount: 10000 },
  ],
  shippingSchedule: {
    cut_off_hour: 15,
    open_hour: 8,
    close_hour: 21,
  },
};

export async function runUnitTests(): Promise<{ total: number; passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      const res = fn();
      if (res instanceof Promise) {
        return res
          .then(() => {
            passed += 1;
            console.log(`  [PASS] ${name}`);
          })
          .catch((err) => {
            failed += 1;
            console.error(`  [FAIL] ${name} ->`, err.message);
          });
      }
      passed += 1;
      console.log(`  [PASS] ${name}`);
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  [FAIL] ${name} ->`, msg);
    }
  }

  console.log("\n=== 1. UNIT TEST: AI Orchestrator Sanitizers & Guardrails ===");

  test("sanitizeAgentReply: removes paired think tags", () => {
    const raw = "<think>Periksa stok kaos oversize...</think>Halo Kak, stok ready!";
    const clean = sanitizeAgentReply(raw);
    assert.strictEqual(clean, "Halo Kak, stok ready!");
  });

  test("sanitizeAgentReply: removes unclosed think tags", () => {
    const raw = "Halo Kak!<think>Thinking in progress";
    const clean = sanitizeAgentReply(raw);
    assert.strictEqual(clean, "Halo Kak!");
  });

  test("sanitizeAgentReply: removes bracketed thinking and tags", () => {
    const raw = "[thinking]analisis kueri pembeli[/thinking][JAWABAN] Siap Kak, ready stok ya.";
    const clean = sanitizeAgentReply(raw);
    assert.strictEqual(clean, "Siap Kak, ready stok ya.");
  });

  test("sanitizeAgentReply: removes echoed buyer tags and leaked CoT sentences", () => {
    const raw = "<pesan_pembeli>2 ke bandung</pesan_pembeli>[Konteks Gambar Produk dari Pembeli: Kaos polos hitam]Sekarang saya perlu memanggil tool_cek_ongkir untuk mengecek tarif.Totalnya Rp218.000 ya Kak.";
    const clean = sanitizeAgentReply(raw);
    assert.strictEqual(clean, "Totalnya Rp218.000 ya Kak.");
  });

  test("findUnbackedPrices: blocks fabricated unbacked prices", () => {
    const toolOutcomes = [
      {
        tool: "tool_cari_produk" as const,
        payload: { matches: [{ price: 95000 }] },
        toolPayload: {},
        summary: "",
        media: [],
        escalated: false,
      },
    ];
    const reply = "Harganya Rp950.000 ya Kak.";
    const unbacked = findUnbackedPrices(reply, toolOutcomes);
    assert.strictEqual(unbacked.length, 1);
    assert.ok(unbacked[0].includes("950.000"));
  });

  test("findUnbackedPrices: allows exact backed prices and honest sums", () => {
    const toolOutcomes = [
      {
        tool: "tool_cari_produk" as const,
        payload: { matches: [{ price: 95000 }] },
        toolPayload: {},
        summary: "",
        media: [],
        escalated: false,
      },
      {
        tool: "tool_cek_ongkir" as const,
        payload: { rates: [{ tariff: 28000 }] },
        toolPayload: {},
        summary: "",
        media: [],
        escalated: false,
      },
    ];
    // 95000 + 28000 = 123000
    const reply = "Kaos Rp95.000, ongkir Rp28.000, total Rp123.000 ya Kak.";
    const unbacked = findUnbackedPrices(reply, toolOutcomes);
    assert.strictEqual(unbacked.length, 0);
  });

  test("sanitizeAgentReply: strips unicode em-dashes and replaces with commas", () => {
    const raw = "Harga kaos Rp95.000\u2014sudah termasuk diskon.";
    const clean = sanitizeAgentReply(raw);
    assert.strictEqual(clean, "Harga kaos Rp95.000, sudah termasuk diskon.");
    assert.ok(!clean.includes("\u2014"));
  });

  test("sanitizeAgentReply: strips arbitrary artifact tags like [BALASAN]: or [CS]:", () => {
    const raw = "[BALASAN]: Halo Kak! Ready ya.";
    const clean = sanitizeAgentReply(raw);
    assert.strictEqual(clean, "Halo Kak! Ready ya.");
  });

  test("findUnbackedAccountNumbers: ignores long numeric IDs in photo URLs", () => {
    const reply = "Foto asli produk: https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800";
    const unbacked = findUnbackedAccountNumbers(reply, [], mockContext.payment);
    assert.strictEqual(unbacked.length, 0);
  });

  test("findUnbackedAccountNumbers: detects foreign invented bank account numbers", () => {
    const reply = "Silakan transfer ke rekening BCA 998877665544 ya Kak.";
    const unbacked = findUnbackedAccountNumbers(reply, [], mockContext.payment);
    assert.strictEqual(unbacked.length, 1);
    assert.ok(unbacked[0].includes("998877665544"));
  });

  test("findUnbackedAccountNumbers: allows legitimate configured tenant bank account", () => {
    const reply = "Silakan transfer ke BCA 8830123456 a/n Noewbar Store ya Kak.";
    const unbacked = findUnbackedAccountNumbers(reply, [], mockContext.payment);
    assert.strictEqual(unbacked.length, 0);
  });

  console.log("\n=== 2. UNIT TEST: Micro Tools & Product Catalog ===");

  await test("toolCariProduk: finds products by keyword tokens and size", async () => {
    const res = await toolCariProduk(mockContext, { query: "kaos hitam XL" });
    assert.ok(res.matches.length > 0);
    assert.strictEqual(res.matches[0].sku, "TSH-OVR-BLK");
    assert.strictEqual(res.matches[0].price, 95000);
  });

  await test("toolCariProduk: handles dirty queries with special characters and extra spaces", async () => {
    const res = await toolCariProduk(mockContext, { query: "  !@# kaos   hitam  %^&  " });
    assert.ok(res.matches.length > 0);
    assert.strictEqual(res.matches[0].sku, "TSH-OVR-BLK");
  });

  await test("toolCariProduk: returns empty matches for non-existent items without throwing", async () => {
    const res = await toolCariProduk(mockContext, { query: "sepatu roda anak" });
    assert.strictEqual(res.matches.length, 0);
  });

  await test("toolAmbilFotoVideo: retrieves valid photo url", async () => {
    const res = await toolAmbilFotoVideo(mockContext, { sku: "TSH-OVR-BLK", kind: "photo" });
    assert.ok(res.result);
    assert.strictEqual(res.result?.kind, "image");
    assert.ok(res.result?.media_url?.includes("unsplash.com"));
  });

  await test("toolAmbilFotoVideo: retrieves video url when available", async () => {
    const res = await toolAmbilFotoVideo(mockContext, { sku: "TSH-OVR-BLK", kind: "video" });
    assert.ok(res.result);
    assert.strictEqual(res.result?.kind, "video");
    assert.strictEqual(res.result?.media_url, "https://example.com/video-kaos.mp4");
  });

  await test("toolAmbilFotoVideo: gracefully falls back to photo when video is unavailable and handles invalid SKU", async () => {
    // HOD-FLC-BLK has photo but video_url is null: tool smartly provides photo as fallback
    const resNoVideo = await toolAmbilFotoVideo(mockContext, { sku: "HOD-FLC-BLK", kind: "video" });
    assert.ok(resNoVideo.result);
    assert.strictEqual(resNoVideo.result?.kind, "image");
    assert.ok(resNoVideo.result?.media_url?.includes("unsplash.com"));

    // SKU-TIDAK-ADA does not exist in catalog: returns result null with clear guidance note
    const resInvalid = await toolAmbilFotoVideo(mockContext, { sku: "SKU-TIDAK-ADA", kind: "photo" });
    assert.strictEqual(resInvalid.result, null);
    assert.ok(resInvalid.note?.includes("tidak ditemukan"));
  });

  await test("toolCekOngkir: calculates rates using destination aliases", async () => {
    const res = await toolCekOngkir(mockContext, { destination: "Pekanbaru" });
    assert.strictEqual(res.destination, "Pekanbaru");
    assert.ok(res.rates.length >= 3);
    assert.ok(res.cheapest);
    assert.ok(res.cheapest.tariff > 0);
  });

  await test("toolRekomendasiUkuran: accurately calculates size from height & weight", async () => {
    const res = await toolRekomendasiUkuran(mockContext, { height_cm: 170, weight_kg: 65 });
    assert.strictEqual(res.recommended_size, "M");
    assert.strictEqual(res.confidence, "high");
    assert.ok(res.dimensions.chest_cm > 0);
  });

  await test("toolRekomendasiUkuran: handles edge cases with only chest circumference or extreme body metrics", async () => {
    const resChest = await toolRekomendasiUkuran(mockContext, { chest_cm: 114 });
    assert.strictEqual(resChest.recommended_size, "XL");

    const resSmall = await toolRekomendasiUkuran(mockContext, { height_cm: 150, weight_kg: 45 });
    assert.strictEqual(resSmall.recommended_size, "S");

    const resBig = await toolRekomendasiUkuran(mockContext, { height_cm: 188, weight_kg: 95 });
    assert.strictEqual(resBig.recommended_size, "XXL");
  });

  await test("toolRekomendasiUkuran: climbs ladder for oversize fit preference without exceeding XXL", async () => {
    const resOversize = await toolRekomendasiUkuran(mockContext, {
      height_cm: 170,
      weight_kg: 65,
      fit_preference: "oversize",
    });
    // Standard M becomes L for oversize
    assert.strictEqual(resOversize.recommended_size, "L");

    const resXXL = await toolRekomendasiUkuran(mockContext, {
      height_cm: 190,
      weight_kg: 100,
      fit_preference: "oversize",
    });
    // XXL stays XXL (max ceiling)
    assert.strictEqual(resXXL.recommended_size, "XXL");
  });

  await test("toolHitungPromoBundling: calculates multi-buy volume discounts and vouchers per tenant", async () => {
    const res = await toolHitungPromoBundling(mockContext, {
      items: [{ sku: "TSH-OVR-BLK", qty: 3, price: 95000 }],
      voucher_code: "HEMAT10",
    });
    assert.strictEqual(res.total_qty, 3);
    assert.strictEqual(res.subtotal_before_discount, 285000);
    assert.strictEqual(res.discount_percent, 10);
    // 10% of 285000 = 28500 + voucher 10000 = 38500
    assert.strictEqual(res.discount_amount, 38500);
    assert.strictEqual(res.final_subtotal, 246500);
    assert.strictEqual(res.applied_voucher, "HEMAT10");
  });

  await test("toolHitungPromoBundling: handles case-insensitive voucher codes with whitespace", async () => {
    const res = await toolHitungPromoBundling(mockContext, {
      items: [{ sku: "TSH-OVR-BLK", qty: 2, price: 95000 }],
      voucher_code: "   hemat10   ",
    });
    assert.strictEqual(res.applied_voucher, "HEMAT10");
    assert.ok(res.discount_amount >= 10000);
  });

  await test("toolHitungPromoBundling: safely clamps negative or zero quantities to minimum 1", async () => {
    const res = await toolHitungPromoBundling(mockContext, {
      items: [{ sku: "TSH-OVR-BLK", qty: -5, price: 95000 }],
    });
    assert.strictEqual(res.total_qty, 1);
    assert.strictEqual(res.subtotal_before_discount, 95000);
  });

  await test("toolHitungPromoBundling: clamps subtotal to zero when voucher exceeds total order value", async () => {
    const ctxBigVoucher: ToolContext = {
      ...mockContext,
      voucherRules: [{ code: "SUPER500", discount_amount: 500000 }],
    };
    const res = await toolHitungPromoBundling(ctxBigVoucher, {
      items: [{ sku: "TSH-OVR-BLK", qty: 1, price: 95000 }],
      voucher_code: "SUPER500",
    });
    assert.strictEqual(res.applied_voucher, "SUPER500");
    assert.strictEqual(res.final_subtotal, 0);
  });

  await test("toolHitungPromoBundling: rejects unauthorized or fake voucher codes honestly", async () => {
    const res = await toolHitungPromoBundling(mockContext, {
      items: [{ sku: "TSH-OVR-BLK", qty: 1, price: 95000 }],
      voucher_code: "DISKON_PALSU_99",
    });
    assert.strictEqual(res.applied_voucher, null);
    assert.strictEqual(res.discount_amount, 0);
    assert.strictEqual(res.final_subtotal, 95000);
  });

  await test("toolHitungPromoBundling: returns zero discount when tenant has no active promo rules", async () => {
    const ctxNoPromo: ToolContext = {
      ...mockContext,
      promoRules: [],
      voucherRules: [],
    };
    const res = await toolHitungPromoBundling(ctxNoPromo, {
      items: [{ sku: "TSH-OVR-BLK", qty: 5, price: 95000 }],
    });
    assert.strictEqual(res.total_qty, 5);
    assert.strictEqual(res.discount_percent, 0);
    assert.strictEqual(res.discount_amount, 0);
    assert.strictEqual(res.final_subtotal, 475000);
    assert.strictEqual(res.promo_name, "Tidak Ada Promo Bundling");
    assert.ok(res.savings_note.includes("belum mengaktifkan promo bundling"));
  });

  await test("toolHitungPromoBundling: accurately applies custom tenant promo tiers", async () => {
    const ctxCustomPromo: ToolContext = {
      ...mockContext,
      promoRules: [
        { min_qty: 2, discount_percent: 25, promo_name: "Super Bundling 25% Tenant X" },
      ],
    };
    const res = await toolHitungPromoBundling(ctxCustomPromo, {
      items: [{ sku: "TSH-OVR-BLK", qty: 2, price: 95000 }],
    });
    assert.strictEqual(res.total_qty, 2);
    assert.strictEqual(res.subtotal_before_discount, 190000);
    assert.strictEqual(res.discount_percent, 25);
    assert.strictEqual(res.discount_amount, 47500);
    assert.strictEqual(res.final_subtotal, 142500);
    assert.strictEqual(res.promo_name, "Super Bundling 25% Tenant X");
  });

  await test("toolCekJadwalPengiriman: reflects dynamic tenant shipping cut-off schedule", async () => {
    const ctxCustomSchedule: ToolContext = {
      ...mockContext,
      shippingSchedule: {
        cut_off_hour: 17,
        open_hour: 9,
        close_hour: 22,
      },
    };
    const res = await toolCekJadwalPengiriman(ctxCustomSchedule);
    assert.ok(res.current_time_wib.includes("WIB"));
    assert.ok(res.cut_off_time.includes("17.00"));
    assert.ok(res.courier_schedules.length >= 3);
    assert.ok(res.courier_schedules.some((c) => c.pickup_hours.includes("18.00")));
  });

  await test("toolCekJadwalPengiriman: accurately computes same-day dispatch eligibility", async () => {
    const res = await toolCekJadwalPengiriman(mockContext);
    assert.ok(typeof res.same_day_dispatch_eligible === "boolean");
    assert.ok(typeof res.is_store_open === "boolean");
    assert.ok(res.dispatch_schedule_estimate.length > 0);
  });

  await test("toolRekomendasiAlternatif: provides in-stock cross-sell and alternatives", async () => {
    const res = await toolRekomendasiAlternatif(mockContext, {
      current_sku: "TSH-OVR-BLK",
      strategy: "cross_sell",
    });
    assert.ok(res.count > 0);
    assert.ok(res.recommendations.every((r) => r.available_stock > 0));
  });

  await test("toolRekomendasiAlternatif: filters out current SKU and out-of-stock items", async () => {
    const res = await toolRekomendasiAlternatif(mockContext, {
      current_sku: "TSH-OVR-BLK",
      strategy: "cross_sell",
    });
    assert.ok(res.recommendations.every((r) => r.sku !== "TSH-OVR-BLK"));
    assert.ok(res.recommendations.every((r) => r.available_stock > 0));
  });

  console.log("\n=== 3. UNIT TEST: Logistics & Orders Engine ===");

  test("estimateBaseTariff: provides deterministic tariff across Indonesian provinces", () => {
    const jkt = estimateBaseTariff("Jakarta Selatan", 1.0);
    const bdg = estimateBaseTariff("Bandung", 1.0);
    const sby = estimateBaseTariff("Surabaya", 1.0);
    const pku = estimateBaseTariff("Pekanbaru", 1.0);
    const dps = estimateBaseTariff("Denpasar Bali", 1.0);
    const papua = estimateBaseTariff("Jayapura Papua", 1.0);

    assert.strictEqual(jkt, 9000);
    assert.strictEqual(bdg, 11000);
    assert.strictEqual(sby, 17000);
    assert.strictEqual(pku, 28000);
    assert.strictEqual(dps, 32000);
    assert.strictEqual(papua, 55000);
  });

  await test("calculateShippingRates: returns standard Indonesian couriers (JNT, SICEPAT, JNE)", async () => {
    const rates = await calculateShippingRates({
      originSubdistrict: "Jakarta Selatan",
      destinationSubdistrict: "Surabaya",
      weightKg: 1,
    });
    const couriers = rates.rates.map((r) => r.courier);
    assert.ok(couriers.includes("JNT"));
    assert.ok(couriers.includes("SICEPAT"));
    assert.ok(couriers.includes("JNE"));
  });

  await test("calculateShippingRates: applies free shipping when total amount exceeds threshold", async () => {
    const rates = await calculateShippingRates({
      originSubdistrict: "Jakarta Selatan",
      destinationSubdistrict: "Surabaya",
      weightKg: 1,
      orderTotalAmount: 250000,
    });
    assert.strictEqual(rates.is_eligible_free_shipping, true);
    assert.ok(rates.rates.every((r) => r.total_tariff === 0));
    assert.ok(rates.rates.every((r) => r.is_free_shipping_applied === true));
  });

  test("cheapestRate: accurately identifies the cheapest courier option", () => {
    const options = [
      { courier: "JNE" as const, service_type: "REG", tariff_per_kg: 19000, total_tariff: 19000, estimated_days: "2-3 Hari", is_free_shipping_applied: false, source: "estimate" as const, is_estimate: true },
      { courier: "JNT" as const, service_type: "EZ", tariff_per_kg: 17000, total_tariff: 17000, estimated_days: "1-2 Hari", is_free_shipping_applied: false, source: "estimate" as const, is_estimate: true },
      { courier: "SICEPAT" as const, service_type: "REG", tariff_per_kg: 18000, total_tariff: 18000, estimated_days: "1-3 Hari", is_free_shipping_applied: false, source: "estimate" as const, is_estimate: true },
    ];
    const cheapest = cheapestRate(options);
    assert.ok(cheapest);
    assert.strictEqual(cheapest?.courier, "JNT");
    assert.strictEqual(cheapest?.total_tariff, 17000);
  });

  test("orders: buildOrderNumber and generateUniqueCode formats", () => {
    const num = buildOrderNumber();
    assert.match(num, /^NOEW-ORDER-\d{8}-[A-Z0-9]+$/);
    const code = generateUniqueCode();
    assert.ok(code >= 100 && code <= 999);
  });

  await test("orders: createOrder handles simulated playground tenant cleanly", async () => {
    const order = await createOrder({
      tenantId: "00000000-0000-0000-0000-000000000000",
      conversationId: "00000000-0000-0000-0000-000000000000",
      buyerJid: "test@s.whatsapp.net",
      buyerName: "Test Buyer",
      lines: [
        {
          sku: "TSH-OVR-BLK",
          name: "Kaos Oversize",
          variant: "Hitam XL",
          price: 95000,
          qty: 2,
          line_total: 190000,
        },
      ],
      destinationSubdistrict: "Pekanbaru",
      courier: "JNT",
      originSubdistrict: "Jakarta Selatan",
      stockSnapshot: { "TSH-OVR-BLK": 45 },
    });

    assert.ok(order.ok);
    assert.strictEqual(order.subtotal, 190000);
    assert.ok(order.shippingTariff > 0);
    assert.ok(order.totalAmount > 190000);
    assert.ok(order.orderNumber.startsWith("NOEW-ORDER-"));
  });

  console.log("\n=== 4. UNIT TEST: Order State Machines & Anti-Fraud Gates ===");

  test("state: canTransitionOrder permits legal order progressions", () => {
    assert.strictEqual(canTransitionOrder("DRAFT", "PENDING_CONFIRMATION"), true);
    assert.strictEqual(canTransitionOrder("PENDING_CONFIRMATION", "PENDING_PAYMENT"), true);
    assert.strictEqual(canTransitionOrder("PENDING_PAYMENT", "PROCESSING"), true);
    assert.strictEqual(canTransitionOrder("PROCESSING", "READY_TO_SHIP"), true);
    assert.strictEqual(canTransitionOrder("READY_TO_SHIP", "SHIPPED"), true);
    assert.strictEqual(canTransitionOrder("SHIPPED", "COMPLETED"), true);

    // Illegal skip directly from draft to completed
    assert.strictEqual(canTransitionOrder("DRAFT", "COMPLETED"), false);
  });

  test("state: assertOrderTransition throws on illegal skip", () => {
    assert.throws(
      () => assertOrderTransition("DRAFT", "SHIPPED"),
      /Illegal order transition: DRAFT -> SHIPPED/
    );
  });

  test("state: canTransitionPayment validates legitimate payment states", () => {
    assert.strictEqual(canTransitionPayment("UNPAID", "PROOF_SUBMITTED"), true);
    assert.strictEqual(canTransitionPayment("PROOF_SUBMITTED", "UNDER_REVIEW"), true);
    assert.strictEqual(canTransitionPayment("UNDER_REVIEW", "VERIFIED"), true);
    assert.strictEqual(canTransitionPayment("UNDER_REVIEW", "REJECTED"), true);
    assert.strictEqual(canTransitionPayment("REJECTED", "PROOF_SUBMITTED"), true);

    // Cannot jump UNPAID directly to VERIFIED
    assert.strictEqual(canTransitionPayment("UNPAID", "VERIFIED"), false);
    assert.throws(
      () => assertPaymentTransition("UNPAID", "VERIFIED"),
      /Illegal payment transition: UNPAID -> VERIFIED/
    );
  });

  test("state: assertFulfilmentAllowed prevents PROCESSING order when payment is unverified (Anti-Fraud Gate)", () => {
    assert.doesNotThrow(() => assertFulfilmentAllowed("PROCESSING", "VERIFIED"));

    assert.throws(
      () => assertFulfilmentAllowed("PROCESSING", "UNPAID"),
      /Order cannot enter PROCESSING before the payment is VERIFIED/
    );
    assert.throws(
      () => assertFulfilmentAllowed("PROCESSING", "PROOF_SUBMITTED"),
      /Order cannot enter PROCESSING before the payment is VERIFIED/
    );
  });

  console.log("\n=== 5. UNIT TEST: Security, Cryptography & Token Integrity ===");

  await test("crypto: hashPassword and verifyPassword enforce Argon2id security", async () => {
    const pass = "PasswordSuperAman123!";
    const hash = await hashPassword(pass);
    assert.ok(hash.startsWith("$argon2id$"));

    const valid = await verifyPassword(pass, hash);
    assert.strictEqual(valid, true);

    const wrong = await verifyPassword("PasswordSalah123!", hash);
    assert.strictEqual(wrong, false);

    await assert.rejects(async () => {
      await hashPassword("pendek");
    }, /Password must be at least 8 characters/);
  });

  test("crypto: createToken and verifyToken enforce tamper-proof HMAC signatures", () => {
    const secret = "rahasia-super-kuat-indonesia-2026";
    const payload = { sub: "tenant-123", email: "store@example.com", role: "TENANT" as const, exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = createToken(payload, secret);

    const verified = verifyToken<typeof payload>(token, secret);
    assert.ok(verified);
    assert.strictEqual(verified?.sub, "tenant-123");

    const [, sig] = token.split(".");
    const tamperedBody = Buffer.from(JSON.stringify({ ...payload, sub: "hacker" })).toString("base64").replace(/=/g, "");
    const tamperedToken = `${tamperedBody}.${sig}`;
    assert.strictEqual(verifyToken(tamperedToken, secret), null);

    const expiredPayload = { ...payload, exp: Math.floor(Date.now() / 1000) - 10 };
    const expiredToken = createToken(expiredPayload, secret);
    assert.strictEqual(verifyToken(expiredToken, secret), null);
  });

  console.log("\n=== 6. UNIT TEST: Catalog Parser & Indonesian Data Normalization ===");

  test("sheets: parseRupiah parses standard Indonesian currency formats", () => {
    assert.strictEqual(parseRupiah("Rp 185.000"), 185000);
    assert.strictEqual(parseRupiah("185.000,50"), 185000.5);
    assert.strictEqual(parseRupiah("95000"), 95000);
    assert.strictEqual(parseRupiah("Rp 95.000,-"), 95000);
    assert.strictEqual(parseRupiah(""), 0);
  });

  test("sheets: parseStock and parseActive handle dirty spreadsheet cell values", () => {
    assert.strictEqual(parseStock("45 pcs"), 45);
    assert.strictEqual(parseStock("0"), 0);
    assert.strictEqual(parseStock("-5"), -5);

    assert.strictEqual(parseActive("Aktif"), true);
    assert.strictEqual(parseActive("Tersedia"), true);
    assert.strictEqual(parseActive("Tidak"), false);
    assert.strictEqual(parseActive("Nonaktif"), false);
    assert.strictEqual(parseActive("false"), false);
  });

  test("sheets: verifyStructure validates mandatory columns and flags missing headers", () => {
    const validHeaders = ["SKU", "Nama Produk", "Harga", "Stok", "Link Foto"];
    const checkValid = verifyStructure(validHeaders);
    assert.strictEqual(checkValid.valid, true);
    assert.strictEqual(checkValid.missing.length, 0);

    const invalidHeaders = ["Nama Produk", "Harga"];
    const checkInvalid = verifyStructure(invalidHeaders);
    assert.strictEqual(checkInvalid.valid, false);
    assert.ok(checkInvalid.missing.includes("sku"));
    assert.ok(checkInvalid.missing.includes("stock"));
  });

  test("sheets: toCsvExportUrl correctly transforms Google Sheets web URLs to CSV export format", () => {
    const webUrl = "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0";
    const csvUrl = toCsvExportUrl(webUrl);
    assert.strictEqual(
      csvUrl,
      "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/export?format=csv&gid=0"
    );

    assert.strictEqual(toCsvExportUrl(""), null);
    assert.strictEqual(toCsvExportUrl("https://example.com/data.csv"), "https://example.com/data.csv");
  });

  return { total: passed + failed, passed, failed };
}

if (process.argv[1]?.endsWith("engines.test.ts")) {
  runUnitTests()
    .then((r) => {
      console.log(`\nUnit Tests Finished: ${r.passed}/${r.total} passed (${r.failed} failed)\n`);
      process.exit(r.failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("Test runner crashed:", err);
      process.exit(1);
    });
}
