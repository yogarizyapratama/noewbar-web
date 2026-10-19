import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireTenant } from "@/lib/auth";
import { fail } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireTenant();
  if (!session) return fail("Unauthorized", 401);

  const orderId = params.id;
  if (!orderId) return fail("Order ID required", 400);

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      tenant_id: session.sub,
    },
    include: {
      tenant: {
        include: {
          catalog_settings: true,
        },
      },
    },
  });

  if (!order) {
    return fail("Order tidak ditemukan", 404);
  }

  // Parse items
  let parsedItems: Array<{ name: string; variant?: string; qty: number; price?: number; total?: number }> = [];
  try {
    if (Array.isArray(order.items)) {
      parsedItems = order.items.map((it: any) => {
        const qty = Number(it.qty || it.quantity || 1);
        const lineTotal = Number(it.line_total || it.price * qty || 0);
        const price = it.price ? Number(it.price) : qty > 0 ? lineTotal / qty : 0;
        return {
          name: it.name || it.title || "Produk",
          variant: it.variant || it.sku || "-",
          qty,
          price,
          total: lineTotal || price * qty,
        };
      });
    }
  } catch {
    // ignore parse error
  }
  const totalAmount = Number(order.total_amount || 0);
  const shippingTariff = Number(order.shipping_tariff || 0);
  const uniqueCode = Number(order.unique_code || 0);
  const subtotal = order.subtotal ? Number(order.subtotal) : totalAmount - shippingTariff - uniqueCode;
  const grandTotal = totalAmount;

  if (parsedItems.length === 0) {
    parsedItems = [{ name: "Produk Pesanan", qty: 1, price: totalAmount, total: totalAmount }];
  }

  const storeName = order.tenant?.business_name || "Toko Online";
  const storePhone = order.tenant?.owner_whatsapp || "-";
  const storeOrigin = order.tenant?.catalog_settings?.origin_subdistrict || "Indonesia";
  const buyerPhone = order.buyer_jid.replace(/@.*$/, "");
  const orderDate = new Date(order.created_at).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Struk Nota Penjualan - ${order.order_number}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f1f5f9;
      color: #0f172a;
      padding: 24px;
      display: flex;
      justify-content: center;
    }
    .receipt-card {
      background: #ffffff;
      width: 100%;
      max-width: 480px;
      padding: 32px 24px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .header { text-align: center; border-bottom: 2px dashed #94a3b8; padding-bottom: 16px; margin-bottom: 16px; }
    .store-name { font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
    .store-meta { font-size: 11px; color: #475569; margin-top: 4px; }
    .receipt-title { margin-top: 12px; font-size: 12px; font-weight: 700; color: #0f172a; letter-spacing: 1px; text-transform: uppercase; }
    
    .meta-table { width: 100%; font-size: 11px; margin-bottom: 16px; border-collapse: collapse; }
    .meta-table td { padding: 3px 0; }
    .meta-label { color: #64748b; width: 35%; }
    .meta-val { font-weight: 600; text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

    .items-table { width: 100%; font-size: 11px; border-collapse: collapse; margin-bottom: 16px; }
    .items-table th { border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; padding: 6px 0; text-align: left; font-size: 10px; text-transform: uppercase; color: #475569; }
    .items-table td { padding: 8px 0; vertical-align: top; border-bottom: 1px dashed #e2e8f0; }
    .item-desc { font-weight: 600; }
    .item-variant { font-size: 10px; color: #64748b; font-weight: normal; }
    .num-col { text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

    .totals-table { width: 100%; font-size: 11px; border-collapse: collapse; margin-top: 8px; }
    .totals-table td { padding: 4px 0; }
    .total-line { border-top: 2px solid #0f172a; padding-top: 8px !important; font-size: 13px; font-weight: 800; }

    .footer { text-align: center; border-top: 2px dashed #94a3b8; padding-top: 16px; margin-top: 20px; font-size: 11px; color: #475569; }
    .footer p { margin-bottom: 4px; }

    .action-bar { margin-top: 20px; text-align: center; }
    .btn-print {
      background: #047857; color: white; border: none; padding: 10px 20px;
      border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;
    }
    .btn-print:hover { background: #065f46; }

    @media print {
      body { background: white; padding: 0; }
      .receipt-card { border: none; box-shadow: none; max-width: 100%; padding: 0; }
      .action-bar { display: none; }
    }
  </style>
</head>
<body>
  <div class="receipt-card">
    <div class="header">
      <h1 class="store-name">${storeName}</h1>
      <p class="store-meta">${storeOrigin} &bull; WA: ${storePhone}</p>
      <div class="receipt-title">STRUK NOTA PENJUALAN</div>
    </div>

    <table class="meta-table">
      <tr>
        <td class="meta-label">No. Pesanan:</td>
        <td class="meta-val">${order.order_number}</td>
      </tr>
      <tr>
        <td class="meta-label">Tanggal:</td>
        <td class="meta-val">${orderDate}</td>
      </tr>
      <tr>
        <td class="meta-label">Pelanggan:</td>
        <td class="meta-val">${order.buyer_name || "Pelanggan"}</td>
      </tr>
      <tr>
        <td class="meta-label">No. WhatsApp:</td>
        <td class="meta-val">${buyerPhone}</td>
      </tr>
      <tr>
        <td class="meta-label">Tujuan Kirim:</td>
        <td class="meta-val">${order.destination_subdistrict || "-"}</td>
      </tr>
      ${order.courier ? `<tr><td class="meta-label">Kurir & Layanan:</td><td class="meta-val">${order.courier}</td></tr>` : ""}
      ${order.tracking_number ? `<tr><td class="meta-label">Nomor Resi:</td><td class="meta-val">${order.tracking_number}</td></tr>` : ""}
      <tr>
        <td class="meta-label">Status Bayar:</td>
        <td class="meta-val">${order.payment_status}</td>
      </tr>
    </table>

    <table class="items-table">
      <thead>
        <tr>
          <th>Produk</th>
          <th class="num-col" style="width: 40px;">Qty</th>
          <th class="num-col" style="width: 80px;">Harga</th>
          <th class="num-col" style="width: 90px;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${parsedItems
          .map(
            (it) => `
          <tr>
            <td>
              <div class="item-desc">${it.name}</div>
              ${it.variant && it.variant !== "-" ? `<div class="item-variant">Varian: ${it.variant}</div>` : ""}
            </td>
            <td class="num-col">${it.qty}</td>
            <td class="num-col">Rp ${(it.price || 0).toLocaleString("id-ID")}</td>
            <td class="num-col">Rp ${(it.total || 0).toLocaleString("id-ID")}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>

    <table class="totals-table">
      <tr>
        <td class="meta-label">Subtotal Produk:</td>
        <td class="num-col">Rp ${subtotal.toLocaleString("id-ID")}</td>
      </tr>
      ${shippingTariff > 0 ? `
      <tr>
        <td class="meta-label">Ongkos Kirim:</td>
        <td class="num-col">Rp ${shippingTariff.toLocaleString("id-ID")}</td>
      </tr>` : ""}
      ${uniqueCode > 0 ? `
      <tr>
        <td class="meta-label">Kode Unik Transfer:</td>
        <td class="num-col">Rp ${uniqueCode.toLocaleString("id-ID")}</td>
      </tr>` : ""}
      <tr class="total-line">
        <td>TOTAL AKHIR:</td>
        <td class="num-col">Rp ${grandTotal.toLocaleString("id-ID")}</td>
      </tr>
    </table>

    <div class="footer">
      <p>Terima kasih telah berbelanja di <strong>${storeName}</strong>!</p>
      <p>Simpan nota ini sebagai bukti transaksi resmi Anda.</p>
    </div>

    <div class="action-bar">
      <button class="btn-print" onclick="window.print()">Cetak Struk Sekarang</button>
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
