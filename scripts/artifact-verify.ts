/**
 * Heavy-artifact verification (real, no mocks):
 *   A. generatePaymentReceiptPdf -> uploads a REAL PDF to MinIO, then we
 *      re-fetch the returned URL and assert it is a real PDF (%PDF header).
 *   B. analyzeProofMedia -> real vision call to the 9router gateway on a real
 *      image, asserting it returns a well-formed OcrResult (supportive-only).
 *
 * Run:  npx tsx scripts/artifact-verify.ts
 */

import fs from "node:fs";
import path from "node:path";

function loadEnv(): void {
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

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, ev: string): void {
  if (ok) { pass++; console.log(`  [PASS] ${name}\n         ${ev}`); }
  else { fail++; console.log(`  [FAIL] ${name}\n         ${ev}`); }
}

async function main(): Promise<void> {
  console.log(`\n${"=".repeat(64)}\n  ARTIFACT VERIFY (receipt PDF + vision OCR)\n${"=".repeat(64)}`);

  // ---- A. Receipt PDF -> MinIO ------------------------------------------
  const { generatePaymentReceiptPdf } = await import("../src/lib/billing/receipt-pdf");
  const tenantId = `artifact-verify-${Date.now()}`;
  const orderId = `TEST-${Date.now()}`;
  const res = await generatePaymentReceiptPdf({
    tenantId,
    businessName: "Toko Verifikasi Artifact",
    ownerName: "Pemilik Uji",
    orderId,
    planName: "PRO",
    amount: 199000,
    paymentType: "qris",
    transactionId: "txn-verify-123",
    paidAt: new Date(),
    newExpiresAt: new Date(Date.now() + 30 * 86_400_000),
  });
  check("Kuitansi PDF dihasilkan + terunggah ke MinIO", res.ok === true, res.ok ? `url=${res.url}` : `error=${res.error}`);

  if (res.ok) {
    const fetchRes = await fetch(res.url, { cache: "no-store" });
    const buf = Buffer.from(await fetchRes.arrayBuffer());
    const head = buf.subarray(0, 5).toString("latin1");
    check(
      "Kuitansi benar-benar PDF nyata (header %PDF, >1KB)",
      fetchRes.status === 200 && head.startsWith("%PDF") && buf.length > 1024,
      `HTTP ${fetchRes.status}, head='${head}', ${buf.length} bytes, ct=${fetchRes.headers.get("content-type")}`
    );
    // Teardown the artifact.
    try {
      const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      const minioMod: Record<string, unknown> = await import("../src/lib/storage/minio");
      if (typeof minioMod.deleteObject === "function") {
        await (minioMod.deleteObject as (k: string) => Promise<unknown>)(`tenants/${tenantId}/receipts/${orderId}.pdf`);
        console.log(`  [INFO] cleanup: artefak receipt dihapus`);
      } else {
        console.log(`  [INFO] cleanup: deleteObject tidak diekspor, lewati (${String(DeleteObjectCommand?.name)} tersedia)`);
      }
    } catch (e) {
      console.log(`  [INFO] cleanup receipt dilewati: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ---- B. Vision OCR -> 9router gateway ---------------------------------
  const { analyzeProofMedia } = await import("../src/lib/ai/vision-ocr");
  const { uploadObject, deleteObject } = await import("../src/lib/storage/minio");

  // The gateway downloads the media server-side, so the URL must be reachable
  // FROM the gateway. A public third-party host rejects it (HTTP 400), but our
  // own MinIO origin is on the same network as the gateway. So we build a real
  // PNG here, upload it to MinIO, and OCR it from that origin.
  const png = makeSolidPng(240, 120, [245, 245, 245]);
  const imgKey = `tenants/${tenantId}/verify-ocr-${Date.now()}.png`;
  let ocrUrl = "";
  try {
    const up = await uploadObject(imgKey, png, "image/png");
    ocrUrl = up.url;
    console.log(`  [INFO] gambar uji diunggah ke MinIO: ${ocrUrl} (${png.length} bytes)`);
  } catch (e) {
    console.log(`  [INFO] upload gambar uji gagal: ${e instanceof Error ? e.message : String(e)}`);
  }
  const imgUrl = process.argv[2] ?? ocrUrl;

  if (!imgUrl && !png) {
    check("Vision OCR memanggil gateway & mengembalikan OcrResult well-formed", false, "tidak ada gambar uji");
  } else {
    try {
      // Production path: inline bytes (base64 data URL), NOT a remote URL.
      const ocr = await analyzeProofMedia({ bytes: png, mime: "image/png" });
      check(
        "Vision OCR memanggil gateway & mengembalikan OcrResult well-formed (inline bytes)",
        typeof ocr === "object" &&
          ocr.ok === true &&
          "amount" in ocr &&
          "confidence" in ocr &&
          typeof ocr.confidence === "number" &&
          ocr.confidence >= 0 &&
          ocr.confidence <= 1,
        `ok=${(ocr as { ok?: unknown }).ok} amount=${JSON.stringify((ocr as { amount?: unknown }).amount)} bank=${JSON.stringify((ocr as { bank?: unknown }).bank)} confidence=${(ocr as { confidence?: number }).confidence} err=${JSON.stringify((ocr as { error?: unknown }).error)} raw=${JSON.stringify((ocr as { raw?: unknown }).raw)?.slice(0, 160)}`
      );
    } catch (e) {
      check("Vision OCR memanggil gateway & mengembalikan OcrResult well-formed (inline bytes)", false,
        `exception: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (ocrUrl) {
    try {
      await deleteObject(imgKey);
      console.log(`  [INFO] cleanup: gambar uji dihapus dari MinIO`);
    } catch { /* best effort */ }
  }

  console.log(`\n${"=".repeat(64)}`);
  console.log(`  Total ${pass + fail} | Lulus ${pass} | Gagal ${fail}`);
  console.log(`${"=".repeat(64)}`);
  process.exit(fail === 0 ? 0 : 1);
}

/** Minimal real PNG encoder (no deps): solid RGB image via zlib deflate. */
function makeSolidPng(w: number, h: number, rgb: [number, number, number]): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const zlib = require("node:zlib") as typeof import("node:zlib");
  const row = Buffer.alloc(1 + w * 3);
  row[0] = 0; // filter: none
  for (let x = 0; x < w; x++) {
    row[1 + x * 3] = rgb[0];
    row[2 + x * 3] = rgb[1];
    row[3 + x * 3] = rgb[2];
  }
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  const idat = zlib.deflateSync(raw);

  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "latin1");
    const crc = crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  };

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

let CRC_TABLE: number[] | null = null;
function crc32(buf: Buffer): number {
  if (!CRC_TABLE) {
    CRC_TABLE = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return crc ^ 0xffffffff;
}

main().catch((e) => { console.error("FATAL", e); process.exit(2); });
