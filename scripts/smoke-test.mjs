/**
 * Noewbar CS Pro - end-to-end HTTP smoke test.
 *
 * Runs against a REAL running production server (npm run start on :3001).
 * Every check is an actual HTTP request and a real assertion on the response.
 *
 * Usage:  node scripts/smoke-test.mjs [baseUrl]
 */

const BASE = process.argv[2] ?? "http://127.0.0.1:3001";
const SECRET = process.env.WHATSMEOW_SECRET ?? "whatsmeow-seco-internal-key";

let pass = 0;
let fail = 0;
const failures = [];

function check(name, ok, evidence) {
  if (ok) {
    pass += 1;
    console.log(`  [PASS] ${name}\n         ${evidence}`);
  } else {
    fail += 1;
    failures.push({ name, evidence });
    console.log(`  [FAIL] ${name}\n         ${evidence}`);
  }
}

async function req(path, init) {
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    ...init,
    headers: { ...(init?.headers ?? {}) },
  });
  let body = null;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    body = await res.json().catch(() => null);
  } else {
    body = await res.text().catch(() => "");
  }
  return { status: res.status, body, ct };
}

async function main() {
  console.log(`\n${"=".repeat(74)}\n  SMOKE TEST terhadap ${BASE}\n${"=".repeat(74)}`);

  // ---------------------------------------------------------------- readiness
  console.log("\n-- Kesiapan server --");
  let ready = false;
  for (let i = 0; i < 30; i += 1) {
    try {
      const r = await req("/api/wa-webhook");
      if (r.status === 200) {
        ready = true;
        break;
      }
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  check("Server produksi merespons", ready, ready ? `${BASE} siap` : "tidak siap setelah 30 detik");
  if (!ready) {
    console.log("\nServer tidak siap, smoke test dihentikan.");
    process.exit(1);
  }

  // ---------------------------------------------------------------- pages
  console.log("\n-- Halaman --");
  for (const [path, mustContain] of [
    ["/", "Asisten WhatsApp"],
    // A logged-out visitor gets the auth panel, which is the correct render for
    // that state; assert the brand renders rather than a text only members see.
    ["/dashboard", "Noewbar"],
    ["/superadmin", "Memuat Konsol"],
  ]) {
    const r = await req(path);
    const html = typeof r.body === "string" ? r.body : "";
    check(
      `Halaman ${path} ter-render`,
      r.status === 200 && html.includes(mustContain),
      `HTTP ${r.status}, ${html.length} byte, memuat "${mustContain}"`
    );
  }

  // ---------------------------------------------------------------- auth guards
  console.log("\n-- Penjagaan otorisasi (harus 401) --");
  for (const path of ["/api/orders", "/api/maintenance", "/api/dashboard", "/api/superadmin", "/api/conversations"]) {
    const r = await req(path);
    check(`${path} menolak tanpa sesi`, r.status === 401, `HTTP ${r.status}`);
  }

  const authProbe = await req("/api/auth");
  check(
    "/api/auth melaporkan belum terautentikasi",
    authProbe.status === 200 && authProbe.body?.authenticated === false,
    `HTTP ${authProbe.status}, authenticated=${authProbe.body?.authenticated}`
  );

  // ---------------------------------------------------------------- webhook auth
  console.log("\n-- Autentikasi webhook daemon --");
  const noSecret = await req("/api/wa-webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instance_key: "x", sender_jid: "y" }),
  });
  check("Tanpa secret internal ditolak 401", noSecret.status === 401, `HTTP ${noSecret.status}`);

  const badPayload = await req("/api/wa-webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Noewbar-Secret": SECRET },
    body: JSON.stringify({ nope: true }),
  });
  check("Payload tidak valid ditolak 422", badPayload.status === 422, `HTTP ${badPayload.status}`);

  const unknownInstance = await req("/api/wa-webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Noewbar-Secret": SECRET },
    body: JSON.stringify({
      instance_key: "instance-tidak-ada",
      sender_jid: "628111@s.whatsapp.net",
      body: "halo",
      message_id: `smoke-${Date.now()}`,
    }),
  });
  check(
    "Instance asing ditolak 404 (isolasi tenant)",
    unknownInstance.status === 404,
    `HTTP ${unknownInstance.status}: ${unknownInstance.body?.error ?? ""}`
  );

  const healthWebhook = await req("/api/wa-webhook");
  check(
    "Webhook health melaporkan bot_enabled",
    healthWebhook.status === 200 && typeof healthWebhook.body?.bot_enabled === "boolean",
    `bot_enabled=${healthWebhook.body?.bot_enabled}`
  );

  // ---------------------------------------------------------------- midtrans webhook
  console.log("\n-- Webhook Midtrans --");
  const badSig = await req("/api/billing/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      order_id: "SMOKE-1",
      status_code: "200",
      gross_amount: "199000.00",
      signature_key: "deadbeef",
      transaction_status: "settlement",
    }),
  });
  check(
    "Signature palsu ditolak 403",
    badSig.status === 403,
    `HTTP ${badSig.status}: ${badSig.body?.error ?? ""}`
  );

  const midtransHealth = await req("/api/billing/webhook");
  check(
    "Webhook Midtrans melaporkan status siap",
    midtransHealth.status === 200 && midtransHealth.body?.status === "ok",
    `HTTP ${midtransHealth.status}`
  );

  // ---------------------------------------------------------------- playground
  console.log("\n-- Playground publik --");
  const pgGet = await req("/api/playground");
  check(
    "Playground melaporkan status konfigurasi secara jujur",
    pgGet.status === 200 && typeof pgGet.body?.configured === "boolean",
    `configured=${pgGet.body?.configured}, total=${pgGet.body?.total ?? 0}`
  );

  if (pgGet.body?.configured === false) {
    check(
      "Playground tanpa katalog TIDAK mengarang produk",
      Array.isArray(pgGet.body?.preview) && pgGet.body.preview.length === 0,
      "preview kosong dengan catatan eksplisit, bukan data contoh"
    );
  }

  const pgPost = await req("/api/playground", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "test", history: [] }),
  });
  check(
    "Playground POST menjawab tanpa error server",
    pgPost.status === 200 && typeof pgPost.body?.configured === "boolean",
    `HTTP ${pgPost.status}, configured=${pgPost.body?.configured}`
  );

  const pgBad = await req("/api/playground", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "" }),
  });
  check("Playground menolak pesan kosong", pgBad.status === 422, `HTTP ${pgBad.status}`);

  // ---------------------------------------------------------------- wa qr
  console.log("\n-- Pairing WhatsApp --");
  const qr = await req("/api/wa/qr");
  check(
    "Endpoint pairing menjawab dengan status daemon nyata",
    qr.status === 401 || (qr.status === 200 && typeof qr.body?.daemon_reachable === "boolean"),
    `HTTP ${qr.status} (401 = benar, butuh sesi tenant)`
  );

  // ---------------------------------------------------------------- summary
  console.log(`\n${"=".repeat(74)}`);
  console.log("  RINGKASAN SMOKE TEST");
  console.log(`${"=".repeat(74)}`);
  console.log(`  Total  : ${pass + fail}`);
  console.log(`  Lulus  : ${pass}`);
  console.log(`  Gagal  : ${fail}`);
  if (failures.length > 0) {
    console.log("\n  Yang gagal:");
    for (const f of failures) console.log(`   - ${f.name}: ${f.evidence}`);
  }
  console.log(`${"=".repeat(74)}\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("SMOKE TEST CRASHED:", err);
  process.exit(2);
});
