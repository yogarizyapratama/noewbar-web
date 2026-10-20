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
 * NATIVE SUPPORT LIVE CHAT E2E & SECURITY TEST SUITE (REAL-TIME SSE)
 * ============================================================================
 * Menguji seluruh alur obrolan langsung (Instant Live Chat Support) antara Merchant dan Superadmin:
 *
 * 1. Sisi Merchant / Tenant:
 *    - Inisialisasi otomatis sesi obrolan (HTTP 200, pesan sambutan sistem)
 *    - Pengiriman pesan real-time dari merchant
 *    - Validasi pesan kosong / malformed (HTTP 400)
 *    - Pembacaan pesan balasan dari superadmin
 *
 * 2. Sisi Superadmin Support Desk:
 *    - Listing sesi live chat aktif beserta counter belum dibaca (unread count)
 *    - Pembukaan detail percakapan & auto-mark read pesan merchant
 *    - Pengiriman balasan langsung dari staf teknis superadmin
 *
 * 3. Security, Multi-Tenant & Boundary Guardrails:
 *    - Penolakan akses tanpa token sesi (HTTP 401)
 *    - Tenant token dilarang mengakses API livechat superadmin (HTTP 401)
 *    - Isolasi antar toko (cross-tenant): Percakapan toko A terisolasi penuh dari toko B
 */

