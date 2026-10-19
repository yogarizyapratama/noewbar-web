import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { requireTenant } from "@/lib/auth";
import { getTenantSubscriptionInfo } from "@/lib/billing/subscription-guard";
import { chatWithFallback } from "@/lib/ai/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireTenant();
  if (!session) return fail("Unauthorized", 401);

  const subInfo = await getTenantSubscriptionInfo(session.sub);
  if (subInfo.isExpired) {
    return fail("Langganan Anda telah berakhir. Perbarui paket untuk menggunakan fitur ini.", 403);
  }

  const conversationId = params.id;
  if (!conversationId) return fail("Conversation ID required", 400);

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      tenant_id: session.sub,
    },
    include: {
      chat_messages: {
        orderBy: { created_at: "desc" },
        take: 12,
      },
      tenant: {
        include: {
          catalog_settings: true,
          knowledge_docs: {
            where: { is_active: true },
            take: 4,
            select: { title: true, content_text: true, doc_type: true },
          },
          products: {
            where: { status: "ACTIVE" },
            take: 15,
            select: { name: true, price: true, stock: true, sku: true },
          },
        },
      },
    },
  });

  if (!conversation) {
    return fail("Percakapan tidak ditemukan", 404);
  }

  // Reverse back to chronological order
  const messagesChronological = [...conversation.chat_messages].reverse();

  if (messagesChronological.length === 0) {
    return ok({
      suggestion: "Halo kak! Ada yang bisa kami bantu seputar produk toko kami hari ini? 😊",
    });
  }

  const storeName = conversation.tenant?.business_name || "Toko Kami";
  const botTone = conversation.tenant?.catalog_settings?.bot_tone || "Ramah, santun, dan solutif";
  const bankName = conversation.tenant?.catalog_settings?.bank_name || "-";
  const bankAcc = conversation.tenant?.catalog_settings?.bank_account_number || "-";
  const bankHolder = conversation.tenant?.catalog_settings?.bank_account_holder || storeName;

  const knowledgeTexts = conversation.tenant?.knowledge_docs
    ?.map((doc) => `[${doc.doc_type} - ${doc.title}]:\n${doc.content_text}`)
    .join("\n\n") || "Tidak ada dokumen khusus.";

  const productsSummary = conversation.tenant?.products
    ?.map((p) => `- ${p.name} (SKU: ${p.sku}) | Rp ${Number(p.price).toLocaleString("id-ID")} | Stok: ${p.stock}`)
    .join("\n") || "Lihat katalog lengkap.";

  const transcript = messagesChronological
    .map((m) => {
      const sender = m.sender_type === "BUYER" ? "Pembeli" : "Admin Toko";
      return `${sender}: ${m.content}`;
    })
    .join("\n");

  const systemPrompt = `Anda adalah asisten AI Copilot untuk pemilik toko "${storeName}".
Tugas: Buat SATU pesan balasan ramah, padat, dan langsung menjawab pesan terakhir pembeli dalam bahasa Indonesia natural ala WhatsApp.

Konteks Toko:
- Nama Toko: ${storeName}
- Gaya Bahasa / Tone: ${botTone}
- Rekening Toko: Bank ${bankName} No. ${bankAcc} a/n ${bankHolder}

Produk Tersedia:
${productsSummary}

SOP & Kebijakan Toko:
${knowledgeTexts}

Aturan:
1. Jawab langsung ke inti pertanyaan atau kebutuhan pembeli.
2. Gunakan sapaan ramah "Halo kak" atau sebut nama jika ada.
3. Berikan informasi harga/rekening/ongkir yang relevan.
4. JANGAN mengarang info yang tidak ada di data toko.
5. HANYA cetak teks draf balasan tanpa tanda kutip pembuka atau format pengantar.`;

  try {
    const aiRes = await chatWithFallback({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Berikut riwayat percakapan:\n${transcript}\n\nBuatkan draf balasan terbaik untuk pesan pembeli paling terakhir.`,
        },
      ],
      temperature: 0.6,
      max_tokens: 300,
    });

    const suggestion = aiRes.content.trim().replace(/^["']|["']$/g, "");
    return ok({ suggestion });
  } catch (err) {
    return fail("Gagal membuat saran balasan AI", 500, err instanceof Error ? err.message : String(err));
  }
}
