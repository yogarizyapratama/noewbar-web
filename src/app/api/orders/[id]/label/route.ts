import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireTenant } from "@/lib/auth";
import { fail } from "@/lib/http";
import { generateThermalShippingLabel } from "@/lib/orders/shipping-label";
import { getTenantSubscriptionInfo } from "@/lib/billing/subscription-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireTenant();
  if (!session) return fail("Unauthorized", 401);

  const subInfo = await getTenantSubscriptionInfo(session.sub);
  if (subInfo.isExpired) {
    return fail("Langganan Anda telah berakhir. Perbarui paket untuk mencetak label pengiriman.", 403);
  }

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

  if (order.order_status === "CANCELLED" || order.order_status === "EXPIRED") {
    return fail(`Tidak dapat mencetak label untuk pesanan dengan status ${order.order_status}.`, 400);
  }

  // Parse items
  let parsedItems: Array<{ name: string; variant?: string; qty: number }> = [];
  try {
    if (Array.isArray(order.items)) {
      parsedItems = order.items.map((it: any) => ({
        name: it.name || it.title || "Produk",
        variant: it.variant || it.sku,
        qty: Number(it.qty || it.quantity || 1),
      }));
    }
  } catch {
    parsedItems = [{ name: "Produk Pesanan", qty: 1 }];
  }

  // Generate 100x150 mm thermal shipping label PDF
  try {
    const pdfBuffer = await generateThermalShippingLabel({
      orderNumber: order.order_number,
      storeName: order.tenant?.business_name || "Toko Online",
      storePhone: order.tenant?.owner_whatsapp || undefined,
      storeOrigin: order.tenant?.catalog_settings?.origin_subdistrict || undefined,
      buyerName: order.buyer_name || "Pelanggan",
      buyerPhone: order.buyer_jid.replace(/@.*$/, ""),
      destinationAddress: order.destination_subdistrict || "Alamat Tujuan",
      destinationSubdistrict: order.destination_subdistrict || undefined,
      courier: order.courier || "J&T",
      courierService: order.courier_service || "EZ",
      trackingNumber: order.tracking_number || undefined,
      totalWeightKg: 1,
      items: parsedItems,
      totalAmount: Number(order.total_amount),
      isCod: false,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="label-${order.order_number}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail(`Gagal membuat label pengiriman: ${msg}`, 500);
  }
}
