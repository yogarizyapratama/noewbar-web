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
 * HELPDESK & TICKETING SYSTEM COMPREHENSIVE E2E & SECURITY TEST SUITE
 * ============================================================================
 * Menguji seluruh alur Pusat Bantuan / Helpdesk (Zendesk-grade) untuk Merchant & Superadmin:
 *
 * 1. Sisi Merchant / Tenant:
 *    - Pembuatan tiket bantuan (HTTP 200, format nomor TKT-YYMMDD-XXXX)
 *    - Listing tiket dengan filter kategori & status
 *    - Detail percakapan tiket
 *    - Pengiriman balasan dari merchant
 *    - Tandai tiket sebagai RESOLVED oleh merchant
 *    - Auto-reopen tiket saat merchant membalas tiket yang sudah selesai
 *
 * 2. Sisi Superadmin / Support Staff:
 *    - Listing seluruh tiket multi-tenant beserta SLA metrics
 *    - Detail tiket lengkap dengan data tenant & metadata
 *    - Update status, priority, dan petugas assigned_to
 *    - Penulisan Catatan Internal (Internal Note) khusus staf
 *    - Pengiriman Balasan Publik (Public Reply) ke merchant
 *
 * 3. Privacy, Boundary & Security Guardrails:
 *    - Isolasi Internal Note: Catatan internal staf tidak pernah bocor ke sisi merchant
 *    - Isolasi Multi-Tenant: Tenant B dilarang membaca tiket milik Tenant A (Cross-tenant HTTP 404)
 *    - Isolasi Multi-Tenant: Tenant B dilarang membalas tiket milik Tenant A (Cross-tenant HTTP 404)
 *    - Isolasi Multi-Tenant: Tenant B dilarang mengubah status tiket milik Tenant A (Cross-tenant HTTP 404)
 *    - Guard Otentikasi: Endpoint support menolak akses tanpa token sesi (HTTP 401)
 *    - Guard Otentikasi: Endpoint superadmin tickets menolak token merchant biasa (HTTP 401)
 *    - Validasi Skema: Payload kosong atau tidak valid ditolak dengan HTTP 400
 */

