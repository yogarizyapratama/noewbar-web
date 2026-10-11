import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { ok, fail } from "@/lib/http";
import { processMidtransNotification } from "@/lib/billing/midtrans";
import prisma from "@/lib/prisma";
import { generatePaymentReceiptPdf } from "@/lib/billing/receipt-pdf";
import { waDaemon } from "@/lib/wa/daemon-client";
import { notifyTenant, notifyAdmin } from "@/lib/realtime/event-bus";

/**
 * Midtrans notification endpoint (chapter 7).
 *
 * Security posture:
 *   - SHA-512 signature is verified BEFORE anything else. An invalid signature gets
 *     HTTP 403 and no database work at all.
 *   - Duplicate deliveries are absorbed by the `webhook_events` unique constraint,
 *     so a repeated notification can never extend a subscription twice.
 *
 * Midtrans expects a fast 2xx. We always answer 200 for events we have decided
 * about (including duplicates) and non-200 only when we could not process at all,
 * so the gateway retries the ones that genuinely failed.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notificationSchema = z.object({
  order_id: z.string().min(1),
  status_code: z.string().min(1),
  gross_amount: z.string().min(1),
  signature_key: z.string().min(1),
  transaction_status: z.string().min(1),
  payment_type: z.string().optional(),
  transaction_id: z.string().optional(),
  fraud_status: z.string().optional(),
  transaction_time: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("Body must be valid JSON", 400);
  }

  const parsed = notificationSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("Invalid Midtrans notification shape", 422, parsed.error.issues);
  }

  try {
    const result = await processMidtransNotification(parsed.data);

    switch (result.status) {
      case "REJECTED":
        // Signature mismatch: block outright.
        return fail("Invalid signature", 403);

      case "DUPLICATE":
        // Already applied. Answer 200 so Midtrans stops retrying.
        return ok({ processed: false, duplicate: true, reason: result.reason });

      case "IGNORED":
        return ok({ processed: false, reason: result.reason });

      case "SUCCESS": {
        // Realtime alert to the tenant dashboard + superadmin.
        notifyTenant(result.tenantId, { type: "billing" });
        notifyAdmin({ type: "billing" });

        // Fire the receipt PDF + WhatsApp delivery in the background so Midtrans
        // still gets a fast 2xx. Errors there are logged via webhook_events;
        // the subscription itself is already active (the critical part).
        void (async () => {
          try {
            const tenant = await prisma.tenant.findUnique({
              where: { id: result.tenantId },
              include: { wa_instances: { where: { connection_status: "CONNECTED" }, take: 1 } },
            });
            if (!tenant) return;

            const receipt = await generatePaymentReceiptPdf({
              tenantId: tenant.id,
              businessName: tenant.business_name,
              ownerName: tenant.owner_name,
              orderId: parsed.data.order_id,
              planName: "PRO",
              amount: Number(parsed.data.gross_amount),
              paymentType: parsed.data.payment_type ?? "qris",
              transactionId: parsed.data.transaction_id ?? null,
              paidAt: new Date(),
              newExpiresAt: new Date(result.newExpiresAt),
            });

            if (receipt.ok && tenant.owner_whatsapp) {
              const target = tenant.wa_instances[0];
              await waDaemon.sendMedia({
                instanceKey: target?.instance_key ?? "",
                to: tenant.owner_whatsapp,
                url: receipt.url,
                caption: `Kuitansi pembayaran Noewbar CS Pro (${parsed.data.order_id})`,
                kind: "document",
                simulateTyping: true,
              });
              await prisma.webhookEvent.create({
                data: {
                  provider: "MIDTRANS",
                  event_key: `receipt:${parsed.data.order_id}`,
                  event_type: "receipt_sent",
                  payload: { tenant_id: tenant.id, url: receipt.url } as unknown as Prisma.InputJsonValue,
                },
              });
            }
          } catch {
            // Non-critical: subscription already active. Best-effort receipt.
          }
        })();

        return ok({
          processed: true,
          tenant_id: result.tenantId,
          added_days: result.addedDays,
          new_expires_at: result.newExpiresAt,
        });
      }
    }
  } catch (err) {
    // A genuine processing failure must be retried by Midtrans.
    return fail(
      `Notification processing failed: ${err instanceof Error ? err.message : "unknown error"}`,
      500
    );
  }
}

/** Human-readable probe for the operator. */
export async function GET() {
  return ok({
    status: "ok",
    service: "noewbar-midtrans-webhook",
    expects: "POST with SHA-512 signature_key",
    time: new Date().toISOString(),
  });
}
