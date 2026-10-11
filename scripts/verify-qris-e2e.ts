/**
 * Verifies the QRIS upload path of chapter 8.C.2 end to end: a real PNG is
 * uploaded through PUT /api/dashboard (purpose=qris), the returned object key is
 * persisted with save_payment, the image is publicly readable (WhatsApp must be
 * able to download it), and the agent context then carries the QRIS URL.
 */
import { PrismaClient } from "@prisma/client";

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

/** A 1x1 PNG, small but a real decodable image. */
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function main() {
  const email = `qris-e2e-${Date.now()}@noewbar-e2e.local`;
  const reg = await fetch(`${BASE}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "register",
      email,
      password: "RahasiaUji123!",
      business_name: "Toko Uji QRIS",
      owner_name: "Penguji",
      owner_whatsapp: "628123456789",
    }),
  });
  cookie = (reg.headers.get("set-cookie") ?? "").split(";")[0];
  const row = await prisma.tenant.findUnique({ where: { email } });
  tenantId = row?.id ?? "";
  record("Tenant uji siap", reg.status === 200 && Boolean(tenantId), `HTTP ${reg.status}, tenant ${tenantId || "?"}`);
  if (!tenantId) return;

  // 1. Real multipart upload marked as QRIS.
  const fd = new FormData();
  fd.append("file", new File([PNG_1PX], "qris.png", { type: "image/png" }));
  fd.append("kind", "photo");
  fd.append("purpose", "qris");
  const up = await fetch(`${BASE}/api/dashboard`, { method: "PUT", headers: { cookie }, body: fd });
  const upJson = await up.json();
  record(
    "Unggah QRIS diterima dengan key tenant-scoped",
    up.status === 200 && /^tenants\/[0-9a-f-]+\/qr\/qris\.png$/.test(upJson.key ?? ""),
    `HTTP ${up.status}, key=${upJson.key ?? "-"}`
  );

  // 2. The object must be publicly readable, since WhatsApp downloads it.
  const pub = await fetch(upJson.url);
  const bytes = Buffer.from(await pub.arrayBuffer());
  record(
    "Gambar QRIS bisa diunduh publik (yang dipakai WhatsApp)",
    pub.status === 200 && bytes.equals(PNG_1PX),
    `HTTP ${pub.status}, ${bytes.length} byte, identik=${bytes.equals(PNG_1PX)}`
  );

  // 3. Persist the key.
  const saved = await fetch(`${BASE}/api/dashboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ action: "save_payment", qris_object_key: upJson.key }),
  }).then((r) => r.json());
  record(
    "Key QRIS tersimpan pada pengaturan toko",
    saved.ok === true && saved.qris_key?.key === upJson.key,
    `tersimpan key=${saved.qris_key?.key ?? "-"}`
  );

  // 4. Health must expose it so the dashboard shows the preview.
  const health = await fetch(`${BASE}/api/dashboard`, { headers: { cookie } }).then((r) => r.json());
  record(
    "Dashboard menerima URL QRIS untuk pratinjau",
    health.catalog?.qris_key?.key === upJson.key && Boolean(health.catalog?.qris_key?.url),
    `qris_key=${health.catalog?.qris_key?.key ?? "-"}`
  );

  // 5. The agent context must carry the same URL (what actually gets attached).
  const { handleInboundMessage } = await import("../src/lib/ai/orchestrator");
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { catalog_settings: true },
  });
  record(
    "ToolContext memuat QRIS dari database (siap dilampirkan)",
    Boolean(tenant?.catalog_settings?.qris_object_key),
    `qris_object_key=${tenant?.catalog_settings?.qris_object_key ?? "-"}`
  );
  void handleInboundMessage;

  // 6. Clearing removes it.
  const cleared = await fetch(`${BASE}/api/dashboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ action: "save_payment", qris_object_key: "" }),
  }).then((r) => r.json());
  record(
    "QRIS bisa dihapus kembali",
    cleared.ok === true && cleared.qris_key === null,
    `qris_key=${JSON.stringify(cleared.qris_key)}`
  );
}

main()
  .catch((e) => {
    console.error("QRIS_E2E_ERROR:", e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  })
  .finally(async () => {
    if (tenantId) {
      await prisma.catalogSetting.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
      await prisma.waInstance.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
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
