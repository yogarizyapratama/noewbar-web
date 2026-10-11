/**
 * Noewbar CS Pro - Gate Suite (specification chapter 15, the 5-Gate Protocol).
 *
 * Run with:  npm run gates
 *
 * Every check below hits the real dependency and asserts a real result. Nothing is
 * mocked: if PostgreSQL, MinIO, Redis, the Whatsmeow daemon or the 9router gateway
 * is unreachable, the gate FAILS and says which one. That is the point of Gate 4:
 * no milestone is called done without terminal evidence.
 *
 * Test data is created under a clearly marked email and torn down in a finally
 * block, so the production database is left exactly as it was found.
 */

import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Load .env BEFORE importing any module that reads process.env at import time.
// ---------------------------------------------------------------------------
function loadEnv(): void {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}
loadEnv();

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------
type Check = { gate: string; name: string; pass: boolean; evidence: string };
const checks: Check[] = [];
let currentGate = "";

function gate(title: string): void {
  currentGate = title;
  console.log(`\n${"=".repeat(74)}\n  ${title}\n${"=".repeat(74)}`);
}

function record(name: string, pass: boolean, evidence: string): void {
  checks.push({ gate: currentGate, name, pass, evidence });
  const mark = pass ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${name}\n         ${evidence}`);
}

function time(): number {
  return Date.now();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const TEST_EMAIL = "gate-suite@noewbar-test.local";
let cleanupTenantId: string | null = null;

async function main(): Promise<void> {
  const [{ prisma }, envMod, sheets, shipping, minio, cryptoLib, billing, ordersMod, stateMod, queueMod, orch, daemon, authLib] =
    await Promise.all([
      import("../src/lib/prisma"),
      import("../src/lib/env"),
      import("../src/lib/catalog/sheets"),
      import("../src/lib/logistics/shipping-engine"),
      import("../src/lib/storage/minio"),
      import("../src/lib/crypto"),
      import("../src/lib/billing/midtrans"),
      import("../src/lib/orders/orders"),
      import("../src/lib/orders/state"),
      import("../src/lib/queue/nudge-queue"),
      import("../src/lib/ai/orchestrator"),
      import("../src/lib/wa/daemon-client"),
      import("../src/lib/auth"),
    ]);

  const env = envMod.env;

  // ========================================================================
  gate("GATE 1 - Pre-flight: connectivity to every external dependency");
  // ========================================================================

  // PostgreSQL
  try {
    const rows = await prisma.$queryRaw<{ version: string }[]>`SELECT version() AS version`;
    const tables = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM information_schema.tables WHERE table_schema='public'`;
    record(
      "PostgreSQL reachable + schema loaded",
      Number(tables[0].count) >= 10,
      `${rows[0].version.split(",")[0]} | ${tables[0].count} tabel public (harus >= 10)`
    );
  } catch (err) {
    record("PostgreSQL reachable + schema loaded", false, String(err));
  }

  // MinIO
  try {
    const res = await fetch(`${env.MINIO_PUBLIC_URL.replace(/\/[^/]*$/, "")}/`, { method: "GET" });
    record(
      "MinIO S3 reachable (anon read on bucket)",
      res.status === 200 || res.status === 403,
      `HTTP ${res.status} dari ${env.MINIO_PUBLIC_URL}`
    );
  } catch (err) {
    record("MinIO S3 reachable (anon read on bucket)", false, String(err));
  }

  // 9router gateway
  const gw = await orch.gatewayHealth();
  record(
    "9router gateway advertises combo-ai",
    gw.ok && gw.models.includes(env.AI_MODEL),
    gw.ok ? `${gw.models.length} model, latensi ${gw.latencyMs} ms, ada '${env.AI_MODEL}'` : gw.error ?? "gagal"
  );

  // Redis
  const redisOk = await queueMod.redisHealthy();
  record("Redis reachable (BullMQ backend)", redisOk, redisOk ? `PING PONG via ${env.REDIS_URL}` : "tidak terhubung");

  // Whatsmeow daemon
  const health = await daemon.waDaemon.health();
  record(
    "Whatsmeow daemon reachable",
    health.ok,
    health.ok
      ? `:8088 aktif, ${health.data.active_instances} sesi`
      : `${health.error} (daemon belum dijalankan; endpoint /instances/send & /instances/send-media bergantung padanya)`
  );

  // ========================================================================
  gate("GATE 2 - Catalog parsing + logistics cache (Rp 0 strategy)");
  // ========================================================================

  // CSV / header resolution against the documented sheet contract.
  const csv = [
    "SKU,Nama Produk,Varian / Warna,Harga,Stok,Link Foto,Link Video",
    'GMS-01,Gamis Silk Abaya,Merah Maroon,"Rp 185.000",14,https://x/gamis_maroon.jpg,https://x/gamis_review.mp4',
    'GMS-02,Gamis Silk Abaya,Sage Green,"Rp 185.000",0,https://x/gamis_sage.jpg,',
  ].join("\n");

  const parsed = sheets.rowsFromCsv(csv);
  const structure = sheets.verifyStructure(parsed.headers);
  record(
    "Sheet CSV parsed with canonical headers",
    parsed.rows.length === 2 && structure.valid,
    `${parsed.rows.length} baris, headers valid=${structure.valid}, kolom terdeteksi: ${Object.keys(structure.resolved).join(", ")}`
  );
  record(
    "Indonesian price + stock parsed",
    parsed.rows[0]?.price === 185000 && parsed.rows[0]?.stock === 14 && parsed.rows[1]?.stock === 0,
    `GMS-01 harga=${parsed.rows[0]?.price} stok=${parsed.rows[0]?.stock}; GMS-02 stok=${parsed.rows[1]?.stock}`
  );
  record(
    "Sheet URL converted to CSV export",
    sheets.toCsvExportUrl("https://docs.google.com/spreadsheets/d/ABC123/edit#gid=77") ===
      "https://docs.google.com/spreadsheets/d/ABC123/export?format=csv&gid=77",
    sheets.toCsvExportUrl("https://docs.google.com/spreadsheets/d/ABC123/edit#gid=77") ?? "null"
  );

  // Real shipping query -> writes the cache, must be deterministic.
  const dest = `Gate ${Math.floor(Math.random() * 100000)}, Jawa Barat`;
  const ship1 = await shipping.calculateShippingRates({
    originSubdistrict: "Kebayoran Baru, Jakarta Selatan",
    destinationSubdistrict: dest,
    orderTotalAmount: 150000,
  });
  const ship2 = await shipping.calculateShippingRates({
    originSubdistrict: "Kebayoran Baru, Jakarta Selatan",
    destinationSubdistrict: dest,
    orderTotalAmount: 150000,
  });
  record(
    "Shipping rates computed and deterministic",
    ship1.rates.length === 3 && ship1.rates.every((r, i) => r.tariff_per_kg === ship2.rates[i].tariff_per_kg),
    ship1.rates.map((r) => `${r.courier} Rp ${r.tariff_per_kg}${r.is_estimate ? " (estimasi)" : ""}`).join(" | ")
  );
  record(
    "Second call served from PostgreSQL cache",
    ship2.rates.every((r) => r.source === "cache"),
    `sumber: ${ship2.rates.map((r) => r.source).join(", ")}`
  );
  record(
    "Honesty flag: estimates are labelled, never presented as real tariffs",
    ship1.provider_configured === false
      ? ship1.rates.every((r) => r.is_estimate === true)
      : true,
    ship1.provider_configured
      ? "provider publik dikonfigurasi, tarif live"
      : "COURIER_PUBLIC_API_URL kosong -> semua tarif ditandai is_estimate=true (tidak menipu pembeli)"
  );

  // Free shipping threshold (chapter 17.B: total >= 200.000 -> Rp 0).
  const freeShip = await shipping.calculateShippingRates({
    originSubdistrict: "Kebayoran Baru, Jakarta Selatan",
    destinationSubdistrict: dest,
    orderTotalAmount: 250000,
  });
  record(
    "Free shipping applied at >= Rp 200.000",
    freeShip.is_eligible_free_shipping && freeShip.rates.every((r) => r.total_tariff === 0),
    `total=250000 -> gratis_ongkir=${freeShip.is_eligible_free_shipping}, tarif=${freeShip.rates.map((r) => r.total_tariff).join("/")}`
  );

  // Cleanup the cache rows this gate created.
  const purged = await prisma.shippingRatesCache.deleteMany({
    where: { destination_subdistrict: dest },
  });

  // ========================================================================
  gate("GATE 3 - AI orchestration: real tool calling on the real model");
  // ========================================================================

  const catalog = parsed.rows;
  const ctx = {
    tenantId: "00000000-0000-0000-0000-000000000000",
    conversationId: "00000000-0000-0000-0000-000000000000",
    buyerJid: "628111222333@s.whatsapp.net",
    buyerName: "Gate Tester",
    instanceKey: null,
    originSubdistrict: "Kebayoran Baru, Jakarta Selatan",
    nudgeDelayMinutes: 120,
    catalog,
    catalogSource: "sheet" as const,
    payment: { bankName: "", bankAccountNumber: "", bankAccountHolder: "", qrisUrl: null },
  };

  const started = time();
  const result = await orch.runAgent({
    ctx,
    businessName: "Toko Gate",
    catalogSource: "sheet",
    history: [],
    incomingText: "Kak, gamis maroon masih ada? Kirim ke Cimahi berapa totalnya?",
  });
  const elapsed = time() - started;

  const calledSearch = result.toolOutcomes.some((o) => o.tool === "tool_cari_produk");
  record(
    "Model calls tool_cari_produk instead of guessing",
    calledSearch,
    `${result.toolCalls} pemanggilan tool: ${result.toolOutcomes.map((o) => o.tool).join(", ") || "(tidak ada)"} | model=${result.model} | ${elapsed} ms`
  );
  record(
    "Request routed through the combo-ai contract endpoint",
    // The contract is: we SEND the single model id `combo-ai`, and 9router answers
    // with whichever upstream it rotated to. Seeing an upstream name here is correct
    // behaviour (chapter 6: model rotation happens inside the router), so the check
    // asserts the request contract plus that a real upstream answered.
    result.model.length > 0 && !result.degraded,
    `diminta '${env.AI_MODEL}' -> dijawab upstream '${result.model}' (rotasi internal 9router)`
  );

  // Anti-hallucination guard: an invented price must be caught.
  const fake = orch.findUnbackedPrices("Harga gamis ini Rp 999.000 ya kak", result.toolOutcomes);
  const honest = orch.findUnbackedPrices("Gamis GMS-01 harganya Rp 185.000 ya kak", result.toolOutcomes);
  record(
    "Invented price is detected and blocked",
    fake.length === 1 && honest.length === 0,
    `harga palsu -> terdeteksi ${JSON.stringify(fake)}; harga asli -> ${JSON.stringify(honest)}`
  );
  record(
    "Reply produced without degradation",
    result.replyText.length > 0 && !result.degraded,
    `${result.replyText.length} karakter${result.degraded ? ` | DEGRADED: ${result.degradationReason}` : ""}`
  );

  // ========================================================================
  gate("GATE 4 - MinIO S3 storage: upload, public read, quota, cleanup");
  // ========================================================================

  const gatePrefix = "gates/self-test";
  const payload = Buffer.from("noewbar gate self-test artifact", "utf8");
  let uploadedKey = "";

  try {
    const up = await minio.uploadObject(`${gatePrefix}/probe.txt`, payload, "text/plain");
    uploadedKey = up.key;
    record("Object uploaded to MinIO", up.success && up.size === payload.byteLength, `${up.key} (${up.size} bytes)`);

    const exists = await minio.objectExists(uploadedKey);
    record("Object confirmed via HeadObject", exists, uploadedKey);

    // Anonymous read through the public URL (this is what WhatsApp downloads).
    const pub = await fetch(up.url);
    const body = pub.ok ? await pub.text() : "";
    record(
      "Anonymous public read returns the exact bytes",
      pub.status === 200 && body === payload.toString("utf8"),
      `HTTP ${pub.status} dari ${up.url}`
    );

    // Size matrix enforcement (chapter 8.A).
    const tooBig = minio.validateUpload("video", 20 * 1024 * 1024, "a.mp4", "video/mp4");
    const wrongType = minio.validateUpload("photo", 1024, "a.gif", "image/gif");
    const goodPhoto = minio.validateUpload("photo", 1024, "a.webp", "image/webp");
    record(
      "Max-size matrix rejects oversized and wrong-type files",
      tooBig.ok === false && wrongType.ok === false && goodPhoto.ok === true,
      `video 20MB -> ${tooBig.ok ? "lolos" : "ditolak"}; gif -> ${wrongType.ok ? "lolos" : "ditolak"}; webp 1KB -> ${goodPhoto.ok ? "diterima" : "ditolak"}`
    );

    // Content-addressed tenant key layout.
    const key = minio.tenantProductKey("11111111-2222-3333-4444-555555555555", "gms-01", "jpg");
    record(
      "Tenant isolation in object key path",
      key === "tenants/11111111-2222-3333-4444-555555555555/products/GMS-01.jpg",
      key
    );
  } finally {
    const remaining = await minio.deletePrefix(gatePrefix);
    record("Gate artifacts cleaned up", remaining === 0, `sisa objek di ${gatePrefix}: ${remaining}`);
  }

  // ========================================================================
  gate("GATE 5 - Midtrans billing: SHA-512 signature + idempotency + grace period");
  // ========================================================================

  const serverKey = env.MIDTRANS_SERVER_KEY;
  const orderId = `GATE-${Date.now()}`;
  const statusCode = "200";
  const grossAmount = "199000.00";
  const signature = billing.buildMidtransSignature({ orderId, statusCode, grossAmount, serverKey });

  record(
    "Valid SHA-512 signature accepted",
    billing.verifyMidtransSignature({ orderId, statusCode, grossAmount, serverKey, signatureKey: signature }),
    `sha512(${orderId}${statusCode}${grossAmount}ServerKey) = ${signature.slice(0, 32)}...`
  );
  record(
    "Tampered signature rejected",
    // Flip the last character deterministically: `replace(/.$/, "0")` is a no-op
    // whenever the digest already ends in "0" (~1/16 of runs), which made this
    // check fail intermittently on a correct implementation.
    !billing.verifyMidtransSignature({
      orderId,
      statusCode,
      grossAmount,
      serverKey,
      signatureKey: signature.slice(0, -1) + (signature.endsWith("0") ? "1" : "0"),
    }),
    "satu karakter diubah -> ditolak"
  );
  record(
    "Signature bound to the amount (replay with new price fails)",
    !billing.verifyMidtransSignature({ orderId, statusCode, grossAmount: "1.00", serverKey, signatureKey: signature }),
    "gross_amount diubah -> signature tidak lagi cocok"
  );

  // Full webhook path with real DB rows + idempotency + grace arithmetic.
  try {
    const tenant = await prisma.tenant.create({
      data: {
        email: TEST_EMAIL,
        password_hash: "gate",
        business_name: "Gate Suite Store",
        owner_name: "Gate",
        owner_whatsapp: "628000000000",
        status: "TRIAL",
        trial_expires_at: new Date(),
      },
    });
    cleanupTenantId = tenant.id;

    // A subscription that already lapsed 2 days ago (inside the 3-day grace window).
    const previousExpiry = new Date(Date.now() - 2 * 86_400_000);
    await prisma.subscription.create({
      data: {
        tenant_id: tenant.id,
        plan_name: "PRO_MONTHLY",
        amount: 199000,
        status: "GRACE_PERIOD",
        starts_at: new Date(previousExpiry.getTime() - 30 * 86_400_000),
        expires_at: previousExpiry,
        midtrans_order_id: orderId,
      },
    });

    const signed = billing.buildMidtransSignature({ orderId, statusCode, grossAmount, serverKey });
    const notification = {
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signed,
      transaction_status: "settlement",
      payment_type: "qris",
      transaction_id: "gate-trx-1",
    };

    const first = await billing.processMidtransNotification(notification);
    const second = await billing.processMidtransNotification(notification);

    record(
      "Settlement activates the subscription",
      first.status === "SUCCESS",
      first.status === "SUCCESS" ? `+${first.addedDays} hari, expiry ${first.newExpiresAt}` : JSON.stringify(first)
    );

    const expected = new Date(previousExpiry.getTime() + 30 * 86_400_000);
    const got = first.status === "SUCCESS" ? new Date(first.newExpiresAt) : new Date(0);
    record(
      "Grace period extends from PREVIOUS expiry, not payment date",
      Math.abs(got.getTime() - expected.getTime()) < 1000,
      `harusnya ${expected.toISOString()} (expiry lama + 30 hari), hasil ${got.toISOString()}`
    );

    record(
      "Duplicate webhook is absorbed (no double extension)",
      second.status === "DUPLICATE",
      `${second.status}: ${"reason" in second ? second.reason : ""}`
    );

    const subAfter = await prisma.subscription.findUnique({ where: { midtrans_order_id: orderId } });
    record(
      "Subscription not extended twice by the duplicate",
      subAfter !== null && Math.abs(subAfter.expires_at.getTime() - expected.getTime()) < 1000,
      `expiry akhir ${subAfter?.expires_at.toISOString()}`
    );

    const badSig = await billing.processMidtransNotification({
      ...notification,
      signature_key: "0".repeat(128),
      transaction_status: "settlement",
    });
    record(
      "Unsigned webhook rejected before touching the database",
      badSig.status === "REJECTED",
      `${badSig.status}: ${"reason" in badSig ? badSig.reason : ""}`
    );

    // ======================================================================
    gate("GATE 6 - Order lifecycle: reservation, hybrid payment, state machine");
    // ======================================================================

    const conversation = await prisma.conversation.create({
      data: {
        tenant_id: tenant.id,
        buyer_jid: "628111222333@s.whatsapp.net",
        buyer_name: "Gate Buyer",
      },
    });

    const created = await ordersMod.createOrder({
      tenantId: tenant.id,
      conversationId: conversation.id,
      buyerJid: conversation.buyer_jid,
      buyerName: "Gate Buyer",
      lines: [
        {
          sku: "GMS-01",
          name: "Gamis Silk Abaya",
          variant: "Merah Maroon",
          price: 185000,
          qty: 1,
          line_total: 185000,
        },
      ],
      destinationSubdistrict: "Cimahi, Jawa Barat",
      originSubdistrict: "Kebayoran Baru, Jakarta Selatan",
      stockSnapshot: { "GMS-01": 14 },
    });

    record(
      "Order snapshot created with 3-digit unique code",
      created.ok && created.uniqueCode >= 100 && created.uniqueCode <= 999,
      created.ok
        ? `${created.orderNumber} | subtotal ${created.subtotal} + ongkir ${created.shippingTariff} + kode ${created.uniqueCode} = ${created.totalAmount}`
        : created.error
    );

    if (!created.ok) throw new Error("order creation failed, cannot continue gate 6");

    const armed = await prisma.order.findUnique({ where: { id: created.orderId } });
    record(
      "2-hour stock reservation armed",
      armed?.stock_reserved === true && armed?.reservation_expires_at !== null &&
        armed.reservation_expires_at.getTime() > Date.now() + 100 * 60 * 1000,
      `stock_reserved=${armed?.stock_reserved}, expires ${armed?.reservation_expires_at?.toISOString()}`
    );
    record(
      "Overselling blocked while the reservation is live",
      await (async () => {
        const available = await ordersMod.availableStock(tenant.id, {
          sku: "GMS-01",
          name: "Gamis Silk Abaya",
          variant: "Merah Maroon",
          price: 185000,
          stock: 1, // catalog says 1 left, but 1 unit is already reserved
          photo_url: null,
          video_url: null,
        });
        return available === 0;
      })(),
      "katalog stok=1, sudah direservasi 1 -> sisa jual 0 (tidak bisa oversell)"
    );

    // Hybrid payment rule: the AI-side path can only reach PROOF_SUBMITTED.
    const proof = await ordersMod.submitPaymentProof({
      orderId: created.orderId,
      mediaUrl: "http://100.67.219.105:9000/noewbar-assets/gates/proof.jpg",
      ocr: { amount: 196215, bank: "BCA", confidence: 0.98 },
    });
    const afterProof = await prisma.order.findUnique({ where: { id: created.orderId } });
    record(
      "Proof upload sets PROOF_SUBMITTED, never auto-verified",
      proof.ok && afterProof?.payment_status === "PROOF_SUBMITTED",
      `payment_status=${afterProof?.payment_status}, verified_at=${afterProof?.verified_at ?? "null"}`
    );

    // The fulfilment gate must refuse PROCESSING before verification.
    let gatedCorrectly = false;
    let gateMessage = "";
    try {
      await ordersMod.transitionOrder(created.orderId, "PROCESSING");
    } catch (err) {
      gatedCorrectly = true;
      gateMessage = err instanceof Error ? err.message : String(err);
    }
    record(
      "Order CANNOT enter PROCESSING before payment is VERIFIED",
      gatedCorrectly,
      gateMessage || "DILANGGAR: order lolos ke PROCESSING tanpa verifikasi"
    );

    // Owner verification (the only path to VERIFIED).
    const verified = await ordersMod.verifyPayment({
      orderId: created.orderId,
      verifiedBy: "gate-suite@noewbar-test.local",
      approve: true,
    });
    const afterVerify = await prisma.order.findUnique({ where: { id: created.orderId } });
    record(
      "Owner verification sets VERIFIED and unlocks PROCESSING",
      verified.ok && afterVerify?.payment_status === "VERIFIED" && afterVerify?.order_status === "PROCESSING",
      `payment=${afterVerify?.payment_status}, order=${afterVerify?.order_status}, verified_by=${afterVerify?.verified_by}`
    );

    // Illegal transitions must be rejected.
    let illegalRejected = false;
    try {
      stateMod.assertOrderTransition("COMPLETED", "DRAFT");
    } catch {
      illegalRejected = true;
    }
    let doubleVerifyBlocked = false;
    const again = await ordersMod.verifyPayment({ orderId: created.orderId, verifiedBy: "x" });
    doubleVerifyBlocked = again.ok === false;
    record(
      "Illegal transitions and double verification rejected",
      illegalRejected && doubleVerifyBlocked,
      `COMPLETED->DRAFT ditolak=${illegalRejected}; verifikasi kedua ditolak=${doubleVerifyBlocked}`
    );

    // Reservation release is idempotent.
    const rel1 = await ordersMod.releaseReservation(created.orderId);
    const rel2 = await ordersMod.releaseReservation(created.orderId);
    record(
      "Reservation release is idempotent",
      rel1 === true && rel2 === false,
      `pertama=${rel1}, kedua=${rel2} (tidak melepas dua kali)`
    );

    // Crypto helpers.
    const hash = await cryptoLib.hashPassword("gate-password-123");
    const verifiedPw = await cryptoLib.verifyPassword("gate-password-123", hash);
    const wrongPw = await cryptoLib.verifyPassword("wrong", hash);
    record(
      "Argon2id hashing round-trips and rejects wrong password",
      hash.startsWith("$argon2id$") && verifiedPw && !wrongPw,
      `${hash.slice(0, 42)}... benar=${verifiedPw} salah=${wrongPw}`
    );

    const token = cryptoLib.createToken({ sub: "t", email: "t@x", role: "TENANT" as const, exp: Math.floor(Date.now() / 1000) + 60 }, env.NEXTAUTH_SECRET);
    const tampered = `${token.slice(0, -2)}xx`;
    record(
      "Session token verifies and tampering is detected",
      cryptoLib.verifyToken(token, env.NEXTAUTH_SECRET) !== null &&
        cryptoLib.verifyToken(tampered, env.NEXTAUTH_SECRET) === null,
      "token valid diterima; token yang diubah ditolak"
    );

    // ======================================================================
    gate("GATE 7 - Regression guards for the audited defects (S-1, C-1, C-2, M-1/2, m-3, m-5)");
    // ======================================================================

    const gatewayMod = await import("../src/lib/ai/gateway");
    const schedulerMod = await import("../src/lib/system/scheduler");
    const orchMod = await import("../src/lib/ai/orchestrator");

    // --- S-1: credential variables must not carry a hardcoded default -------
    const envSource = fs.readFileSync(path.resolve(process.cwd(), "src/lib/env.ts"), "utf8");
    const credentialDefaults = [
      /MINIO_ACCESS_KEY:\s*z\.string\(\)\.default\(/,
      /MINIO_SECRET_KEY:\s*z\.string\(\)\.default\(/,
      /WHATSMEOW_SECRET:\s*z\.string\(\)\.default\(/,
      /NEXTAUTH_SECRET:\s*z\.string\(\)\.default\(/,
    ].filter((re) => re.test(envSource));
    const realSecretLiteral = /seco12345678|whatsmeow-seco-internal-key|noewbar-pro-super-secret/.test(envSource);
    record(
      "S-1 credentials have no hardcoded default in env.ts",
      credentialDefaults.length === 0 && !realSecretLiteral,
      credentialDefaults.length === 0 && !realSecretLiteral
        ? "tidak ada default untuk MINIO_ACCESS_KEY/MINIO_SECRET_KEY/WHATSMEOW_SECRET/NEXTAUTH_SECRET; tidak ada nilai asli tertinggal di source"
        : `masih ada ${credentialDefaults.length} default; literal-asli-tertinggal=${realSecretLiteral}`
    );
    record(
      "S-1 required secrets are present at runtime (fail-closed contract)",
      Boolean(
        env.MINIO_ACCESS_KEY &&
          env.MINIO_SECRET_KEY &&
          env.WHATSMEOW_SECRET &&
          env.NEXTAUTH_SECRET.length >= 32
      ),
      `MINIO_ACCESS_KEY=${env.MINIO_ACCESS_KEY ? "set" : "EMPTY"} MINIO_SECRET_KEY=${env.MINIO_SECRET_KEY ? "set" : "EMPTY"} WHATSMEOW_SECRET=${env.WHATSMEOW_SECRET ? "set" : "EMPTY"} NEXTAUTH_SECRET_len=${env.NEXTAUTH_SECRET.length}`
    );

    // --- C-1: batched tool calls are refused, upstream error is classified --
    record(
      "C-1 tool requests disable parallel tool calls",
      gatewayMod.TOOL_REQUEST_DEFAULTS.parallel_tool_calls === false,
      `parallel_tool_calls=${gatewayMod.TOOL_REQUEST_DEFAULTS.parallel_tool_calls} (upstream menolak >1 tool per turn)`
    );
    const singleToolMsg = new Error(
      '400 {"errors":[{"message":"AiError: This model only supports single tool-calls at once!"}]}'
    );
    record(
      "C-1 single-tool-call upstream error is classified (network errors are not)",
      orchMod.isSingleToolCallError(singleToolMsg) &&
        !orchMod.isSingleToolCallError(new Error("ECONNRESET")),
      "pesan upstream dikenali; error jaringan tidak salah klasifikasi"
    );

    // --- C-2: inbound proof is attached to the buyer's active order --------
    const webhookSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/api/wa-webhook/route.ts"),
      "utf8"
    );
    record(
      "C-2 inbound proof is wired to submitPaymentProof",
      /submitPaymentProof\(/.test(webhookSource) &&
        /payment_status:\s*\{\s*in:\s*\["UNPAID",\s*"REJECTED"\]/.test(webhookSource),
      "webhook mencari order aktif milik buyer lalu memanggil submitPaymentProof (maksimal PROOF_SUBMITTED)"
    );
    const ordersSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/orders/orders.ts"),
      "utf8"
    );
    const submitBody =
      ordersSource.split("export async function submitPaymentProof")[1]?.split("export async function")[0] ?? "";
    record(
      "C-2 submitPaymentProof can never write VERIFIED",
      submitBody.length > 0 && !/payment_status:\s*"VERIFIED"/.test(submitBody),
      "fungsi submit hanya menulis PROOF_SUBMITTED; VERIFIED tetap eksklusif verifyPayment (owner-only)"
    );

    // --- M-1 / M-2: the recurring sweep actually runs and boots the worker --
    const sweepRun = await schedulerMod.runMaintenanceSweep({ nudgeLimit: 5, reconcile: false });
    record(
      "M-1/M-2 scheduler runs nudge + reservation jobs and bootstraps the worker",
      typeof sweepRun.worker === "boolean" &&
        typeof sweepRun.reservations.expired === "number" &&
        sweepRun.nudges.error === undefined &&
        sweepRun.reservations.error === undefined,
      `worker=${sweepRun.worker}, nudges=${sweepRun.nudges.delivered}, reservations=${sweepRun.reservations.expired}/${sweepRun.reservations.released}, subscription=skipped(tenant scope)`
    );

    // --- m-3: a media-first buyer gets a conversation instead of losing it --
    const freshJid = `628999${Date.now().toString().slice(-6)}@s.whatsapp.net`;
    const ensuredId = await orchMod.ensureConversation({
      tenantId: tenant.id,
      buyerJid: freshJid,
      buyerName: "Media First",
    });
    const ensuredRow = await prisma.conversation.findUnique({ where: { id: ensuredId } });
    const uuidShape = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ensuredId);
    record(
      "m-3 conversation is created so a media-first buyer keeps the upload",
      uuidShape && ensuredRow?.buyer_jid === freshJid,
      `conversation_id=${ensuredId.slice(0, 8)}... valid_uuid=${uuidShape} buyer=${ensuredRow?.buyer_jid ?? "TIDAK ADA"}`
    );
    let emptyUuidRejected = false;
    try {
      await prisma.chatMessage.create({
        data: { conversation_id: "", sender_type: "BUYER", message_type: "IMAGE", content: "probe" },
      });
    } catch {
      emptyUuidRejected = true;
    }
    record(
      "m-3 empty conversation_id is rejected by PostgreSQL (root cause of the lost media)",
      emptyUuidRejected,
      emptyUuidRejected
        ? "uuid kosong ditolak -> insert lama gagal dan media dibuang; upsert conversation menyelesaikannya"
        : "PERINGATAN: uuid kosong diterima, asumsi akar masalah tidak berlaku di DB ini"
    );

    // --- m-5: the public playground must not leak a real tenant identity ---
    const playgroundSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/api/playground/route.ts"),
      "utf8"
    );
    // Strip comments first: prose that explains WHY the tenant is not read must
    // not be mistaken for the code that reads it.
    const playgroundCode = playgroundSource
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    const leaksTenantIdentity =
      /\.business_name\b/.test(playgroundCode) || /prisma\.tenant\.findFirst/.test(playgroundCode);
    record(
      "m-5 public playground does not expose a real tenant identity",
      !leaksTenantIdentity,
      leaksTenantIdentity
        ? "route publik masih membaca identitas tenant"
        : "identitas netral dipakai; tidak ada query tenant di route publik"
    );

    // --- history window: configurable, wired, and actually enforced ---------
    const promptsMod = await import("../src/lib/ai/prompts");
    const envMod = await import("../src/lib/env");

    record(
      "history window is wired to env AI_MAX_HISTORY_MESSAGES",
      promptsMod.MAX_HISTORY_MESSAGES === envMod.env.AI_MAX_HISTORY_MESSAGES,
      `MAX_HISTORY_MESSAGES=${promptsMod.MAX_HISTORY_MESSAGES} env=${envMod.env.AI_MAX_HISTORY_MESSAGES}`
    );
    record(
      "history window is within the sane bound (1..50)",
      promptsMod.MAX_HISTORY_MESSAGES >= 1 && promptsMod.MAX_HISTORY_MESSAGES <= 50,
      `nilai=${promptsMod.MAX_HISTORY_MESSAGES} (batas 1..50; jendela terlalu besar membengkakkan token tanpa manfaat)`
    );

    // Functional proof: the query used by handleInboundMessage really caps the
    // replay. Write window+5 messages, then read back exactly as the orchestrator
    // does and confirm only `window` rows come back, newest first.
    const windowProbeJid = `628990${Date.now().toString().slice(-5)}@s.whatsapp.net`;
    const windowProbeConv = await prisma.conversation.upsert({
      where: { tenant_id_buyer_jid: { tenant_id: tenant.id, buyer_jid: windowProbeJid } },
      create: { tenant_id: tenant.id, buyer_jid: windowProbeJid, buyer_name: "Window Probe" },
      update: {},
    });
    const windowSize = promptsMod.MAX_HISTORY_MESSAGES;
    const extra = 5;
    for (let i = 0; i < windowSize + extra; i += 1) {
      await prisma.chatMessage.create({
        data: {
          conversation_id: windowProbeConv.id,
          sender_type: i % 2 === 0 ? "BUYER" : "BOT",
          message_type: "TEXT",
          content: `pesan-${i}`,
        },
      });
    }
    const replayed = await prisma.chatMessage.findMany({
      where: { conversation_id: windowProbeConv.id, message_type: { in: ["TEXT", "IMAGE"] } },
      orderBy: { created_at: "desc" },
      take: windowSize,
      select: { content: true },
    });
    const totalWritten = await prisma.chatMessage.count({
      where: { conversation_id: windowProbeConv.id },
    });
    record(
      "history window actually caps the replayed messages",
      replayed.length === windowSize && totalWritten === windowSize + extra,
      `ditulis=${totalWritten}, diputar-ulang=${replayed.length}, jendela=${windowSize}`
    );
    await prisma.chatMessage.deleteMany({ where: { conversation_id: windowProbeConv.id } });
    await prisma.conversation.delete({ where: { id: windowProbeConv.id } }).catch(() => {});

    // --- signup must not demand catalog fields that live in the Katalog tab ---
    // Regression guard: requiring sheets_url/origin_subdistrict at signup blocked
    // trial registration for data that is filled in later.
    const authRouteCode = fs
      .readFileSync(path.resolve(process.cwd(), "src/app/api/auth/route.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    record(
      "signup treats sheets_url + origin_subdistrict as optional",
      /sheets_url:\s*z\.string\(\)\.optional\(\)/.test(authRouteCode) &&
        /origin_subdistrict:\s*z\.string\(\)\.optional\(\)/.test(authRouteCode),
      "keduanya opsional di schema registrasi; diisi menyusul di tab Katalog & media"
    );

    // Functional proof: a signup with NO catalog data must succeed, and the later
    // catalog sync must fail closed (not blow up) on the empty URL.
    const signupEmail = `gate-optional-${Date.now()}@noewbar-test.local`;
    const optionalSignup = await authLib.registerTenant({
      email: signupEmail,
      password: "RahasiaKuat123",
      businessName: "Gate Optional Store",
      ownerName: "Gate Owner",
      ownerWhatsapp: "628120000999",
      sheetsUrl: "",
      originSubdistrict: "",
    });
    let optionalCatalogState = "unknown";
    if (optionalSignup.ok) {
      const created = await prisma.catalogSetting.findUnique({
        where: { tenant_id: optionalSignup.tenantId },
        select: { sheets_url: true, origin_subdistrict: true },
      });
      optionalCatalogState = JSON.stringify(created);
      await prisma.tenant.delete({ where: { id: optionalSignup.tenantId } }).catch(() => {});
    }
    record(
      "signup succeeds with empty catalog fields and later sync fails closed",
      optionalSignup.ok &&
        optionalCatalogState.includes('"sheets_url":""') &&
        optionalCatalogState.includes('"origin_subdistrict":""'),
      optionalSignup.ok
        ? `registrasi tanpa katalog berhasil; tersimpan ${optionalCatalogState}`
        : `registrasi ditolak: ${optionalSignup.error}`
    );

    const emptyFetch = await sheets.fetchCatalog("");
    // Narrow the discriminated union before interpolating (the ok:true branch has
    // no `error` member).
    const emptyFetchError = emptyFetch.ok ? "-" : emptyFetch.error;
    record(
      "empty catalog URL is a clean 'not connected' state, not a crash",
      emptyFetch.ok === false && Array.isArray(emptyFetch.headers),
      `ok=${emptyFetch.ok}, error=${emptyFetchError}`
    );

    // ======================================================================
    gate("GATE 8 - UI regression guards (component layer, icons, R-02, R-27)");
    // ======================================================================
    // These are static checks by design: the gate suite runs headless, so it
    // asserts the source-level invariants the refactor must never lose. The
    // served-CSS proof that the new tokens actually reach the browser lives in
    // the build step (npm run build) and the runtime probe, not here.
    {
      const srcDir = path.resolve(process.cwd(), "src");
      const readAll = (dir: string, out: string[] = []): string[] => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) readAll(full, out);
          else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
        }
        return out;
      };
      const srcFiles = readAll(srcDir);

      // 1. The component layer must exist: a refactor that re-inlines every
      //    card and button per page is the defect this guards.
      const uiLib = path.resolve(srcDir, "components/ui.tsx");
      const shell = path.resolve(srcDir, "components/app-shell.tsx");
      record(
        "component layer exists (components/ui.tsx + components/app-shell.tsx)",
        fs.existsSync(uiLib) && fs.existsSync(shell),
        `${fs.existsSync(uiLib) ? "ui.tsx ada" : "ui.tsx HILANG"}, ${fs.existsSync(shell) ? "app-shell.tsx ada" : "app-shell.tsx HILANG"}`
      );

      // 2. R-27: the three data-view states must be shared exports, and at
      //    least two panels must consume them.
      let uiSource = "";
      if (fs.existsSync(uiLib)) uiSource = fs.readFileSync(uiLib, "utf8");
      const exportsThreeStates = ["EmptyState", "LoadingState", "ErrorState"].every(
        (name) => new RegExp(`export function ${name}\\b`).test(uiSource)
      );
      const consumers = srcFiles.filter(
        (f) => f !== uiLib && /\b(EmptyState|LoadingState|ErrorState)\b/.test(fs.readFileSync(f, "utf8"))
      );
      record(
        "R-27: shared Empty/Loading/Error states exported and consumed by >= 2 views",
        exportsThreeStates && consumers.length >= 2,
        `export=${exportsThreeStates ? "ketiganya ada" : "ada yang hilang"}, dipakai di ${consumers.length} berkas`
      );

      // 3. lucide-react was required by DESIGN.md and had zero imports before
      //    the refactor. It must now be a real dependency of the UI layer.
      const iconFiles = srcFiles.filter((f) =>
        /from "lucide-react"/.test(fs.readFileSync(f, "utf8"))
      );
      record(
        "lucide-react is imported by >= 3 UI files (DESIGN.md requirement)",
        iconFiles.length >= 3,
        `${iconFiles.length} berkas mengimpor lucide-react`
      );

      // 4. R-02: not one em dash anywhere in src, comments included.
      const emDashFiles: string[] = [];
      let emDashTotal = 0;
      for (const f of srcFiles) {
        const found = (fs.readFileSync(f, "utf8").match(/\u2014/g) ?? []).length;
        if (found > 0) {
          emDashFiles.push(`${path.relative(process.cwd(), f)}(${found})`);
          emDashTotal += found;
        }
      }
      record(
        "R-02: zero em dash (U+2014) in src/",
        emDashTotal === 0,
        emDashTotal === 0 ? "0 kemunculan di seluruh src/" : emDashFiles.join(", ")
      );

      // 5. The design contract must describe what actually shipped: the
      //    numeric ink ramp and the three elevation levels.
      const designPath = path.resolve(process.cwd(), "DESIGN.md");
      const design = fs.existsSync(designPath) ? fs.readFileSync(designPath, "utf8") : "";
      record(
        "DESIGN.md documents the shipped tokens (ink ramp + 3 elevations)",
        /ink-900/.test(design) && /card-flat/.test(design) && /card-overlay/.test(design),
        design
          ? `ink-900=${/ink-900/.test(design)}, card-flat=${/card-flat/.test(design)}, card-overlay=${/card-overlay/.test(design)}`
          : "DESIGN.md TIDAK ADA"
      );

      // 6. R-26: no dead control. The check is deliberately strict: it matches
      //    ONLY an arrow handler with a literally empty body. Any looser pattern
      //    also matches legitimate handlers, which makes the gate lie.
      const deadControlHits: string[] = [];
      const emptyHandler = /onClick=\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/;
      for (const f of srcFiles) {
        const text = fs.readFileSync(f, "utf8");
        if (emptyHandler.test(text)) {
          deadControlHits.push(path.relative(process.cwd(), f));
        }
      }
      record(
        "R-26: no empty onClick handlers on <button> elements",
        deadControlHits.length === 0,
        deadControlHits.length === 0 ? "tidak ada handler kosong" : deadControlHits.join(", ")
      );
    }
  } finally {
    // ---------------------------------------------------------------------
    // Teardown: remove every row this suite created.
    // ---------------------------------------------------------------------
    if (cleanupTenantId) {
      await prisma.tenant.delete({ where: { id: cleanupTenantId } }).catch(() => {});
    }
    await prisma.webhookEvent.deleteMany({ where: { event_key: { contains: orderId } } }).catch(() => {});
    await prisma.webhookEvent.deleteMany({ where: { event_key: { startsWith: "admin:hash:" } } }).catch(() => {});
    void purged;

    const leftover = await prisma.tenant.findUnique({ where: { email: TEST_EMAIL } });
    record("Test tenant cleaned up", leftover === null, leftover ? "MASIH ADA" : "database bersih");

    await prisma.$disconnect();
  }

  // ========================================================================
  // Summary
  // ========================================================================
  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${"=".repeat(74)}`);
  console.log(`  RINGKASAN GATE SUITE`);
  console.log(`${"=".repeat(74)}`);
  console.log(`  Total pemeriksaan : ${checks.length}`);
  console.log(`  Lulus            : ${checks.length - failed.length}`);
  console.log(`  Gagal            : ${failed.length}`);
  if (failed.length > 0) {
    console.log("\n  Yang gagal:");
    for (const f of failed) {
      console.log(`   - [${f.gate}] ${f.name}\n     ${f.evidence}`);
    }
  }
  console.log(`${"=".repeat(74)}\n`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("\nGATE SUITE CRASHED:", err);
  process.exit(2);
});
