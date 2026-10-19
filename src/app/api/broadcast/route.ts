import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { requireTenant } from "@/lib/auth";
import { waDaemon } from "@/lib/wa/daemon-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const broadcastSchema = z.object({
  message: z.string().min(5).max(1000),
  segment: z.enum(["all", "unpaid", "unpaid_old", "inquiry"]).default("all"),
  test_phone: z.string().optional(),
  image_url: z.string().url().optional().or(z.literal("")),
});

/**
 * Segmented Broadcast API with Anti-Spam Protection & Opt-Out Enforcement.
 */
export async function POST(req: NextRequest) {
  const session = await requireTenant();
  if (!session) return fail("Unauthorized", 401);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("Body must be valid JSON", 400);
  }

  const parsed = broadcastSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("Parameter broadcast tidak valid", 422, parsed.error.issues);
  }

  const { message, segment, test_phone, image_url } = parsed.data;

  // Resolve tenant details & connected WhatsApp instance
  const [tenant, instance] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: session.sub },
      select: { business_name: true },
    }),
    prisma.waInstance.findFirst({
      where: { tenant_id: session.sub, connection_status: "CONNECTED" },
      select: { instance_key: true, phone_number: true },
    }),
  ]);

  const storeName = tenant?.business_name || "Toko Kami";

  if (!instance) {
    return fail("Tidak ada nomor WhatsApp yang terhubung aktif. Silakan hubungkan WhatsApp di tab WhatsApp.", 400);
  }

  function personalizeMessage(template: string, name: string, phone: string): string {
    return template
      .replace(/\{nama\}/gi, name)
      .replace(/\{nomor_wa\}/gi, phone)
      .replace(/\{nama_toko\}/gi, storeName);
  }

  // If test send requested
  if (test_phone && test_phone.trim()) {
    const formattedTest = test_phone.trim();
    const cleanPhone = formattedTest.replace(/[^0-9]/g, "");
    const testMsg = `${personalizeMessage(message, "Kak Budi (Tes)", cleanPhone)}\n\n_Balas STOP untuk berhenti menerima info ini._`;
    const res = image_url
      ? await waDaemon.sendMedia({
          instanceKey: instance.instance_key,
          to: formattedTest,
          url: image_url,
          caption: testMsg,
          kind: "image",
          simulateTyping: true,
        })
      : await waDaemon.sendText({
          instanceKey: instance.instance_key,
          to: formattedTest,
          message: testMsg,
          simulateTyping: true,
        });
    if (!res.ok) {
      return fail(`Gagal mengirim pesan uji coba: ${res.error}`, 500);
    }
    return ok({
      success: true,
      test_mode: true,
      sent_to: formattedTest,
      has_image: Boolean(image_url),
      note: "Pesan uji coba berhasil terkirim ke nomor Anda.",
    });
  }

  // Query conversations for the tenant, strictly excluding OPT_OUT
  let conversations = await prisma.conversation.findMany({
    where: {
      tenant_id: session.sub,
      pipeline_stage: { not: "OPT_OUT" },
    },
    include: {
      orders: {
        select: { id: true, payment_status: true, created_at: true },
      },
    },
    take: 100, // Safety cap per batch
  });

  const now = Date.now();
  const twoHoursMs = 2 * 60 * 60 * 1000;
  const fortyEightHoursMs = 48 * 60 * 60 * 1000;

  // Filter based on segment
  if (segment === "unpaid") {
    conversations = conversations.filter((c) =>
      c.orders.some((o) => o.payment_status === "UNPAID")
    );
  } else if (segment === "unpaid_old") {
    // Abandoned / Pending transfer between 2h and 48h
    conversations = conversations.filter((c) =>
      c.orders.some((o) => {
        if (o.payment_status !== "UNPAID") return false;
        const diff = now - new Date(o.created_at).getTime();
        return diff >= twoHoursMs && diff <= fortyEightHoursMs;
      })
    );
  } else if (segment === "inquiry") {
    conversations = conversations.filter((c) => c.orders.length === 0);
  }

  if (conversations.length === 0) {
    return ok({
      success: true,
      total_targets: 0,
      sent_count: 0,
      note: "Tidak ada kontak penerima yang cocok dengan kriteria segmen ini atau semua kontak telah opt-out.",
    });
  }

  // Deliver with human-like jitter delay between contacts (Anti-Ban Rate Limiting)
  let sentCount = 0;
  const errors: Array<{ jid: string; error: string }> = [];

  for (const conv of conversations) {
    try {
      const recipientName = conv.buyer_name?.trim() || "Kak";
      const recipientPhone = conv.buyer_jid ? conv.buyer_jid.split("@")[0] : "";
      const personalized = personalizeMessage(message, recipientName, recipientPhone);
      const finalMsg = `${personalized}\n\n_Balas STOP untuk berhenti menerima info promo._`;

      const res = image_url
        ? await waDaemon.sendMedia({
            instanceKey: instance.instance_key,
            to: conv.buyer_jid,
            url: image_url,
            caption: finalMsg,
            kind: "image",
            simulateTyping: true,
          })
        : await waDaemon.sendText({
            instanceKey: instance.instance_key,
            to: conv.buyer_jid,
            message: finalMsg,
            simulateTyping: true,
          });

      if (res.ok) {
        sentCount++;
      } else {
        errors.push({ jid: conv.buyer_jid, error: res.error });
      }

      // Safe jitter gap: 1500ms - 3500ms between recipients to prevent spam flags
      const gap = 1500 + Math.floor(Math.random() * 2000);
      await new Promise((r) => setTimeout(r, gap));
    } catch (err) {
      errors.push({
        jid: conv.buyer_jid,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return ok({
    success: true,
    segment,
    total_targets: conversations.length,
    sent_count: sentCount,
    failed_count: errors.length,
    errors: errors.slice(0, 5),
  });
}
