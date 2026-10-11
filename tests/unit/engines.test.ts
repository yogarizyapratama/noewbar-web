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
import { calculateShippingRates } from "../../src/lib/logistics/shipping-engine";
import { buildOrderNumber, createOrder } from "../../src/lib/orders/orders";
import { generateUniqueCode } from "../../src/lib/crypto";
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

  console.log("\n=== 2. UNIT TEST: Micro Tools & Product Catalog ===");

  await test("toolCariProduk: finds products by keyword tokens and size", async () => {
    const res = await toolCariProduk(mockContext, { query: "kaos hitam XL" });
    assert.ok(res.matches.length > 0);
    assert.strictEqual(res.matches[0].sku, "TSH-OVR-BLK");
    assert.strictEqual(res.matches[0].price, 95000);
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

  await test("toolHitungPromoBundling: calculates multi-buy volume discounts", async () => {
    const res = await toolHitungPromoBundling(mockContext, {
      items: [{ sku: "TSH-OVR-BLK", qty: 3, price: 95000 }],
    });
    assert.strictEqual(res.total_qty, 3);
    assert.strictEqual(res.subtotal_before_discount, 285000);
    assert.strictEqual(res.discount_percent, 10);
    assert.strictEqual(res.discount_amount, 28500);
    assert.strictEqual(res.final_subtotal, 256500);
  });

  await test("toolCekJadwalPengiriman: returns store cut-off time and courier schedules", async () => {
    const res = await toolCekJadwalPengiriman(mockContext);
    assert.ok(res.current_time_wib.includes("WIB"));
    assert.ok(res.cut_off_time.includes("15.00"));
    assert.ok(res.courier_schedules.length >= 3);
  });

  await test("toolRekomendasiAlternatif: provides in-stock cross-sell and alternatives", async () => {
    const res = await toolRekomendasiAlternatif(mockContext, {
      current_sku: "TSH-OVR-BLK",
      strategy: "cross_sell",
    });
    assert.ok(res.count > 0);
    assert.ok(res.recommendations.every((r) => r.available_stock > 0));
  });

  console.log("\n=== 3. UNIT TEST: Logistics & Orders Engine ===");

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
