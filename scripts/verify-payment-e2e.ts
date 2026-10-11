/**
 * E2E verification of chapter 8.C: the owner sets a payment destination in the
 * dashboard, the API round-trips it, and the anti-hallucination guard blocks an
 * invented account number while allowing the real one.
 *
 * Creates a real tenant through the public auth endpoint, exercises the real
 * HTTP API, then deletes everything it created.
 */
import { PrismaClient } from "@prisma/client";
import { findUnbackedAccountNumbers } from "../src/lib/ai/orchestrator";

const prisma = new PrismaClient();
const BASE = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3001";

type Check = { name: string; pass: boolean; evidence: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
  console.log(`  [${pass ? "PASS" : "FAIL"}] ${name}\n         ${evidence}`);
}

let cookie = "";
let tenantId = "";

async function post(body: unknown) {
  const res = await fetch(`${BASE}/api/dashboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

/** The dashboard UI reads payment config from the health GET, not from the catalog action. */
async function health() {
  const res = await fetch(`${BASE}/api/dashboard`, { headers: { cookie } });
  return res.json();
}

async function main() {
  const email = `payment-e2e-${Date.now()}@noewbar-e2e.local`;

  // 1. Real registration through the public API.
  const reg = await fetch(`${BASE}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "register",
      email,
      password: "RahasiaUji123!",
      business_name: "Toko Uji Pembayaran",
      owner_name: "Penguji",
      owner_whatsapp: "628123456789",
    }),
  });
  const regJson = await reg.json();
  const setCookie = reg.headers.get("set-cookie") ?? "";
  cookie = setCookie.split(";")[0];
  tenantId = regJson.tenant?.id ?? regJson.id ?? "";
  record(
    "Tenant uji terdaftar lewat API asli",
    reg.status === 200 && Boolean(cookie),
    `HTTP ${reg.status}, cookie ${cookie ? "ada" : "TIDAK ADA"}, tenant ${tenantId || "?"}`
  );

  if (!tenantId) {
    const row = await prisma.tenant.findUnique({ where: { email } });
    tenantId = row?.id ?? "";
  }

  // 2. Baseline: no payment destination yet.
  const before = await health();
  record(
    "Sebelum diisi: rekening kosong dan guard tahu itu",
    before.catalog?.bank_account_number === "" && before.catalog?.qris_key === null,
    `bank='${before.catalog?.bank_account_number}', qris=${JSON.stringify(before.catalog?.qris_key)}`
  );

  // 3. Save the owner's real account number.
  const saved = await post({
    action: "save_payment",
    bank_name: "BCA",
    bank_account_number: "1234567890",
    bank_account_holder: "Toko Uji Pembayaran",
  });
  record(
    "save_payment menyimpan rekening pemilik",
    saved.json.ok === true && saved.json.bank_account_number === "1234567890",
    `HTTP ${saved.status}, tersimpan '${saved.json.bank_account_number}'`
  );

  // 4. Read back through the health endpoint the dashboard actually uses.
  const after = await health();
  record(
    "Nilai rekening bertahan di database",
    after.catalog?.bank_name === "BCA" &&
      after.catalog?.bank_account_number === "1234567890" &&
      after.catalog?.bank_account_holder === "Toko Uji Pembayaran",
    `${after.catalog?.bank_name} / ${after.catalog?.bank_account_number} / ${after.catalog?.bank_account_holder}`
  );

  // 5. QRIS key that does not exist in MinIO must be refused.
  const badQris = await post({ action: "save_payment", qris_object_key: "tenants/none/qr/nope.png" });
  record(
    "Key QRIS palsu ditolak (fail-closed)",
    badQris.status === 422,
    `HTTP ${badQris.status}: ${badQris.json.error ?? "-"}`
  );

  // 6. The guard: an invented account number is blocked, the saved one is allowed.
  const payment = { bankName: "BCA", bankAccountNumber: "1234567890", bankAccountHolder: "", qrisUrl: null };
  const invented = findUnbackedAccountNumbers(
    "Silakan transfer ke rekening BCA 9876543210 a/n Toko Lain ya kak",
    [],
    payment
  );
  const real = findUnbackedAccountNumbers(
    "Silakan transfer ke rekening BCA 1234567890 a/n Toko Uji Pembayaran ya kak",
    [],
    payment
  );
  record(
    "Nomor rekening karangan diblokir",
    invented.length === 1,
    `karangan -> terdeteksi ${JSON.stringify(invented)}`
  );
  record(
    "Nomor rekening asli milik pemilik diloloskan",
    real.length === 0,
    `asli -> ${JSON.stringify(real)}`
  );

  // 7. A number that legitimately came out of a tool must not be flagged.
  const fromTool = findUnbackedAccountNumbers(
    "Nomor resi 1234567890123 sudah kami catat ya kak",
    [{ tool: "tool_atur_nudge", payload: { note: "1234567890123" }, summary: "", media: [], escalated: false }],
    payment
  );
  record(
    "Angka yang berasal dari tool tidak salah dituduh",
    fromTool.length === 0,
    `dari tool -> ${JSON.stringify(fromTool)}`
  );

  // 8. Emptying the field clears it.
  const cleared = await post({ action: "save_payment", bank_account_number: "" });
  record(
    "Rekening bisa dikosongkan kembali",
    cleared.json.ok === true && cleared.json.bank_account_number === "",
    `setelah dikosongkan '${cleared.json.bank_account_number}'`
  );
}

main()
  .catch((e) => {
    console.error("E2E_ERROR:", e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  })
  .finally(async () => {
    if (tenantId) {
      // Remove every row the suite created, in FK order.
      const conv = await prisma.conversation.findMany({ where: { tenant_id: tenantId }, select: { id: true } });
      const ids = conv.map((c) => c.id);
      await prisma.chatMessage.deleteMany({ where: { conversation_id: { in: ids } } }).catch(() => {});
      await prisma.scheduledNudge.deleteMany({ where: { conversation_id: { in: ids } } }).catch(() => {});
      await prisma.order.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
      await prisma.conversation.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
      await prisma.waInstance.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
      await prisma.catalogSetting.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
      await prisma.subscription.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
      await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    }
    const leftover = await prisma.tenant.findFirst({ where: { email: { contains: "@noewbar-e2e.local" } } });
    record("Tenant uji dibersihkan", leftover === null, leftover ? `MASIH ADA: ${leftover.email}` : "database bersih");

    const failed = checks.filter((c) => !c.pass);
    console.log("\n" + "=".repeat(66));
    console.log(`  Total: ${checks.length}  Lulus: ${checks.length - failed.length}  Gagal: ${failed.length}`);
    console.log("=".repeat(66));
    await prisma.$disconnect();
    if (failed.length > 0) process.exitCode = 1;
  });
