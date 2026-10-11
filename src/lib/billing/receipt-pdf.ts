/**
 * Receipt PDF generator (chapter 7: "Kirim Kuitansi Resmi PDF ke WhatsApp").
 *
 * Generates a compact, print-friendly payment receipt without any layout
 * dependency, since pdfkit draws the table directly. The bytes are uploaded to the
 * tenant's MinIO space and the URL handed to the WhatsApp daemon as a document,
 * exactly like the spec's sequence: settlement -> kuitansi PDF -> WhatsApp owner.
 */

import PDFDocument from "pdfkit";
import { uploadObject } from "@/lib/storage/minio";

export type ReceiptData = {
  tenantId: string;
  businessName: string;
  ownerName: string;
  orderId: string;
  planName: string;
  amount: number;
  paymentType: string;
  transactionId: string | null;
  paidAt: Date;
  newExpiresAt: Date;
};

function rupiah(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

export async function generatePaymentReceiptPdf(
  data: ReceiptData
): Promise<{ ok: true; url: string; key: string } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    try {
      const doc = new PDFDocument({ size: "A5", margin: 36, bufferPages: false });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", async () => {
        const pdf = Buffer.concat(chunks);
        try {
          const key = `tenants/${data.tenantId}/receipts/${data.orderId}.pdf`;
          const up = await uploadObject(key, pdf, "application/pdf");
          resolve({ ok: true, url: up.url, key });
        } catch (err) {
          resolve({ ok: false, error: err instanceof Error ? err.message : String(err) });
        }
      });
      doc.on("error", (err: Error) => resolve({ ok: false, error: err.message }));

      // --- header ---
      doc.fontSize(16).fillColor("#111").font("Helvetica-Bold").text("NOEWBAR CS PRO", { align: "left" });
      doc.fontSize(8.5).fillColor("#666").font("Helvetica").text("Kuitansi Pembayaran Langganan", { align: "left" });
      doc.moveDown(1.2);

      // --- store + order identity ---
      doc.fontSize(10).fillColor("#333").font("Helvetica-Bold").text(`Atas nama: ${data.businessName}`);
      doc.font("Helvetica").fontSize(9).fillColor("#555");
      doc.text(`Pemilik: ${data.ownerName}`);
      doc.text(`No. Order: ${data.orderId}`);
      doc.text(`Paket: ${data.planName}`);
      doc.text(`Waktu bayar: ${data.paidAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}`);
      doc.moveDown(0.8);

      // --- amount box ---
      doc.rect(doc.x, doc.y, 220, 30).fill("#f2f2f2");
      doc.fillColor("#111").font("Helvetica-Bold").fontSize(13).text(`Total dibayar: ${rupiah(data.amount)}`, doc.x + 10, doc.y + 8);
      doc.moveDown(1.6);

      // --- payment detail table ---
      const rows: [string, string][] = [
        ["Metode", data.paymentType.toUpperCase()],
        ["Transaksi", data.transactionId ?? "-"],
        ["Status", "LUNAS"],
        ["Masa aktif sampai", data.newExpiresAt.toLocaleDateString("id-ID", { dateStyle: "long" })],
      ];
      doc.fontSize(9).fillColor("#333");
      let y = doc.y;
      for (const [k, v] of rows) {
        doc.rect(doc.x, y, 90, 18).fill("#f2f2f2").stroke("#ddd");
        doc.fillColor("#111").font("Helvetica-Bold").text(k, doc.x + 6, y + 5);
        doc.fillColor("#333").font("Helvetica").text(v, doc.x + 100, y + 5);
        y += 19;
      }

      doc.moveDown(1.2);
      doc.fontSize(8).fillColor("#888").font("Helvetica");
      doc.text("Bukti ini diterbitkan otomatis oleh sistem pembayaran Noewbar CS Pro setelah pembayaran dikonfirmasi.", {
        width: 220,
      });

      doc.end();
    } catch (err) {
      resolve({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });
}