import PDFDocument from "pdfkit";

export interface ShippingLabelData {
  orderNumber: string;
  storeName: string;
  storePhone?: string;
  storeOrigin?: string;
  buyerName: string;
  buyerPhone: string;
  destinationAddress: string;
  destinationSubdistrict?: string;
  courier: string;
  courierService?: string;
  trackingNumber?: string;
  totalWeightKg?: number;
  items: Array<{
    name: string;
    variant?: string;
    qty: number;
  }>;
  totalAmount: number;
  isCod?: boolean;
  notes?: string;
}

function cleanPdfText(str?: string | null): string {
  if (!str) return "";
  return str
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, " ")
    .trim();
}

/**
 * Generate a standard 100x150 mm (4x6 inch) thermal shipping label PDF.
 * Dimensions in points: 283.46 x 425.20 pt.
 */
export async function generateThermalShippingLabel(data: ShippingLabelData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // 100mm x 150mm in PostScript points
    const doc = new PDFDocument({
      size: [283.46, 425.2],
      margins: { top: 12, bottom: 12, left: 12, right: 12 },
      info: {
        Title: `Shipping Label - ${data.orderNumber}`,
        Author: "Noewbar CS Pro Logistics",
      },
    });

    const buffers: Buffer[] = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", (err) => reject(err));

    const left = 14;
    const width = 255.46;
    let y = 14;

    // --- 1. Outer Border ---
    doc.rect(left, y, width, 397).lineWidth(1.5).strokeColor("#0F172A").stroke();

    // --- 2. Header: Courier & Service Badge ---
    const headerHeight = 38;
    doc.rect(left, y, width, headerHeight).fillColor("#0F172A").fill();

    doc.fillColor("#FFFFFF").fontSize(16).font("Helvetica-Bold");
    const safeCourier = cleanPdfText(data.courier).toUpperCase();
    const safeCourierService = cleanPdfText(data.courierService).toUpperCase();
    const courierLabel = `${safeCourier} ${safeCourierService ? `- ${safeCourierService}` : ""}`;
    doc.text(courierLabel, left + 8, y + 10, { width: 170, ellipsis: true });

    // Payment Badge: NON-COD or COD
    const badgeText = data.isCod ? "COD" : "NON-COD";
    doc.fontSize(10).font("Helvetica-Bold");
    doc.rect(left + width - 68, y + 8, 60, 22).fillColor(data.isCod ? "#EF4444" : "#10B981").fill();
    doc.fillColor("#FFFFFF").text(badgeText, left + width - 68, y + 14, { width: 60, align: "center" });

    y += headerHeight;

    // --- 3. Order & Barcode Bar ---
    doc.rect(left, y, width, 40).strokeColor("#CBD5E1").lineWidth(1).stroke();

    doc.fillColor("#64748B").fontSize(8).font("Helvetica").text("NO. PESANAN / RESI:", left + 8, y + 6);
    doc.fillColor("#0F172A").fontSize(11).font("Helvetica-Bold").text(data.orderNumber, left + 8, y + 17);

    if (data.trackingNumber) {
      doc.fillColor("#0F172A").fontSize(9).font("Helvetica-Bold").text(`RESI: ${data.trackingNumber}`, left + 140, y + 17, { align: "right", width: 105 });
    }

    y += 40;

    // --- 4. Penerima (Recipient) Section ---
    const recipientHeight = 90;
    doc.rect(left, y, width, recipientHeight).strokeColor("#CBD5E1").lineWidth(0.5).stroke();

    doc.fillColor("#64748B").fontSize(7).font("Helvetica-Bold").text("PENERIMA (TUJUAN):", left + 8, y + 6);
    const safeBuyerName = cleanPdfText(data.buyerName) || "Pelanggan";
    doc.fillColor("#0F172A").fontSize(11).font("Helvetica-Bold").text(safeBuyerName, left + 8, y + 16, { width: width - 16 });
    doc.fillColor("#1E293B").fontSize(9).font("Helvetica").text(`Telp: ${cleanPdfText(data.buyerPhone)}`, left + 8, y + 30);

    const fullAddr = cleanPdfText([data.destinationAddress, data.destinationSubdistrict].filter(Boolean).join(", "));
    doc.fillColor("#334155").fontSize(8).font("Helvetica").text(fullAddr || "Alamat tujuan sesuai pesanan", left + 8, y + 43, {
      width: width - 16,
      height: 38,
      ellipsis: true,
    });

    y += recipientHeight;

    // --- 5. Pengirim (Sender) Section ---
    const senderHeight = 44;
    doc.rect(left, y, width, senderHeight).strokeColor("#CBD5E1").lineWidth(0.5).stroke();

    doc.fillColor("#64748B").fontSize(7).font("Helvetica-Bold").text("PENGIRIM:", left + 8, y + 6);
    const safeStoreName = cleanPdfText(data.storeName) || "Toko Online";
    doc.fillColor("#0F172A").fontSize(9).font("Helvetica-Bold").text(safeStoreName, left + 8, y + 16, { width: width - 16 });
    const storeInfo = cleanPdfText([data.storePhone ? `Telp: ${data.storePhone}` : null, data.storeOrigin ? `Kota: ${data.storeOrigin}` : null].filter(Boolean).join(" | "));
    doc.fillColor("#475569").fontSize(8).font("Helvetica").text(storeInfo || "Pengiriman Indonesia", left + 8, y + 28);

    y += senderHeight;

    // --- 6. Isi Paket / Packing Details ---
    const itemsHeight = 135;
    doc.rect(left, y, width, itemsHeight).strokeColor("#CBD5E1").lineWidth(0.5).stroke();

    doc.fillColor("#64748B").fontSize(7).font("Helvetica-Bold").text("DETAIL ISI PAKET:", left + 8, y + 6);
    doc.fillColor("#64748B").fontSize(7).font("Helvetica").text(`Berat: ~${data.totalWeightKg ?? 1} kg`, left + width - 70, y + 6, { width: 62, align: "right" });

    let itemY = y + 18;
    const displayedItems = (data.items || []).slice(0, 5);
    displayedItems.forEach((it, idx) => {
      const line = cleanPdfText(`${idx + 1}. ${it.name}${it.variant ? ` (${it.variant})` : ""} x ${it.qty}`);
      doc.fillColor("#1E293B").fontSize(8).font("Helvetica").text(line, left + 8, itemY, { width: width - 16, ellipsis: true });
      itemY += 14;
    });

    if ((data.items || []).length > 5) {
      doc.fillColor("#64748B").fontSize(7).font("Helvetica-Oblique").text(`+ ${(data.items || []).length - 5} produk lainnya...`, left + 8, itemY);
    }

    if (data.notes) {
      doc.fillColor("#B45309").fontSize(7).font("Helvetica-Bold").text(`Catatan: ${cleanPdfText(data.notes)}`, left + 8, y + itemsHeight - 22, { width: width - 16, ellipsis: true });
    }

    y += itemsHeight;

    // --- 7. Footer / Brand Signoff ---
    doc.rect(left, y, width, 48).fillColor("#F8FAFC").fill();
    doc.rect(left, y, width, 48).strokeColor("#CBD5E1").lineWidth(0.5).stroke();

    doc.fillColor("#0F172A").fontSize(8).font("Helvetica-Bold").text("NOEWBAR CS PRO - LOGISTICS SYSTEM", left + 8, y + 12);
    doc.fillColor("#64748B").fontSize(7).font("Helvetica").text("Instruksi Kurir: Mohon jangan dibanting atau terkena air.", left + 8, y + 24);
    doc.fillColor("#94A3B8").fontSize(6).font("Helvetica").text(`Dicetak pada: ${new Date().toLocaleString("id-ID")}`, left + 8, y + 34);

    doc.end();
  });
}
