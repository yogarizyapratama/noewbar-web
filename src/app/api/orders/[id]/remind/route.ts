import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireTenant } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { waDaemon } from "@/lib/wa/daemon-client";
import { rupiah } from "@/components/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
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

  if (order.payment_status !== "UNPAID") {
    return fail("Pesanan ini sudah memiliki bukti transfer atau sudah diverifikasi.", 400);
  }

  const instance = await prisma.waInstance.findFirst({
    where: {
      tenant_id: session.sub,
      connection_status: "CONNECTED",
    },
  });

  if (!instance) {
    return fail("Nomor WhatsApp toko Anda belum terhubung. Silakan hubungkan WhatsApp terlebih dahulu.", 400);
  }

  const storeName = order.tenant?.business_name || "Toko Kami";
  const buyerName = order.buyer_name || "Kak";
  const settings = order.tenant?.catalog_settings;
  const bankName = settings?.bank_name || "BCA / Bank Transfer";
  const bankAccount = settings?.bank_account_number || "-";
  const bankHolder = settings?.bank_account_holder || storeName;

  const totalAmountStr = rupiah(Number(order.total_amount));
  const uniqueCodeStr = order.unique_code > 0 ? ` (termasuk kode unik ${order.unique_code})` : "";

  const reminderText = `Halo Kak ${buyerName}! 😊\n\nIni pengingat ramah untuk pesanan *#${order.order_number}* di *${storeName}*.\nTotal pembayaran: *Rp ${totalAmountStr}*${uniqueCodeStr}.\n\nPembayaran dapat ditransfer ke rekening resmi toko kami:\n🏦 Bank: *${bankName}*\n💳 No. Rekening: *${bankAccount}*\n👤 Atas Nama: *${bankHolder}*\n\nSetelah transfer, mohon kirimkan foto struk atau bukti transfer ke chat ini agar pesanan dapat segera kami proses pengirimannya ya kak. Terima kasih! 🙏`;

  const sendRes = await waDaemon.sendText({
    instanceKey: instance.instance_key,
    to: order.buyer_jid,
    message: reminderText,
    simulateTyping: true,
  });

  if (!sendRes.ok) {
    return fail(`Gagal mengirim pesan pengingat ke WhatsApp: ${sendRes.error}`, 500);
  }

  // Also record message in database if conversation exists
  try {
    const conv = await prisma.conversation.findFirst({
      where: {
        tenant_id: session.sub,
        buyer_jid: order.buyer_jid,
      },
    });
    if (conv) {
      await prisma.chatMessage.create({
        data: {
          conversation_id: conv.id,
          sender_type: "BOT",
          message_type: "TEXT",
          content: reminderText,
        },
      });
    }
  } catch {
    // Non-critical if message history recording fails
  }

  return ok({
    success: true,
    message: `Pesan pengingat pembayaran pesanan #${order.order_number} berhasil dikirim ke WhatsApp pembeli!`,
  });
}
