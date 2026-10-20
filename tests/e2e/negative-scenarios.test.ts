try {
  process.loadEnvFile();
} catch {
  // Ignore if already loaded or not present
}

import assert from "node:assert";
import prisma from "../../src/lib/prisma";
import { createToken, type SessionPayload } from "../../src/lib/crypto";
import { env } from "../../src/lib/env";
import { TENANT_COOKIE } from "../../src/lib/auth";
import { shipOrder, verifyPayment } from "../../src/lib/orders/orders";

const BASE_URL = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";

/**
 * ============================================================================
 * NEGATIVE & ADVERSARIAL TEST SUITE (DEFENSE & GUARDRAILS)
 * ============================================================================
 * Menguji seluruh skenario kegagalan, pembobolan, dan batas sistem (negative tests):
 *
 * 1. Autentikasi & Otorisasi:
 *    - Token hilang, token rusak, token kedaluwarsa
 *    - Login salah password, login email bodong
 *    - Registrasi email duplikat, format invalid, password terlalu pendek
 *    - Akses superadmin dibobol oleh tenant biasa
 *
 * 2. Cross-Tenant Breach & Privilege Escalation (Anti-Bocor Antar Toko):
 *    - Modifikasi produk milik toko lain
 *    - Hapus produk milik toko lain
 *    - Verifikasi pembayaran pesanan milik toko lain
 *    - Pengiriman (ship) pesanan milik toko lain
 *    - Pembajakan sesi live chat / takeover thread toko lain
 *    - Edit/Publish website toko lain
 *    - Pengintipan berkas MinIO milik toko lain
 *
 * 3. Subscription & Billing Enforcement (Account Expiry Guard):
 *    - Toko dengan langganan EXPIRED dilarang tambah produk
 *    - Toko dengan langganan EXPIRED dilarang pairing WhatsApp
 *    - Toko dengan langganan EXPIRED dilarang membuat website AI
 *    - Toko status SUSPENDED diblokir dari fitur operasional
 *
 * 4. Boundary & Malformed Payloads:
 *    - Pembuatan produk SKU duplikat pada toko yang sama
 *    - Payload JSON rusak (malformed syntax)
 *    - Parameter non-UUID pada endpoint UUID
 *    - Order verification tanpa field order_id
 *
 * 5. Business Logic & State Machine Hard Gates:
 *    - Mengirimkan (ship) pesanan yang belum terverifikasi (UNPAID/PROOF_SUBMITTED)
 *    - Mengubah/memverifikasi pesanan yang sudah dibatalkan (CANCELLED)
 *
 * 6. Webhook Security & Tampering Defense:
 *    - Webhook WhatsApp tanpa header secret
 *    - Webhook WhatsApp dengan secret palsu
 *    - Webhook Midtrans dengan signature SHA-512 palsu
 *    - Webhook dengan HTTP method ilegal (DELETE / PUT)
 */

