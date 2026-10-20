try {
  process.loadEnvFile();
} catch {
  // Ignore if already loaded or not present
}

import assert from "node:assert";
import prisma from "../../src/lib/prisma";
import { createToken, type SessionPayload, type AdminPayload } from "../../src/lib/crypto";
import { env } from "../../src/lib/env";
import { TENANT_COOKIE, ADMIN_COOKIE } from "../../src/lib/auth";

const BASE_URL = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";

/**
 * ============================================================================
 * FRONTEND FEATURES E2E TEST SUITE (USER & SUPERADMIN SURFACES)
 * ============================================================================
 * Menguji seluruh fitur antarmuka (frontend) dan API pendukungnya:
 * 1. Sisi User / Merchant & Publik:
 *    - Landing page & chat simulator playground
 *    - Halaman Login & Register
 *    - Dashboard KPI & Ringkasan Toko
 *    - Katalog Produk & AI (CRUD SKU, Varian, Harga, Stok)
 *    - AI Website Builder & Storefront Publik (/store/[slug])
 *    - AI Persona & Simulator Dashboard
 *    - Promosi & Pengiriman (Bundling, Jam cut-off, Gratis ongkir, Kupon)
 *    - Basis Dokumen & Rekening Toko
 *    - Pesanan & Bukti Bayar (Verifikasi owner)
 *    - Live Chat & Human Takeover (Ambil alih)
 *    - Koneksi WhatsApp & QR Status
 *    - Langganan & Billing (Paket PRO, Checkout)
 *
 * 2. Sisi Superadmin:
 *    - Auth guard superadmin
 *    - System health & infrastructure probes (Node, Memory, Redis, Daemon, AI Gateway)
 *    - Tenant fleet management (Filter, Search, Detail)
 *    - Onboarding tenant baru dari superadmin
 *    - Financials & Revenue analytics (MRR, ARR, GMV)
 *    - WhatsApp Fleet monitoring
 *    - Emergency Platform Killswitch
 */

