/**
 * End-to-end SSE verification against a REAL running server on :3001.
 *
 *   1. Register a real tenant (correct `intent` field + required fields).
 *   2. Read that tenant's auto-created instance_key straight from the DB.
 *   3. Open the tenant SSE stream with the session cookie.
 *   4. NEGATIVE: a foreign instance must 404 and emit NO event.
 *   5. POSITIVE: a real inbound (share-location) must emit a `chat` event.
 *   6. Cleanup: delete the test tenant (marked noewbar-test.local).
 *
 * Run:  node scripts/sse-verify.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

function loadEnv() {
  const p = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
loadEnv();

const BASE = process.argv[2] ?? "http://127.0.0.1:3001";
const SECRET = process.env.WHATSMEOW_SECRET ?? "";
const stamp = Date.now();
const email = `sse-verify-${stamp}@noewbar-test.local`;
const prisma = new PrismaClient({ log: [] });

let pass = 0;
let fail = 0;
function check(name, ok, ev) {
  if (ok) { pass++; console.log(`  [PASS] ${name}\n         ${ev}`); }
  else { fail++; console.log(`  [FAIL] ${name}\n         ${ev}`); }
}

async function main() {
  console.log(`\n${"=".repeat(64)}\n  SSE E2E VERIFY terhadap ${BASE}\n${"=".repeat(64)}`);

  // 1. Register a real tenant.
  const reg = await fetch(`${BASE}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "register",
      email,
      password: "RahasiaKuat123!",
      business_name: "SSE Verify Store",
      owner_name: "SSE Verifier",
      owner_whatsapp: "628123456789",
      sheets_url: "https://docs.google.com/spreadsheets/d/SSEVERIFYPLACEHOLDER/edit",
      origin_subdistrict: "Kecamatan Uji",
    }),
  });
  const cookie = (reg.headers.get("set-cookie") ?? "").split(";")[0];
  check(
    "Registrasi tenant nyata + cookie sesi diterbitkan",
    reg.status === 200 && cookie.includes("noewbar_session"),
    `HTTP ${reg.status}, cookie=${cookie.slice(0, 26)}...`
  );
  if (!cookie.includes("noewbar_session")) {
    console.log("  [FATAL] tanpa sesi, uji tidak bisa lanjut:", await reg.text().catch(() => ""));
    await cleanup();
    await prisma.$disconnect();
    process.exit(1);
  }

  // 2. Read the tenant's instance_key from the DB.
  const inst = await prisma.waInstance.findFirst({
    where: { tenant: { email } },
    select: { instance_key: true },
  });
  console.log(`  [INFO] instance_key (DB): ${inst?.instance_key ?? "(none)"}`);
  check("Instance WhatsApp dibuat otomatis saat registrasi", Boolean(inst?.instance_key), `${inst?.instance_key ?? "-"}`);

  // 3. Open the SSE stream.
  const ac = new AbortController();
  const received = [];
  const streamTask = (async () => {
    const res = await fetch(`${BASE}/api/realtime?scope=tenant`, {
      headers: { cookie, Accept: "text/event-stream" },
      signal: ac.signal,
    });
    check(
      "SSE stream terbuka dengan sesi tenant (text/event-stream)",
      res.status === 200 && (res.headers.get("content-type") ?? "").includes("text/event-stream"),
      `HTTP ${res.status}, ct=${res.headers.get("content-type")}`
    );
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) !== -1) {
          const chunk = buf.slice(0, i);
          buf = buf.slice(i + 2);
          if (chunk.startsWith("data:")) {
            try { received.push(JSON.parse(chunk.slice(5).trim())); } catch { /* ignore */ }
          }
        }
      }
    } catch { /* aborted */ }
  })();

  await new Promise((r) => setTimeout(r, 900));

  // 4. NEGATIVE: foreign instance -> 404, no event.
  const foreign = await fetch(`${BASE}/api/wa-webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Noewbar-Secret": SECRET },
    body: JSON.stringify({
      instance_key: "sse-nonexistent-instance",
      sender_jid: "628999@s.whatsapp.net",
      body: "halo",
      message_id: `sse-neg-${stamp}`,
    }),
  });
  check("Webhook instance asing tetap 404 (isolasi tenant)", foreign.status === 404, `HTTP ${foreign.status}`);
  await new Promise((r) => setTimeout(r, 500));
  check("SSE tidak menerima event palsu dari instance asing", received.length === 0, `events=${received.length}`);

  // 5. POSITIVE: real inbound share-location -> notifyTenant({type:"chat"}).
  if (inst?.instance_key) {
    const inbound = await fetch(`${BASE}/api/wa-webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Noewbar-Secret": SECRET },
      body: JSON.stringify({
        instance_key: inst.instance_key,
        sender_jid: "628555@s.whatsapp.net",
        sender_name: "Buyer SSE",
        body: "",
        latitude: -6.2,
        longitude: 106.816,
        message_id: `sse-pos-${stamp}`,
      }),
    });
    const ib = await inbound.json().catch(() => null);
    console.log(`  [INFO] inbound share-location -> HTTP ${inbound.status}, body=${JSON.stringify(ib)?.slice(0, 160)}`);
    await new Promise((r) => setTimeout(r, 1800));
    const gotChat = received.some((e) => e && e.type === "chat");
    check(
      "SSE menerima event 'chat' NYATA dari inbound tenant",
      gotChat,
      `events=${JSON.stringify(received).slice(0, 240)}`
    );
  } else {
    check("SSE menerima event nyata dari inbound tenant", false, "instance_key tidak tersedia");
  }

  ac.abort();
  await new Promise((r) => setTimeout(r, 200));

  await cleanup();

  console.log(`\n${"=".repeat(64)}`);
  console.log(`  Total ${pass + fail} | Lulus ${pass} | Gagal ${fail}`);
  console.log(`${"=".repeat(64)}`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

async function cleanup() {
  try {
    const t = await prisma.tenant.findFirst({ where: { email }, select: { id: true } });
    if (t) {
      await prisma.tenant.delete({ where: { id: t.id } });
      const left = await prisma.tenant.count({ where: { email } });
      console.log(`  [INFO] cleanup: tenant ${t.id} dihapus, sisa=${left}`);
    }
  } catch (e) {
    console.log(`  [INFO] cleanup gagal: ${e instanceof Error ? e.message : String(e)}`);
  }
}

main().catch(async (e) => {
  console.error("FATAL", e);
  await cleanup().catch(() => {});
  await prisma.$disconnect().catch(() => {});
  process.exit(2);
});