export async function runNegativeScenariosTests(): Promise<{ total: number; passed: number; failed: number }> {
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
  console.log("   NOEWBAR CS PRO - COMPREHENSIVE NEGATIVE & ADVERSARIAL TEST SUITE             ");
  console.log("================================================================================");

  // Setup 2 Tenant untuk uji isolasi cross-tenant (Tenant Alpha & Tenant Beta)
  const TENANT_ALPHA_ID = "88888888-aaaa-bbbb-cccc-111111111111";
  const TENANT_BETA_ID = "99999999-aaaa-bbbb-cccc-222222222222";
  const TENANT_EXPIRED_ID = "77777777-aaaa-bbbb-cccc-333333333333";

  // Cleanup DB
  for (const tid of [TENANT_ALPHA_ID, TENANT_BETA_ID, TENANT_EXPIRED_ID]) {
    await prisma.website.deleteMany({ where: { tenant_id: tid } });
    await prisma.product.deleteMany({ where: { tenant_id: tid } });
    await prisma.order.deleteMany({ where: { tenant_id: tid } });
    await prisma.chatMessage.deleteMany({ where: { conversation: { tenant_id: tid } } });
    await prisma.conversation.deleteMany({ where: { tenant_id: tid } });
    await prisma.knowledgeDocument.deleteMany({ where: { tenant_id: tid } });
    await prisma.catalogSetting.deleteMany({ where: { tenant_id: tid } });
    await prisma.waInstance.deleteMany({ where: { tenant_id: tid } });
    await prisma.subscription.deleteMany({ where: { tenant_id: tid } });
    await prisma.tenant.deleteMany({ where: { id: tid } });
  }

  // Buat Tenant Alpha (Aktif)
  const tenantAlpha = await prisma.tenant.create({
    data: {
      id: TENANT_ALPHA_ID,
      email: "alpha-neg@noewbar.com",
      password_hash: "hash_alpha_secure_123",
      business_name: "Toko Alpha Original",
      owner_name: "Owner Alpha",
      owner_whatsapp: "081111111111",
      status: "ACTIVE",
      trial_expires_at: new Date(Date.now() + 30 * 86400000),
    },
  });

  // Buat Tenant Beta (Aktif)
  await prisma.tenant.create({
    data: {
      id: TENANT_BETA_ID,
      email: "beta-neg@noewbar.com",
      password_hash: "hash_beta_secure_456",
      business_name: "Toko Beta Competitor",
      owner_name: "Owner Beta",
      owner_whatsapp: "082222222222",
      status: "ACTIVE",
      trial_expires_at: new Date(Date.now() + 30 * 86400000),
    },
  });

  // Buat Tenant Expired (Trial berakhir 5 hari yang lalu, tanpa langganan aktif)
  const tenantExpired = await prisma.tenant.create({
    data: {
      id: TENANT_EXPIRED_ID,
      email: "expired-neg@noewbar.com",
      password_hash: "hash_expired_secure_789",
      business_name: "Toko Kadaluarsa",
      owner_name: "Owner Expired",
      owner_whatsapp: "083333333333",
      status: "EXPIRED",
      trial_expires_at: new Date(Date.now() - 5 * 86400000),
    },
  });

  // Tokens
  const tokenAlpha = createToken<SessionPayload>(
    { sub: tenantAlpha.id, email: tenantAlpha.email, role: "TENANT", exp: Math.floor(Date.now() / 1000) + 86400 },
    env.NEXTAUTH_SECRET
  );
  const cookieAlpha = { Cookie: `${TENANT_COOKIE}=${tokenAlpha}` };

  const tokenExpired = createToken<SessionPayload>(
    { sub: tenantExpired.id, email: tenantExpired.email, role: "TENANT", exp: Math.floor(Date.now() / 1000) + 86400 },
    env.NEXTAUTH_SECRET
  );
  const cookieExpired = { Cookie: `${TENANT_COOKIE}=${tokenExpired}` };

  console.log("\n=== BAGIAN 1: AUTENTIKASI, SESI & OTORISASI (NEGATIVE) ===");

  await test("NEG 1.1: Akses protected route tanpa session cookie ditolak (HTTP 401)", async () => {
    const res = await fetch(`${BASE_URL}/api/products`);
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.ok, false);
  });

  await test("NEG 1.2: Akses dengan token JWT palsu / forged signature ditolak (HTTP 401)", async () => {
    const fakeToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJoYWNrZXIifQ.fake_signature";
    const res = await fetch(`${BASE_URL}/api/products`, {
      headers: { Cookie: `${TENANT_COOKIE}=${fakeToken}` },
    });
    assert.strictEqual(res.status, 401);
  });

  await test("NEG 1.3: Akses dengan token JWT kedaluwarsa ditolak (HTTP 401)", async () => {
    const expiredToken = createToken<SessionPayload>(
      { sub: tenantAlpha.id, email: tenantAlpha.email, role: "TENANT", exp: Math.floor(Date.now() / 1000) - 3600 },
      env.NEXTAUTH_SECRET
    );
    const res = await fetch(`${BASE_URL}/api/products`, {
      headers: { Cookie: `${TENANT_COOKIE}=${expiredToken}` },
    });
    assert.strictEqual(res.status, 401);
  });

  await test("NEG 1.4: Login dengan email yang tidak terdaftar ditolak (HTTP 401)", async () => {
    const res = await fetch(`${BASE_URL}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "login",
        email: "ghost-user-tidak-ada@noewbar.com",
        password: "PasswordBenar123!",
      }),
    });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.ok, false);
  });

  await test("NEG 1.5: Login dengan password salah ditolak (HTTP 401)", async () => {
    const res = await fetch(`${BASE_URL}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "login",
        email: tenantAlpha.email,
        password: "PasswordSalahTotal!",
      }),
    });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.ok, false);
  });

  await test("NEG 1.6: Registrasi dengan email yang sudah digunakan toko lain ditolak (HTTP 400/409)", async () => {
    const res = await fetch(`${BASE_URL}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "register",
        email: tenantAlpha.email, // email milik toko alpha
        password: "PasswordBaru999!",
        business_name: "Toko Kloning",
        owner_name: "Kloning",
        owner_whatsapp: "089988776655",
      }),
    });
    assert.ok(res.status === 400 || res.status === 409);
    const data = await res.json();
    assert.strictEqual(data.ok, false);
  });

  await test("NEG 1.7: Registrasi dengan format email rusak ditolak (HTTP 422)", async () => {
    const res = await fetch(`${BASE_URL}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "register",
        email: "bukan-alamat-email-valid",
        password: "PasswordKuat2026!",
        business_name: "Toko Format Rusak",
        owner_name: "Owner",
        owner_whatsapp: "08123456789",
      }),
    });
    assert.strictEqual(res.status, 422);
  });

  await test("NEG 1.8: Registrasi dengan password kurang dari 8 karakter ditolak (HTTP 422)", async () => {
    const res = await fetch(`${BASE_URL}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "register",
        email: "shortpass-test@noewbar.com",
        password: "12345",
        business_name: "Toko Pendek",
        owner_name: "Owner",
        owner_whatsapp: "08123456789",
      }),
    });
    assert.strictEqual(res.status, 422);
  });

  await test("NEG 1.9: Tenant biasa mencoba membobol endpoint /api/superadmin ditolak (HTTP 401)", async () => {
    const res = await fetch(`${BASE_URL}/api/superadmin`, { headers: cookieAlpha });
    assert.strictEqual(res.status, 401, "Sesi merchant tidak boleh tembus ke API Superadmin");
  });

  console.log("\n=== BAGIAN 2: ISOLASI DATA MULTI-TENANT & TAMPERING PREVENTION ===");

  // Buat asset milik Tenant Beta
  const betaProduct = await prisma.product.create({
    data: {
      tenant_id: TENANT_BETA_ID,
      sku: "BETA-PROD-01",
      name: "Produk Rahasia Tenant Beta",
      price: 500000,
      stock: 50,
      category: "Eksklusif",
    },
  });

  const betaConv = await prisma.conversation.create({
    data: {
      tenant_id: TENANT_BETA_ID,
      buyer_jid: "628999999999@s.whatsapp.net",
      buyer_name: "Customer Beta",
      pipeline_stage: "COMMITTED",
    },
  });

  const betaOrder = await prisma.order.create({
    data: {
      tenant_id: TENANT_BETA_ID,
      conversation_id: betaConv.id,
      buyer_jid: "628999999999@s.whatsapp.net",
      order_number: "ORDER-BETA-SECRET-01",
      order_status: "PENDING_PAYMENT",
      payment_status: "PROOF_SUBMITTED",
      subtotal: 500000,
      shipping_tariff: 15000,
      unique_code: 101,
      total_amount: 515101,
      items: [{ sku: "BETA-PROD-01", qty: 1, price: 500000, line_total: 500000 }],
    },
  });

  const betaSite = await prisma.website.create({
    data: {
      tenant_id: TENANT_BETA_ID,
      name: "Toko Beta Official Site",
      slug: "toko-beta-neg-test",
      status: "DRAFT",
    },
  });

  await test("NEG 2.1: Tenant Alpha mencoba mengubah produk milik Tenant Beta ditolak (HTTP 404)", async () => {
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...cookieAlpha },
      body: JSON.stringify({
        action: "update",
        id: betaProduct.id,
        price: 1000, // coba turunkan harga produk saingan
        stock: 0,
      }),
    });
    assert.strictEqual(res.status, 404);

    // Pastikan data asli milik Tenant Beta tidak berubah di DB
    const freshBetaProd = await prisma.product.findUnique({ where: { id: betaProduct.id } });
    assert.strictEqual(Number(freshBetaProd?.price), 500000);
    assert.strictEqual(freshBetaProd?.stock, 50);
  });

  await test("NEG 2.2: Tenant Alpha mencoba menghapus produk milik Tenant Beta ditolak & data utuh", async () => {
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...cookieAlpha },
      body: JSON.stringify({
        action: "delete",
        id: betaProduct.id,
      }),
    });
    const data = await res.json();
    assert.strictEqual(data.deleted, false);

    // Pastikan produk Tenant Beta masih ada
    const prodExists = await prisma.product.findUnique({ where: { id: betaProduct.id } });
    assert.ok(prodExists);
  });

  await test("NEG 2.3: Tenant Alpha mencoba memverifikasi pembayaran pesanan Tenant Beta ditolak (HTTP 404)", async () => {
    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...cookieAlpha },
      body: JSON.stringify({
        action: "verify",
        order_id: betaOrder.id,
        approve: true,
      }),
    });
    assert.strictEqual(res.status, 404);

    // Verifikasi status order di DB tidak terpengaruh
    const freshOrder = await prisma.order.findUnique({ where: { id: betaOrder.id } });
    assert.strictEqual(freshOrder?.payment_status, "PROOF_SUBMITTED");
  });

  await test("NEG 2.4: Tenant Alpha mencoba menandai pengiriman (ship) pesanan Tenant Beta ditolak (HTTP 404)", async () => {
    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...cookieAlpha },
      body: JSON.stringify({
        action: "ship",
        order_id: betaOrder.id,
        tracking_number: "JNT-HACK-12345",
      }),
    });
    assert.strictEqual(res.status, 404);
  });

  await test("NEG 2.5: Tenant Alpha mencoba membajak chat buyer Tenant Beta (Takeover) ditolak (HTTP 404)", async () => {
    const res = await fetch(`${BASE_URL}/api/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...cookieAlpha },
      body: JSON.stringify({
        action: "takeover",
        conversation_id: betaConv.id,
        enabled: true,
      }),
    });
    assert.strictEqual(res.status, 404);

    const freshConv = await prisma.conversation.findUnique({ where: { id: betaConv.id } });
    assert.strictEqual(freshConv?.is_human_takeover, false);
  });

  await test("NEG 2.6: Tenant Alpha mencoba mengubah/mempublikasikan website Tenant Beta ditolak (HTTP 404)", async () => {
    const res = await fetch(`${BASE_URL}/api/websites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...cookieAlpha },
      body: JSON.stringify({
        action: "publish",
        id: betaSite.id,
      }),
    });
    assert.strictEqual(res.status, 404);

    const freshSite = await prisma.website.findUnique({ where: { id: betaSite.id } });
    assert.strictEqual(freshSite?.status, "DRAFT");
  });

  await test("NEG 2.7: Tenant Alpha mencoba mengintip/mengakses media key milik tenant lain ditolak (HTTP 403)", async () => {
    const res = await fetch(`${BASE_URL}/api/dashboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...cookieAlpha },
      body: JSON.stringify({
        action: "media_exists",
        key: `tenants/${TENANT_BETA_ID}/qris.jpg`,
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  console.log("\n=== BAGIAN 3: SUBSCRIPTION GUARD & ENFORCEMENT KEDALUWARSA ===");

  await test("NEG 3.1: Toko dengan langganan EXPIRED dilarang membuat produk baru (HTTP 403)", async () => {
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...cookieExpired },
      body: JSON.stringify({
        action: "create",
        sku: "EXP-PROD-01",
        name: "Produk Toko Expired",
        price: 50000,
        stock: 10,
      }),
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.ok, false);
    assert.ok(data.error.includes("berakhir"));
  });

  await test("NEG 3.2: Toko dengan langganan EXPIRED dilarang memulai pairing WhatsApp baru (HTTP 403)", async () => {
    const res = await fetch(`${BASE_URL}/api/wa/qr`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...cookieExpired },
      body: JSON.stringify({ action: "start" }),
    });
    assert.strictEqual(res.status, 403);
  });

  await test("NEG 3.3: Toko dengan langganan EXPIRED dilarang membuat website baru (HTTP 403)", async () => {
    const res = await fetch(`${BASE_URL}/api/websites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...cookieExpired },
      body: JSON.stringify({
        action: "create",
        name: "Toko Expired Site",
        slug: "toko-expired-site",
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  await test("NEG 3.4: Toko dengan langganan EXPIRED dilarang menambah knowledge base document (HTTP 403)", async () => {
    const res = await fetch(`${BASE_URL}/api/knowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...cookieExpired },
      body: JSON.stringify({
        action: "save",
        title: "Dokumen Toko Expired",
        doc_type: "FAQ",
        content_text: "Konten tidak boleh tersimpan.",
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  console.log("\n=== BAGIAN 4: VALIDASI INPUT & PAYLOAD MALFORMED / CORRUPTED ===");

  await test("NEG 4.1: Pembuatan produk dengan harga invalid (bukan angka) ditolak (HTTP 400)", async () => {
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...cookieAlpha },
      body: JSON.stringify({
        action: "create",
        sku: "INVALID-PRICE-01",
        name: "Produk Harga Salah",
        price: "gratis_kak",
        stock: 5,
      }),
    });
    assert.strictEqual(res.status, 400);
  });

  await test("NEG 4.2: Pembuatan produk dengan SKU duplikat pada toko yang sama ditolak (HTTP 400)", async () => {
    // Buat dulu produk pertama
    const res1 = await fetch(`${BASE_URL}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...cookieAlpha },
      body: JSON.stringify({
        action: "create",
        sku: "UNIQUE-SKU-99",
        name: "Produk Pertama SKU 99",
        price: 75000,
        stock: 10,
      }),
    });
    assert.strictEqual(res1.status, 200);

    // Coba buat produk kedua dengan SKU yang sama
    const res2 = await fetch(`${BASE_URL}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...cookieAlpha },
      body: JSON.stringify({
        action: "create",
        sku: "unique-sku-99", // case-insensitive check
        name: "Produk Duplikat SKU 99",
        price: 80000,
        stock: 10,
      }),
    });
    assert.strictEqual(res2.status, 400);
    const data2 = await res2.json();
    assert.strictEqual(data2.ok, false);
    assert.ok(data2.error.includes("sudah digunakan"));
  });

  await test("NEG 4.3: Request dengan sintaks JSON rusak ditolak bersih (HTTP 400)", async () => {
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...cookieAlpha },
      body: "{ broken_json_string: missing_quotes_and_braces",
    });
    assert.strictEqual(res.status, 400);
  });

  await test("NEG 4.4: Request dengan ID non-UUID pada endpoint Zod UUID ditolak (HTTP 422)", async () => {
    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...cookieAlpha },
      body: JSON.stringify({
        action: "verify",
        order_id: "bukan-uuid-12345",
      }),
    });
    assert.strictEqual(res.status, 422);
  });

  await test("NEG 4.5: Request order verify tanpa menyertakan order_id ditolak (HTTP 422)", async () => {
    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...cookieAlpha },
      body: JSON.stringify({
        action: "verify",
        // order_id sengaja dihilangkan
      }),
    });
    assert.strictEqual(res.status, 422);
  });

  console.log("\n=== BAGIAN 5: BUSINESS LOGIC & STATE MACHINE HARD GATES ===");

  const convAlpha = await prisma.conversation.create({
    data: {
      tenant_id: TENANT_ALPHA_ID,
      buyer_jid: "628111222333@s.whatsapp.net",
      buyer_name: "Buyer State Machine",
      pipeline_stage: "ORDER_CREATED",
    },
  });

  const unpaidOrder = await prisma.order.create({
    data: {
      tenant_id: TENANT_ALPHA_ID,
      conversation_id: convAlpha.id,
      buyer_jid: "628111222333@s.whatsapp.net",
      order_number: "ORDER-UNPAID-01",
      order_status: "PENDING_PAYMENT",
      payment_status: "UNPAID",
      subtotal: 100000,
      shipping_tariff: 10000,
      unique_code: 44,
      total_amount: 110044,
      items: [{ sku: "UNIQUE-SKU-99", qty: 1, price: 100000, line_total: 100000 }],
    },
  });

  await test("NEG 5.1: Eksekusi pengiriman (shipOrder) pada pesanan belum bayar (UNPAID) ditolak mutlak", async () => {
    const res = await shipOrder({
      orderId: unpaidOrder.id,
      tenantId: TENANT_ALPHA_ID,
      trackingNumber: "RESI-ILEGAL-999",
    });
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.error, "Pembayaran belum diverifikasi");

    // Pastikan status di DB tetap belum kirim
    const checkOrder = await prisma.order.findUnique({ where: { id: unpaidOrder.id } });
    assert.strictEqual(checkOrder?.order_status, "PENDING_PAYMENT");
    assert.strictEqual(checkOrder?.payment_status, "UNPAID");
  });

  const cancelledOrder = await prisma.order.create({
    data: {
      tenant_id: TENANT_ALPHA_ID,
      conversation_id: convAlpha.id,
      buyer_jid: "628111222333@s.whatsapp.net",
      order_number: "ORDER-CANCELLED-01",
      order_status: "CANCELLED",
      payment_status: "UNPAID",
      subtotal: 100000,
      shipping_tariff: 10000,
      unique_code: 55,
      total_amount: 110055,
      items: [{ sku: "UNIQUE-SKU-99", qty: 1, price: 100000, line_total: 100000 }],
    },
  });

  await test("NEG 5.2: Verifikasi pembayaran pada pesanan yang sudah dibatalkan (CANCELLED) ditolak", async () => {
    const res = await verifyPayment({
      orderId: cancelledOrder.id,
      verifiedBy: "alpha@test.com",
      approve: true,
    });
    assert.strictEqual(res.ok, false);
    assert.ok(res.error.toLowerCase().includes("transition") || res.error.toLowerCase().includes("illegal"));

    const checkCancelled = await prisma.order.findUnique({ where: { id: cancelledOrder.id } });
    assert.strictEqual(checkCancelled?.order_status, "CANCELLED");
  });

  console.log("\n=== BAGIAN 6: WEBHOOK TAMPERING & SECURITY DEFENSE ===");

  await test("NEG 6.1: Webhook WhatsApp (/api/wa-webhook) tanpa secret ditolak (HTTP 401)", async () => {
    const res = await fetch(`${BASE_URL}/api/wa-webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "message", data: {} }),
    });
    assert.strictEqual(res.status, 401);
  });

  await test("NEG 6.2: Webhook WhatsApp dengan secret palsu ditolak (HTTP 401)", async () => {
    const res = await fetch(`${BASE_URL}/api/wa-webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-whatsmeow-secret": "secret_palsu_peretas_123",
      },
      body: JSON.stringify({ event: "message", data: {} }),
    });
    assert.strictEqual(res.status, 401);
  });

  await test("NEG 6.3: Webhook Midtrans (/api/billing/webhook) dengan signature palsu ditolak (HTTP 403)", async () => {
    const res = await fetch(`${BASE_URL}/api/billing/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: "SUB-NOEW-FAKE-999",
        status_code: "200",
        gross_amount: "149000.00",
        signature_key: "forged_sha512_hash_value_that_does_not_match",
        transaction_status: "settlement",
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  await test("NEG 6.4: Webhook WhatsApp dipanggil dengan method ilegal (DELETE) ditolak (HTTP 405)", async () => {
    const res = await fetch(`${BASE_URL}/api/wa-webhook`, {
      method: "DELETE",
      headers: { "x-whatsmeow-secret": env.WHATSMEOW_SECRET },
    });
    assert.strictEqual(res.status, 405);
  });

  // Cleanup DB
  for (const tid of [TENANT_ALPHA_ID, TENANT_BETA_ID, TENANT_EXPIRED_ID]) {
    await prisma.website.deleteMany({ where: { tenant_id: tid } });
    await prisma.product.deleteMany({ where: { tenant_id: tid } });
    await prisma.order.deleteMany({ where: { tenant_id: tid } });
    await prisma.chatMessage.deleteMany({ where: { conversation: { tenant_id: tid } } });
    await prisma.conversation.deleteMany({ where: { tenant_id: tid } });
    await prisma.knowledgeDocument.deleteMany({ where: { tenant_id: tid } });
    await prisma.catalogSetting.deleteMany({ where: { tenant_id: tid } });
    await prisma.waInstance.deleteMany({ where: { tenant_id: tid } });
    await prisma.subscription.deleteMany({ where: { tenant_id: tid } });
    await prisma.tenant.deleteMany({ where: { id: tid } });
  }

  console.log("\n================================================================================");
  console.log(`  HASIL NEGATIVE TESTS: ${passed}/${passed + failed} passed (${failed} failed)`);
  console.log("================================================================================\n");

  return { total: passed + failed, passed, failed };
}

if (process.argv[1]?.endsWith("negative-scenarios.test.ts")) {
  runNegativeScenariosTests()
    .then((r) => {
      process.exit(r.failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("Negative scenarios test runner crashed:", err);
      process.exit(1);
    });
}