export async function runFrontendAllFeaturesTests(): Promise<{ total: number; passed: number; failed: number }> {
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
  console.log("   NOEWBAR CS PRO - FRONTEND FEATURES E2E SUITE (USER & SUPERADMIN)            ");
  console.log("================================================================================");

  // 1. Setup Test Tenant untuk testing sesi dashboard user
  const FE_TENANT_ID = "33333333-4444-5555-6666-777777777777";
  const FE_EMAIL = "frontend-tester@noewbar.com";

  await prisma.website.deleteMany({ where: { tenant_id: FE_TENANT_ID } });
  await prisma.product.deleteMany({ where: { tenant_id: FE_TENANT_ID } });
  await prisma.order.deleteMany({ where: { tenant_id: FE_TENANT_ID } });
  await prisma.chatMessage.deleteMany({ where: { conversation: { tenant_id: FE_TENANT_ID } } });
  await prisma.conversation.deleteMany({ where: { tenant_id: FE_TENANT_ID } });
  await prisma.knowledgeDocument.deleteMany({ where: { tenant_id: FE_TENANT_ID } });
  await prisma.catalogSetting.deleteMany({ where: { tenant_id: FE_TENANT_ID } });
  await prisma.waInstance.deleteMany({ where: { tenant_id: FE_TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: FE_TENANT_ID } });

  const tenant = await prisma.tenant.create({
    data: {
      id: FE_TENANT_ID,
      email: FE_EMAIL,
      password_hash: "hash_frontend_tester_secure",
      business_name: "Noewbar Official Store",
      owner_name: "Frontend Master",
      owner_whatsapp: "081234567811",
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
          instance_key: "fe-inst-01",
          connection_status: "CONNECTED",
          phone_number: "6281234567811",
        },
      },
    },
  });

  const tenantToken = createToken<SessionPayload>(
    { sub: tenant.id, email: tenant.email, role: "TENANT", exp: Math.floor(Date.now() / 1000) + 86400 },
    env.NEXTAUTH_SECRET
  );
  const tenantCookieHeader = { Cookie: `${TENANT_COOKIE}=${tenantToken}` };

  const adminToken = createToken<AdminPayload>(
    { sub: "superadmin", email: env.SUPERADMIN_EMAIL, role: "SUPERADMIN", exp: Math.floor(Date.now() / 1000) + 86400 },
    env.NEXTAUTH_SECRET
  );
  const adminCookieHeader = { Cookie: `${ADMIN_COOKIE}=${adminToken}` };

  console.log("\n=== BAGIAN 1: PENGUJIAN FITUR SISI USER / MERCHANT & PUBLIK ===");

  // 1. Landing Page & Playground Simulator
  await test("FE 1.1: Landing page (/) merender UI publik lengkap (HTTP 200)", async () => {
    const res = await fetch(`${BASE_URL}/`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("Noewbar") || html.includes("Asisten"));
  });

  await test("FE 1.2: Chat Simulator Playground pada landing page berfungsi interaktif", async () => {
    const res = await fetch(`${BASE_URL}/api/playground`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Halo min, toko buka jam berapa?",
        history: [],
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.ok(typeof data.reply === "string" && data.reply.length > 5);
  });

  // 2. Halaman Login & Register
  await test("FE 2.1: Halaman Login (/login) merender form autentikasi", async () => {
    const res = await fetch(`${BASE_URL}/login`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("Masuk") || html.includes("Email") || html.includes("Password"));
  });

  await test("FE 2.2: Halaman Register (/register) merender form pendaftaran toko", async () => {
    const res = await fetch(`${BASE_URL}/register`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("Daftar") || html.includes("Nama Bisnis") || html.includes("WhatsApp"));
  });

  await test("FE 2.3: Validasi form register menolak password kurang dari 8 karakter", async () => {
    const res = await fetch(`${BASE_URL}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "register",
        email: "short-pass@example.com",
        password: "123",
        business_name: "Toko Pendek",
        owner_name: "Owner",
        owner_whatsapp: "081234567899",
      }),
    });
    assert.strictEqual(res.status, 422);
    const data = await res.json();
    assert.strictEqual(data.ok, false);
  });

  // 3. Dashboard Utama & Status KPI Toko
  await test("FE 3.1: Dashboard (/dashboard) dapat diakses dengan sesi merchant (HTTP 200)", async () => {
    const res = await fetch(`${BASE_URL}/dashboard`, { headers: tenantCookieHeader });
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("Dashboard") || html.includes("Noewbar"));
  });

  await test("FE 3.2: API Dashboard (/api/dashboard) menyajikan data KPI & konfigurasi toko", async () => {
    const res = await fetch(`${BASE_URL}/api/dashboard`, { headers: tenantCookieHeader });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.ok(data.catalog);
    assert.ok(data.shipping);
  });

  // 4. Fitur Katalog Produk & AI (CRUD)
  let createdProductId = "";
  await test("FE 4.1: Panel Produk - Menambahkan produk baru lengkap dengan varian dan harga", async () => {
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tenantCookieHeader },
      body: JSON.stringify({
        action: "create",
        sku: "TSH-TEST-01",
        name: "Kaos Polo Premium Katun",
        category: "Pakaian Pria",
        price: 125000,
        discount_price: 110000,
        stock: 30,
        description: "Kaos polo katun combed adem dan elegan.",
        variants: [{ name: "Hitam", options: ["M", "L", "XL"] }],
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.ok(data.product?.id);
    createdProductId = data.product.id;
  });

  await test("FE 4.2: Panel Produk - Membaca daftar produk toko", async () => {
    const res = await fetch(`${BASE_URL}/api/products`, { headers: tenantCookieHeader });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.ok(Array.isArray(data.products));
    const found = data.products.find((p: any) => p.sku === "TSH-TEST-01");
    assert.ok(found, "Produk TSH-TEST-01 harus ditemukan di daftar");
  });

  await test("FE 4.3: Panel Produk - Mengubah stok & harga produk", async () => {
    assert.ok(createdProductId);
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tenantCookieHeader },
      body: JSON.stringify({
        action: "update",
        id: createdProductId,
        price: 120000,
        stock: 25,
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);

    const updated = await prisma.product.findUnique({ where: { id: createdProductId } });
    assert.ok(updated);
    assert.strictEqual(Number(updated.price), 120000);
    assert.strictEqual(updated.stock, 25);
  });

  await test("FE 4.4 [NEGATIVE]: Panel Produk - Menolak tambah produk dengan SKU atau nama kosong (HTTP 400)", async () => {
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tenantCookieHeader },
      body: JSON.stringify({
        action: "create",
        name: "",
        sku: "",
        price: 10000,
      }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.ok, false);
  });

  await test("FE 4.5 [NEGATIVE]: Panel Produk - Menolak update pada produk yang tidak ada (HTTP 404)", async () => {
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tenantCookieHeader },
      body: JSON.stringify({
        action: "update",
        id: "00000000-0000-0000-0000-000000000000",
        price: 50000,
      }),
    });
    assert.strictEqual(res.status, 404);
  });

  // 5. Fitur AI Website Builder & Storefront Publik
  const testStoreSlug = "toko-noewbar-fe-test";
  let publishedSlug = testStoreSlug;
  await test("FE 5.1: Panel Website Builder - Menyimpan & mempublikasikan website toko online", async () => {
    const res = await fetch(`${BASE_URL}/api/websites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tenantCookieHeader },
      body: JSON.stringify({
        action: "create",
        name: "Noewbar Official Store",
        slug: testStoreSlug,
        template_id: "modern-minimal",
        replace_existing: true,
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.ok(data.website?.id);

    const pubRes = await fetch(`${BASE_URL}/api/websites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tenantCookieHeader },
      body: JSON.stringify({
        action: "publish",
        id: data.website.id,
      }),
    });
    assert.strictEqual(pubRes.status, 200);
    const pubData = await pubRes.json();
    assert.strictEqual(pubData.ok, true);
    publishedSlug = pubData.slug || data.website.slug;
  });

  await test("FE 5.2: Storefront Publik (/store/[slug]) dapat diakses pembeli umum secara live", async () => {
    const res = await fetch(`${BASE_URL}/store/${publishedSlug}`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.toLowerCase().includes("noewbar") || html.toLowerCase().includes("official"));
  });

  await test("FE 5.3 [NEGATIVE]: Panel Website Builder - Menolak publish website dengan ID tidak ditemukan (HTTP 404)", async () => {
    const res = await fetch(`${BASE_URL}/api/websites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tenantCookieHeader },
      body: JSON.stringify({
        action: "publish",
        id: "00000000-0000-0000-0000-000000000000",
      }),
    });
    assert.strictEqual(res.status, 404);
  });

  // 6. Fitur AI Persona & Simulator Dashboard
  await test("FE 6.1: Panel Simulator - Eksekusi simulasi chat AI internal dashboard", async () => {
    const res = await fetch(`${BASE_URL}/api/simulator`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tenantCookieHeader },
      body: JSON.stringify({
        message: "Halo, kaos polo ready ukuran apa aja?",
        history: [],
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.ok(typeof data.reply === "string" && data.reply.length > 5);
  });

  // 7. Fitur Promosi & Pengiriman
  await test("FE 7.1: Panel Promosi - Mengatur jam operasional dan cut-off pengiriman", async () => {
    const res = await fetch(`${BASE_URL}/api/dashboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tenantCookieHeader },
      body: JSON.stringify({
        action: "save_shipping_schedule",
        shipping_cut_off_hour: 16,
        free_shipping_enabled: true,
        free_shipping_min_amount: 150000,
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.shipping_schedule.cut_off_hour, 16);
    assert.strictEqual(data.shipping_schedule.free_shipping_enabled, true);
  });

  await test("FE 7.2: Panel Promosi - Menyimpan aturan promo diskon kuantitas & voucher kupon toko", async () => {
    const res = await fetch(`${BASE_URL}/api/dashboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tenantCookieHeader },
      body: JSON.stringify({
        action: "save_promos",
        promo_rules: [
          { min_qty: 3, discount_percent: 10, promo_name: "Beli 3 Diskon 10%" },
        ],
        voucher_rules: [
          { code: "HEMAT20K", discount_amount: 20000 },
        ],
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.action, "save_promos");
    assert.ok(Array.isArray(data.promo_rules) && data.promo_rules.length >= 1);
  });

  // 8. Fitur Basis Dokumen & Knowledge Base
  await test("FE 8.1: Panel Basis Dokumen - Menambahkan dokumen SOP / FAQ toko", async () => {
    const res = await fetch(`${BASE_URL}/api/knowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tenantCookieHeader },
      body: JSON.stringify({
        action: "save",
        title: "Kebijakan Retur Barang Cacat",
        doc_type: "POLICY",
        content_text: "Barang cacat produksi dapat ditukar dalam 3 hari setelah diterima kurir dengan menyertakan video unboxing utuh.",
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.ok(data.id);
  });

  await test("FE 8.2 [NEGATIVE]: Panel Basis Dokumen - Menolak dokumen dengan doc_type ilegal (HTTP 422)", async () => {
    const res = await fetch(`${BASE_URL}/api/knowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tenantCookieHeader },
      body: JSON.stringify({
        action: "save",
        title: "Dokumen Ilegal",
        doc_type: "INVALID_DOC_TYPE",
        content_text: "Konten dokumen",
      }),
    });
    assert.strictEqual(res.status, 422);
  });

  // 9. Fitur Pesanan & Verifikasi Bukti Bayar
  let testOrderId = "";
  await test("FE 9.1: Panel Pesanan - Menampilkan daftar pesanan masuk", async () => {
    const conv = await prisma.conversation.create({
      data: {
        tenant_id: FE_TENANT_ID,
        buyer_jid: "6287711223344@s.whatsapp.net",
        buyer_name: "Buyer Verifikasi",
        pipeline_stage: "ORDER_CREATED",
      },
    });

    const order = await prisma.order.create({
      data: {
        tenant_id: FE_TENANT_ID,
        conversation_id: conv.id,
        buyer_jid: "6287711223344@s.whatsapp.net",
        buyer_name: "Buyer Verifikasi",
        order_number: "NOEW-TEST-ORDER-001",
        order_status: "PENDING_PAYMENT",
        payment_status: "PROOF_SUBMITTED",
        items: [{ sku: "TSH-TEST-01", qty: 1, price: 120000, line_total: 120000 }],
        subtotal: 120000,
        shipping_tariff: 10000,
        unique_code: 321,
        total_amount: 130321,
        courier: "JNT",
        destination_subdistrict: "Cilandak, Jakarta Selatan",
      },
    });
    testOrderId = order.id;

    const res = await fetch(`${BASE_URL}/api/orders`, { headers: tenantCookieHeader });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.ok(Array.isArray(data.orders));
    assert.ok(data.orders.some((o: any) => o.id === testOrderId));
  });

  await test("FE 9.2: Panel Pesanan - Owner toko memverifikasi pembayaran pembeli (Approve Payment)", async () => {
    assert.ok(testOrderId);
    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tenantCookieHeader },
      body: JSON.stringify({
        action: "verify",
        order_id: testOrderId,
        approve: true,
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.payment_status, "VERIFIED");
    assert.strictEqual(data.order_status, "PROCESSING");
  });

  await test("FE 9.3 [NEGATIVE]: Panel Pesanan - Menolak verifikasi pada order ID yang tidak ada (HTTP 404)", async () => {
    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tenantCookieHeader },
      body: JSON.stringify({
        action: "verify",
        order_id: "00000000-0000-0000-0000-000000000000",
        approve: true,
      }),
    });
    assert.strictEqual(res.status, 404);
  });

  // 10. Fitur Live Chat & Human Takeover
  await test("FE 10.1: Panel Chat - Owner toko mengambil alih percakapan (Human Takeover ON/OFF)", async () => {
    const conv = await prisma.conversation.findFirst({ where: { tenant_id: FE_TENANT_ID } });
    assert.ok(conv);

    // Ambil alih chat
    const resOn = await fetch(`${BASE_URL}/api/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tenantCookieHeader },
      body: JSON.stringify({
        action: "takeover",
        conversation_id: conv.id,
        enabled: true,
      }),
    });
    assert.strictEqual(resOn.status, 200);
    const dataOn = await resOn.json();
    assert.strictEqual(dataOn.ok, true);
    assert.strictEqual(dataOn.conversation.is_human_takeover, true);

    // Lepas kembali ke bot
    const resOff = await fetch(`${BASE_URL}/api/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tenantCookieHeader },
      body: JSON.stringify({
        action: "takeover",
        conversation_id: conv.id,
        enabled: false,
      }),
    });
    assert.strictEqual(resOff.status, 200);
    const dataOff = await resOff.json();
    assert.strictEqual(dataOff.ok, true);
    assert.strictEqual(dataOff.conversation.is_human_takeover, false);
  });

  await test("FE 10.2 [NEGATIVE]: Panel Chat - Menolak takeover pada conversation ID yang tidak ada (HTTP 404)", async () => {
    const res = await fetch(`${BASE_URL}/api/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tenantCookieHeader },
      body: JSON.stringify({
        action: "takeover",
        conversation_id: "00000000-0000-0000-0000-000000000000",
        enabled: true,
      }),
    });
    assert.strictEqual(res.status, 404);
  });

  // 11. Fitur Koneksi WhatsApp & Billing
  await test("FE 11.1: Panel WhatsApp - Memeriksa status pairing & QR instance toko", async () => {
    const res = await fetch(`${BASE_URL}/api/wa/qr`, { headers: tenantCookieHeader });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.strictEqual(typeof data.daemon_reachable, "boolean");
    assert.ok(data.instance);
    assert.strictEqual(data.instance.connection_status, "CONNECTED");
  });

  await test("FE 11.2: Panel Billing - Menampilkan status langganan & paket harga PRO", async () => {
    const res = await fetch(`${BASE_URL}/api/billing/checkout`, { headers: tenantCookieHeader });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.ok(data.subscription);
    assert.ok(Array.isArray(data.plans));
    assert.strictEqual(data.plans.length, 2);
  });

  await test("FE 11.3: Panel Billing - Membuat checkout order langganan PRO", async () => {
    const res = await fetch(`${BASE_URL}/api/billing/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tenantCookieHeader },
      body: JSON.stringify({ plan: "PRO_MONTHLY" }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.ok(data.order_id);
    assert.ok(data.amount > 0);
  });

  console.log("\n=== BAGIAN 2: PENGUJIAN FITUR SISI SUPERADMIN ===");

  // 12. Superadmin Auth Guard
  await test("FE 12.1: Portal Superadmin (/superadmin) dilindungi otentikasi ketat", async () => {
    const unauthRes = await fetch(`${BASE_URL}/api/superadmin`);
    assert.strictEqual(unauthRes.status, 401, "Akses tanpa kredensial admin harus ditolak");

    const authRes = await fetch(`${BASE_URL}/superadmin`, { headers: adminCookieHeader });
    assert.strictEqual(authRes.status, 200, "Superadmin terotentikasi dapat mengakses portal");
    const html = await authRes.text();
    assert.ok(html.toLowerCase().includes("superadmin"));
  });

  // 13. System Health & Infrastructure Monitoring
  await test("FE 13.1: Superadmin - Memeriksa probe kesehatan infrastruktur (Node, Memory, Redis, Daemon, AI Gateway)", async () => {
    const res = await fetch(`${BASE_URL}/api/superadmin`, { headers: adminCookieHeader });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.ok(data.system_stats, "System stats harus tersedia");
    assert.ok(data.system_stats.uptime_seconds >= 0);
    assert.ok(data.gateway, "AI Gateway health probe harus tersedia");
    assert.ok(data.daemon, "WhatsMeow Daemon health probe harus tersedia");
    assert.strictEqual(typeof data.redis, "boolean");
  });

  // 14. Tenant Fleet Management
  await test("FE 14.1: Superadmin - Membaca daftar tenant & memfilter berdasarkan status", async () => {
    const res = await fetch(`${BASE_URL}/api/superadmin?status=ACTIVE&page=1&limit=10`, { headers: adminCookieHeader });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.ok(Array.isArray(data.tenants));
    assert.ok(data.tenants.length >= 1);
  });

  await test("FE 14.2: Superadmin - Pencarian tenant berdasarkan nama bisnis atau email", async () => {
    const res = await fetch(`${BASE_URL}/api/superadmin?q=Noewbar&page=1&limit=5`, { headers: adminCookieHeader });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.ok(data.tenants.some((t: any) => t.business_name.includes("Noewbar")));
  });

  // 15. Onboarding Tenant Baru oleh Superadmin
  const NEW_ONBOARD_EMAIL = `superadmin-onboard-${Date.now()}@noewbar.com`;
  await test("FE 15.1: Superadmin - Onboarding tenant baru secara langsung dari konsol admin", async () => {
    const res = await fetch(`${BASE_URL}/api/superadmin`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...adminCookieHeader },
      body: JSON.stringify({
        action: "create_tenant",
        business_name: "Toko Onboarding Superadmin",
        owner_name: "Mitra Baru",
        email: NEW_ONBOARD_EMAIL,
        password: "PasswordSuperKuat2026!",
        owner_whatsapp: "081299887766",
        status: "ACTIVE",
        trial_days: 30,
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.ok(data.tenant_id);

    // Bersihkan tenant uji baru
    await prisma.waInstance.deleteMany({ where: { tenant_id: data.tenant_id } });
    await prisma.catalogSetting.deleteMany({ where: { tenant_id: data.tenant_id } });
    await prisma.tenant.deleteMany({ where: { id: data.tenant_id } });
  });

  await test("FE 15.2 [NEGATIVE]: Superadmin - Menolak onboarding tenant baru jika email invalid (HTTP 400/422)", async () => {
    const res = await fetch(`${BASE_URL}/api/superadmin`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...adminCookieHeader },
      body: JSON.stringify({
        action: "create_tenant",
        business_name: "Toko Gagal Onboard",
        owner_name: "Owner",
        email: "email-rusak-tanpa-domain",
        password: "PasswordSuperKuat2026!",
        owner_whatsapp: "081299887766",
        status: "ACTIVE",
        trial_days: 30,
      }),
    });
    assert.ok(res.status === 400 || res.status === 422);
  });

  // 16. Financials & Revenue Analytics
  await test("FE 16.1: Superadmin - Menampilkan analitik finansial (MRR, ARR, GMV, Total Pelanggan Aktif)", async () => {
    const res = await fetch(`${BASE_URL}/api/superadmin`, { headers: adminCookieHeader });
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.ok(data.financial_metrics);
    assert.strictEqual(typeof data.financial_metrics.mrr, "number");
    assert.strictEqual(typeof data.financial_metrics.arr, "number");
    assert.strictEqual(typeof data.financial_metrics.gmv, "number");
    assert.strictEqual(typeof data.financial_metrics.active_subscribers, "number");
  });

  // 17. WhatsApp Fleet Control
  await test("FE 17.1: Superadmin - Memantau seluruh armada koneksi WhatsMeow (Fleet Control)", async () => {
    const res = await fetch(`${BASE_URL}/api/superadmin`, { headers: adminCookieHeader });
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.ok(Array.isArray(data.fleet));
  });

  // 18. Emergency Platform Killswitch
  await test("FE 18.1: Superadmin - Memeriksa status Platform Killswitch", async () => {
    const res = await fetch(`${BASE_URL}/api/superadmin`, { headers: adminCookieHeader });
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.ok(data.kill_switch);
    assert.strictEqual(typeof data.kill_switch.disabled, "boolean");
  });

  // Cleanup test tenant
  await prisma.website.deleteMany({ where: { tenant_id: FE_TENANT_ID } });
  await prisma.product.deleteMany({ where: { tenant_id: FE_TENANT_ID } });
  await prisma.order.deleteMany({ where: { tenant_id: FE_TENANT_ID } });
  await prisma.chatMessage.deleteMany({ where: { conversation: { tenant_id: FE_TENANT_ID } } });
  await prisma.conversation.deleteMany({ where: { tenant_id: FE_TENANT_ID } });
  await prisma.knowledgeDocument.deleteMany({ where: { tenant_id: FE_TENANT_ID } });
  await prisma.catalogSetting.deleteMany({ where: { tenant_id: FE_TENANT_ID } });
  await prisma.waInstance.deleteMany({ where: { tenant_id: FE_TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: FE_TENANT_ID } });

  console.log("\n================================================================================");
  console.log(`  HASIL FRONTEND FEATURES: ${passed}/${passed + failed} passed (${failed} failed)`);
  console.log("================================================================================\n");

  return { total: passed + failed, passed, failed };
}

if (process.argv[1]?.endsWith("frontend-all-features.test.ts")) {
  runFrontendAllFeaturesTests()
    .then((r) => {
      process.exit(r.failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("Frontend features test runner crashed:", err);
      process.exit(1);
    });
}