export async function runSupportLiveChatTests(): Promise<{ total: number; passed: number; failed: number }> {
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

  console.log("\n==================================================");
  console.log("   SUPPORT LIVE CHAT FULL E2E SUITE (NATIVE SSE)  ");
  console.log("==================================================");

  const TENANT_A_ID = "00000000-0000-4000-a000-000000000011";
  const TENANT_B_ID = "00000000-0000-4000-b000-000000000022";

  // Cleanup
  await prisma.supportChatMessage.deleteMany({
    where: { session: { tenant_id: { in: [TENANT_A_ID, TENANT_B_ID] } } },
  });
  await prisma.supportChatSession.deleteMany({
    where: { tenant_id: { in: [TENANT_A_ID, TENANT_B_ID] } },
  });
  await prisma.tenant.deleteMany({
    where: { id: { in: [TENANT_A_ID, TENANT_B_ID] } },
  });

  // Create test tenants
  const tenantA = await prisma.tenant.create({
    data: {
      id: TENANT_A_ID,
      email: "livechat-alpha@noewbar.com",
      password_hash: "hash_alpha_live_123",
      business_name: "Toko Distro Alpha",
      owner_name: "Owner Alpha",
      owner_whatsapp: "081122334455",
      status: "ACTIVE",
      trial_expires_at: new Date(Date.now() + 30 * 86400000),
    },
  });

  const tenantB = await prisma.tenant.create({
    data: {
      id: TENANT_B_ID,
      email: "livechat-beta@noewbar.com",
      password_hash: "hash_beta_live_456",
      business_name: "Toko Elektronik Beta",
      owner_name: "Owner Beta",
      owner_whatsapp: "082233445566",
      status: "ACTIVE",
      trial_expires_at: new Date(Date.now() + 30 * 86400000),
    },
  });

  const tokenA = createToken<SessionPayload>(
    { sub: tenantA.id, email: tenantA.email, role: "TENANT", exp: Math.floor(Date.now() / 1000) + 86400 },
    env.NEXTAUTH_SECRET
  );
  const cookieA = { Cookie: `${TENANT_COOKIE}=${tokenA}` };

  const tokenB = createToken<SessionPayload>(
    { sub: tenantB.id, email: tenantB.email, role: "TENANT", exp: Math.floor(Date.now() / 1000) + 86400 },
    env.NEXTAUTH_SECRET
  );
  const cookieB = { Cookie: `${TENANT_COOKIE}=${tokenB}` };

  const adminToken = createToken<AdminPayload>(
    { sub: "superadmin", email: env.SUPERADMIN_EMAIL, role: "SUPERADMIN", exp: Math.floor(Date.now() / 1000) + 86400 },
    env.NEXTAUTH_SECRET
  );
  const cookieAdmin = { Cookie: `${ADMIN_COOKIE}=${adminToken}` };

  let activeSessionId = "";

  try {
    // ------------------------------------------------------------------------
    // BAGIAN 1: SISI MERCHANT (TENANT)
    // ------------------------------------------------------------------------
    console.log("\n--- BAGIAN 1: OPERASIONAL MERCHANT LIVE CHAT ---");

    await test("LC 1.1: Merchant menginisialisasi sesi live chat (auto-create & pesan sambutan)", async () => {
      const res = await fetch(`${BASE_URL}/api/support/livechat`, {
        headers: cookieA,
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.ok(data.session);
      assert.ok(data.session.id);
      assert.strictEqual(data.session.status, "OPEN");
      assert.ok(Array.isArray(data.messages));
      assert.ok(data.messages.length >= 1);
      assert.strictEqual(data.messages[0].sender_type, "SYSTEM");

      activeSessionId = data.session.id;
    });

    await test("LC 1.2 [NEGATIVE]: Merchant mengirim pesan kosong / whitespace ditolak (HTTP 400)", async () => {
      const res = await fetch(`${BASE_URL}/api/support/livechat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cookieA },
        body: JSON.stringify({
          message: "   ",
        }),
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.ok, false);
      assert.ok(data.error);
    });

    await test("LC 1.3: Merchant mengirim pesan kendala teknis (HTTP 200)", async () => {
      const res = await fetch(`${BASE_URL}/api/support/livechat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cookieA },
        body: JSON.stringify({
          message: "Halo kak, saya butuh bantuan setting jam batas transfer pengiriman toko.",
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.ok(data.message);
      assert.strictEqual(data.message.sender_type, "TENANT");
      assert.strictEqual(data.message.read_by_superadmin, false);
    });

    // ------------------------------------------------------------------------
    // BAGIAN 2: SISI SUPERADMIN SUPPORT DESK
    // ------------------------------------------------------------------------
    console.log("\n--- BAGIAN 2: OPERASIONAL SUPERADMIN LIVE CHAT ---");

    await test("LC 2.1: Superadmin melihat daftar sesi chat aktif & counter pesan belum dibaca", async () => {
      const res = await fetch(`${BASE_URL}/api/superadmin/livechat`, {
        headers: cookieAdmin,
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.ok(Array.isArray(data.sessions));
      assert.ok(data.sessions.length >= 1);
      assert.ok(data.total_unread >= 1);

      const sess = data.sessions.find((s: { id: string }) => s.id === activeSessionId);
      assert.ok(sess, "Sesi milik Tenant Alpha harus ada di antrean live chat superadmin");
      assert.strictEqual(sess.tenant.business_name, "Toko Distro Alpha");
      assert.strictEqual(sess.unread_count, 1);
    });

    await test("LC 2.2: Superadmin membuka sesi chat (auto-mark read pesan merchant)", async () => {
      const res = await fetch(`${BASE_URL}/api/superadmin/livechat/${activeSessionId}`, {
        headers: cookieAdmin,
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.session.id, activeSessionId);
      assert.ok(Array.isArray(data.messages));
      assert.strictEqual(data.messages.length, 2); // 1 System + 1 Tenant

      // Verifikasi pesan tenant sudah ditandai read_by_superadmin: true
      const tenantMsg = data.messages.find((m: { sender_type: string }) => m.sender_type === "TENANT");
      assert.strictEqual(tenantMsg.read_by_superadmin, true);
    });

    await test("LC 2.3 [NEGATIVE]: Superadmin mengirim balasan kosong ditolak (HTTP 400)", async () => {
      const res = await fetch(`${BASE_URL}/api/superadmin/livechat/${activeSessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cookieAdmin },
        body: JSON.stringify({
          message: "   ",
        }),
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.ok, false);
    });

    await test("LC 2.4: Superadmin mengirim balasan langsung ke merchant (HTTP 200)", async () => {
      const res = await fetch(`${BASE_URL}/api/superadmin/livechat/${activeSessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cookieAdmin },
        body: JSON.stringify({
          message: "Halo Kak! Jam cut-off bisa diatur di menu Promosi & Pengiriman pada bagian 'Jam Batas Transfer'.",
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.message.sender_type, "SUPERADMIN");
      assert.strictEqual(data.message.read_by_tenant, false);
    });

    await test("LC 2.5: Merchant membaca pesan balasan & auto-mark read", async () => {
      const res = await fetch(`${BASE_URL}/api/support/livechat`, {
        headers: cookieA,
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.messages.length, 3); // 1 System + 1 Tenant + 1 Superadmin

      const adminMsg = data.messages.find((m: { sender_type: string }) => m.sender_type === "SUPERADMIN");
      assert.ok(adminMsg);
      assert.ok(adminMsg.message.includes("Jam cut-off"));
    });

    // ------------------------------------------------------------------------
    // BAGIAN 3: SECURITY, CROSS-TENANT & PRIVILEGE GUARDRAILS
    // ------------------------------------------------------------------------
    console.log("\n--- BAGIAN 3: ISOLASI DATA MULTI-TENANT & SECURITY GUARDS ---");

    await test("LC 3.1 [CROSS-TENANT ISOLATION]: Tenant B terisolasi penuh dari sesi Tenant A", async () => {
      const res = await fetch(`${BASE_URL}/api/support/livechat`, {
        headers: cookieB,
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      // Sesi Tenant B harus berupa sesi baru miliknya sendiri, bukan milik Tenant A
      assert.notStrictEqual(data.session.id, activeSessionId, "Tenant B tidak boleh masuk ke sesi Tenant A");
      assert.strictEqual(data.messages.length, 1); // Hanya pesan sambutan sistem miliknya
    });

    await test("LC 3.2 [AUTH NEGATIVE]: Request merchant tanpa session token ditolak (HTTP 401)", async () => {
      const res = await fetch(`${BASE_URL}/api/support/livechat`);
      assert.strictEqual(res.status, 401);
    });

    await test("LC 3.3 [AUTH NEGATIVE]: Request superadmin livechat tanpa session token ditolak (HTTP 401)", async () => {
      const res = await fetch(`${BASE_URL}/api/superadmin/livechat`);
      assert.strictEqual(res.status, 401);
    });

    await test("LC 3.4 [AUTH NEGATIVE]: Tenant token mencoba mengakses API livechat superadmin ditolak (HTTP 401)", async () => {
      const res = await fetch(`${BASE_URL}/api/superadmin/livechat`, {
        headers: cookieA,
      });
      assert.strictEqual(res.status, 401, "Merchant dilarang mengakses konsol livechat superadmin");
    });

    await test("LC 3.5 [BOUNDARY]: Akses sessionId non-existent mengembalikan HTTP 404 terstruktur", async () => {
      const res = await fetch(`${BASE_URL}/api/superadmin/livechat/00000000-0000-0000-0000-000000000999`, {
        headers: cookieAdmin,
      });
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.ok, false);
    });

  } finally {
    // Cleanup
    await prisma.supportChatMessage.deleteMany({
      where: { session: { tenant_id: { in: [TENANT_A_ID, TENANT_B_ID] } } },
    });
    await prisma.supportChatSession.deleteMany({
      where: { tenant_id: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });
  }

  console.log("\n--------------------------------------------------");
  console.log(`  Support Live Chat Suite: ${passed}/${passed + failed} passed [${failed === 0 ? "PASS" : "FAIL"}]`);
  console.log("--------------------------------------------------\n");

  return { total: passed + failed, passed, failed };
}

// Standalone execution support
if (process.argv[1]?.endsWith("support-livechat.test.ts") || process.argv[1]?.endsWith("support-livechat.test.js")) {
  runSupportLiveChatTests()
    .then((results) => {
      if (results.failed > 0) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("Support Live Chat test fatal crash:", err);
      process.exit(1);
    });
}