export async function runHelpdeskTests(): Promise<{ total: number; passed: number; failed: number }> {
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
  console.log("   HELPDESK & TICKETING FULL E2E SUITE (ZENDESK)  ");
  console.log("==================================================");

  const TENANT_A_ID = "00000000-0000-4000-a000-000000000001";
  const TENANT_B_ID = "00000000-0000-4000-b000-000000000002";

  // Clean-up existing test data
  await prisma.supportTicketMessage.deleteMany({
    where: { ticket: { tenant_id: { in: [TENANT_A_ID, TENANT_B_ID] } } },
  });
  await prisma.supportTicket.deleteMany({
    where: { tenant_id: { in: [TENANT_A_ID, TENANT_B_ID] } },
  });
  await prisma.tenant.deleteMany({
    where: { id: { in: [TENANT_A_ID, TENANT_B_ID] } },
  });

  // Create test tenants
  const tenantA = await prisma.tenant.create({
    data: {
      id: TENANT_A_ID,
      email: "helpdesk-alpha@noewbar.com",
      password_hash: "hash_alpha_secure_123",
      business_name: "Toko Sepatu Alpha Pro",
      owner_name: "Ahmad Alpha",
      owner_whatsapp: "081111111111",
      status: "ACTIVE",
      trial_expires_at: new Date(Date.now() + 30 * 86400000),
    },
  });

  const tenantB = await prisma.tenant.create({
    data: {
      id: TENANT_B_ID,
      email: "helpdesk-beta@noewbar.com",
      password_hash: "hash_beta_secure_456",
      business_name: "Kopi Beta Juara",
      owner_name: "Budi Beta",
      owner_whatsapp: "082222222222",
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

  let createdTicketId = "";

  try {
    // ------------------------------------------------------------------------
    // BAGIAN 1: OPERASIONAL MERCHANT (USER)
    // ------------------------------------------------------------------------
    console.log("\n--- BAGIAN 1: SISI MERCHANT / TENANT ---");

    await test("HD 1.1: Merchant berhasil membuat tiket bantuan baru (HTTP 200)", async () => {
      const res = await fetch(`${BASE_URL}/api/support/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cookieA },
        body: JSON.stringify({
          subject: "Kendala sinkronisasi katalog Google Sheets",
          category: "WHATSAPP",
          priority: "HIGH",
          message: "Halo tim support, varian ukuran sepatu tidak terbaca otomatis saat buyer WhatsApp bertanya.",
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.ok(data.ticket);
      assert.ok(data.ticket.id);
      assert.ok(data.ticket.ticket_number.startsWith("TKT-"));
      assert.strictEqual(data.ticket.status, "OPEN");
      assert.strictEqual(data.ticket.priority, "HIGH");
      assert.strictEqual(data.ticket.category, "WHATSAPP");

      createdTicketId = data.ticket.id;
    });

    await test("HD 1.2 [NEGATIVE]: Validasi pembuatan tiket dengan subject kosong ditolak (HTTP 400)", async () => {
      const res = await fetch(`${BASE_URL}/api/support/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cookieA },
        body: JSON.stringify({
          subject: "",
          category: "GENERAL",
          priority: "LOW",
          message: "Pesan ada tapi judul kosong.",
        }),
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.ok, false);
      assert.ok(data.error);
    });

    await test("HD 1.3 [NEGATIVE]: Validasi pembuatan tiket dengan kategori invalid ditolak (HTTP 400)", async () => {
      const res = await fetch(`${BASE_URL}/api/support/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cookieA },
        body: JSON.stringify({
          subject: "Judul Valid",
          category: "KATEGORI_ASAL_ASALAN",
          priority: "LOW",
          message: "Pesan valid.",
        }),
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.ok, false);
    });

    await test("HD 1.4: Merchant melihat daftar tiket miliknya (HTTP 200)", async () => {
      const res = await fetch(`${BASE_URL}/api/support/tickets`, {
        headers: cookieA,
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.ok(Array.isArray(data.tickets));
      assert.ok(data.tickets.length >= 1);
      assert.ok(data.stats);
      assert.ok(data.stats.total >= 1);
      assert.ok(data.stats.open >= 1);

      const found = data.tickets.find((t: { id: string }) => t.id === createdTicketId);
      assert.ok(found, "Tiket yang baru dibuat harus muncul di daftar tiket merchant");
    });

    await test("HD 1.5: Merchant membaca detail percakapan tiket (HTTP 200)", async () => {
      const res = await fetch(`${BASE_URL}/api/support/tickets/${createdTicketId}`, {
        headers: cookieA,
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.ticket.id, createdTicketId);
      assert.ok(Array.isArray(data.ticket.messages));
      assert.strictEqual(data.ticket.messages.length, 1);
      assert.strictEqual(data.ticket.messages[0].sender_type, "TENANT");
    });

    await test("HD 1.6: Merchant mengirim balasan tambahan pada tiket (HTTP 200)", async () => {
      const res = await fetch(`${BASE_URL}/api/support/tickets/${createdTicketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cookieA },
        body: JSON.stringify({
          message: "Tambahan info: Sheet kolom varian menggunakan nama 'Ukuran'. Mohon panduannya.",
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.ok(data.message);
      assert.strictEqual(data.message.sender_type, "TENANT");
    });

    await test("HD 1.7 [NEGATIVE]: Balasan tiket dengan pesan kosong ditolak (HTTP 400)", async () => {
      const res = await fetch(`${BASE_URL}/api/support/tickets/${createdTicketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cookieA },
        body: JSON.stringify({
          message: "   ",
        }),
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.ok, false);
    });

    // ------------------------------------------------------------------------
    // BAGIAN 2: OPERASIONAL SUPERADMIN (SUPPORT STAFF)
    // ------------------------------------------------------------------------
    console.log("\n--- BAGIAN 2: SISI SUPERADMIN / SUPPORT STAFF ---");

    await test("HD 2.1: Superadmin melihat seluruh tiket multi-tenant beserta queue stats (HTTP 200)", async () => {
      const res = await fetch(`${BASE_URL}/api/superadmin/tickets`, {
        headers: cookieAdmin,
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.ok(Array.isArray(data.tickets));
      assert.ok(data.tickets.length >= 1);
      assert.ok(data.stats);
      assert.ok(data.stats.total >= 1);

      const tkt = data.tickets.find((t: { id: string }) => t.id === createdTicketId);
      assert.ok(tkt, "Tiket tenant Alpha harus muncul di queue superadmin");
      assert.strictEqual(tkt.tenant.business_name, "Toko Sepatu Alpha Pro");
    });

    await test("HD 2.2: Superadmin melihat detail tiket lengkap dengan data tenant (HTTP 200)", async () => {
      const res = await fetch(`${BASE_URL}/api/superadmin/tickets/${createdTicketId}`, {
        headers: cookieAdmin,
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.ticket.id, createdTicketId);
      assert.strictEqual(data.ticket.tenant.owner_whatsapp, "081111111111");
      assert.strictEqual(data.ticket.messages.length, 2);
    });

    await test("HD 2.3: Superadmin mengubah status tiket, prioritas, dan assign agent (HTTP 200)", async () => {
      const res = await fetch(`${BASE_URL}/api/superadmin/tickets/${createdTicketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...cookieAdmin },
        body: JSON.stringify({
          status: "IN_PROGRESS",
          priority: "URGENT",
          assigned_to: "Hendra Support Lead",
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.ticket.status, "IN_PROGRESS");
      assert.strictEqual(data.ticket.priority, "URGENT");
      assert.strictEqual(data.ticket.assigned_to, "Hendra Support Lead");
    });

    await test("HD 2.4: Superadmin menambahkan Catatan Internal (Internal Note) (HTTP 200)", async () => {
      const res = await fetch(`${BASE_URL}/api/superadmin/tickets/${createdTicketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cookieAdmin },
        body: JSON.stringify({
          message: "Catatan internal: Sudah dicek di parser sheet, header kolom 'Ukuran' perlu dialiaskan ke 'Varian'.",
          is_internal: true,
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.message.is_internal, true);
      assert.strictEqual(data.message.sender_type, "SUPERADMIN");
    });

    await test("HD 2.5: Superadmin mengirim Balasan Publik (Public Reply) ke merchant (HTTP 200)", async () => {
      const res = await fetch(`${BASE_URL}/api/superadmin/tickets/${createdTicketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cookieAdmin },
        body: JSON.stringify({
          message: "Halo Kak Ahmad, sistem kami telah mengenali kolom 'Ukuran' Anda. Silakan klik sinkron ulang di tab Katalog ya kak.",
          is_internal: false,
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.message.is_internal, false);

      // Verify status auto updated to WAITING_TENANT
      const checkRes = await fetch(`${BASE_URL}/api/superadmin/tickets/${createdTicketId}`, {
        headers: cookieAdmin,
      });
      const checkData = await checkRes.json();
      assert.strictEqual(checkData.ticket.status, "WAITING_TENANT");
    });

    // ------------------------------------------------------------------------
    // BAGIAN 3: SECURITY, PRIVACY & CROSS-TENANT ISOLATION
    // ------------------------------------------------------------------------
    console.log("\n--- BAGIAN 3: PRIVACY & MULTI-TENANT DEFENSE (NEGATIVE TESTS) ---");

    await test("HD 3.1 [PRIVACY GUARD]: Merchant dilarang melihat Catatan Internal Superadmin", async () => {
      const res = await fetch(`${BASE_URL}/api/support/tickets/${createdTicketId}`, {
        headers: cookieA,
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);

      // Total messages: 2 from tenant + 1 internal note + 1 public reply = 4 in DB
      // Merchant should ONLY see 3 messages (internal note must be stripped)
      const messages = data.ticket.messages;
      assert.strictEqual(messages.length, 3, "Catatan internal tidak boleh bocor ke respons merchant");

      const hasInternal = messages.some((m: { is_internal?: boolean; message: string }) =>
        m.is_internal === true || m.message.includes("Catatan internal:")
      );
      assert.strictEqual(hasInternal, false, "Tidak boleh ada pesan internal yang lolos ke merchant");
    });

    await test("HD 3.2 [CROSS-TENANT NEGATIVE]: Tenant B dilarang membaca tiket milik Tenant A (HTTP 404)", async () => {
      const res = await fetch(`${BASE_URL}/api/support/tickets/${createdTicketId}`, {
        headers: cookieB,
      });

      assert.strictEqual(res.status, 404, "Tenant lain tidak boleh mengakses tiket toko lain");
      const data = await res.json();
      assert.strictEqual(data.ok, false);
    });

    await test("HD 3.3 [CROSS-TENANT NEGATIVE]: Tenant B dilarang membalas tiket milik Tenant A (HTTP 404)", async () => {
      const res = await fetch(`${BASE_URL}/api/support/tickets/${createdTicketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cookieB },
        body: JSON.stringify({
          message: "Percobaan sabotase tiket oleh Tenant B.",
        }),
      });

      assert.strictEqual(res.status, 404, "Tenant B harus diblokir dari membalas tiket milik Tenant A");
      const data = await res.json();
      assert.strictEqual(data.ok, false);
    });

    await test("HD 3.4 [CROSS-TENANT NEGATIVE]: Tenant B dilarang mengubah status tiket milik Tenant A (HTTP 404)", async () => {
      const res = await fetch(`${BASE_URL}/api/support/tickets/${createdTicketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...cookieB },
        body: JSON.stringify({
          status: "RESOLVED",
        }),
      });

      assert.strictEqual(res.status, 404, "Tenant B harus diblokir dari mengubah status tiket milik Tenant A");
    });

    await test("HD 3.5: Merchant menandai tiket sebagai RESOLVED (HTTP 200)", async () => {
      const res = await fetch(`${BASE_URL}/api/support/tickets/${createdTicketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...cookieA },
        body: JSON.stringify({
          status: "RESOLVED",
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.ticket.status, "RESOLVED");
      assert.ok(data.ticket.resolved_at);
    });

    await test("HD 3.6: Membalas tiket yang sudah selesai otomatis membuka kembali tiket (IN_PROGRESS)", async () => {
      const res = await fetch(`${BASE_URL}/api/support/tickets/${createdTicketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cookieA },
        body: JSON.stringify({
          message: "Ternyata masih ada 1 produk yang belum muncul kak, boleh dibantu cek lagi?",
        }),
      });

      assert.strictEqual(res.status, 200);

      // Verify status returned to IN_PROGRESS
      const checkRes = await fetch(`${BASE_URL}/api/support/tickets/${createdTicketId}`, {
        headers: cookieA,
      });
      const checkData = await checkRes.json();
      assert.strictEqual(checkData.ticket.status, "IN_PROGRESS", "Tiket harus otomatis kembali ke IN_PROGRESS saat dibalas kembali");
    });

    await test("HD 3.7 [AUTH NEGATIVE]: Request ke /api/support/tickets tanpa token ditolak (HTTP 401)", async () => {
      const res = await fetch(`${BASE_URL}/api/support/tickets`);
      assert.strictEqual(res.status, 401);
    });

    await test("HD 3.8 [AUTH NEGATIVE]: Request ke /api/superadmin/tickets tanpa token admin ditolak (HTTP 401)", async () => {
      const res = await fetch(`${BASE_URL}/api/superadmin/tickets`);
      assert.strictEqual(res.status, 401);
    });

    await test("HD 3.9 [AUTH NEGATIVE]: Tenant biasa mencoba mengakses endpoint /api/superadmin/tickets ditolak (HTTP 401)", async () => {
      const res = await fetch(`${BASE_URL}/api/superadmin/tickets`, {
        headers: cookieA,
      });
      assert.strictEqual(res.status, 401, "Token tenant dilarang mengakses tickets superadmin");
    });

    await test("HD 3.10 [BOUNDARY]: Akses ticket id non-existent mengembalikan HTTP 404 terstruktur", async () => {
      const res = await fetch(`${BASE_URL}/api/support/tickets/00000000-0000-0000-0000-000000000999`, {
        headers: cookieA,
      });
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.ok, false);
      assert.ok(data.error);
    });

  } finally {
    // Clean up test data
    await prisma.supportTicketMessage.deleteMany({
      where: { ticket: { tenant_id: { in: [TENANT_A_ID, TENANT_B_ID] } } },
    });
    await prisma.supportTicket.deleteMany({
      where: { tenant_id: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });
  }

  console.log("\n--------------------------------------------------");
  console.log(`  Helpdesk Test Suite: ${passed}/${passed + failed} passed [${failed === 0 ? "PASS" : "FAIL"}]`);
  console.log("--------------------------------------------------\n");

  return { total: passed + failed, passed, failed };
}

// Standalone execution support
if (process.argv[1]?.endsWith("helpdesk.test.ts") || process.argv[1]?.endsWith("helpdesk.test.js")) {
  runHelpdeskTests()
    .then((results) => {
      if (results.failed > 0) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("Helpdesk test suite fatal crash:", err);
      process.exit(1);
    });
}
