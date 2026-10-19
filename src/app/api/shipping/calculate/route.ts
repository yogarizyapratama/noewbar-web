import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireTenant } from "@/lib/auth";
import { calculateShippingRates } from "@/lib/logistics/shipping-engine";

const calcSchema = z.object({
  destination: z.string().min(2),
  weight_grams: z.number().int().min(1).default(1000),
  order_amount: z.number().optional().default(0),
});

/**
 * Fast Shipping Tariff Calculator for store owners.
 */
export async function POST(req: NextRequest) {
  const session = await requireTenant();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.sub },
    include: { catalog_settings: true },
  });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = calcSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Kecamatan tujuan minimal 2 karakter." },
      { status: 422 }
    );
  }

  const origin = tenant?.catalog_settings?.origin_subdistrict || "Jakarta Selatan";

  try {
    const result = await calculateShippingRates({
      originSubdistrict: origin,
      destinationSubdistrict: parsed.data.destination.trim(),
      weightKg: Math.max(0.1, parsed.data.weight_grams / 1000),
      orderTotalAmount: parsed.data.order_amount,
      freeShippingEnabled: tenant?.catalog_settings?.free_shipping_enabled,
      freeShippingThreshold: tenant?.catalog_settings?.free_shipping_min_amount
        ? Number(tenant.catalog_settings.free_shipping_min_amount)
        : 200000,
    });

    return NextResponse.json({
      ok: true,
      origin: result.origin_subdistrict,
      destination: result.destination_subdistrict,
      weight_kg: result.weight_kg,
      is_eligible_free_shipping: result.is_eligible_free_shipping,
      free_shipping_threshold: result.free_shipping_threshold,
      free_shipping_enabled: result.free_shipping_enabled,
      rates: result.rates,
      calculated_at: result.calculated_at,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Gagal menghitung tarif pengiriman." },
      { status: 500 }
    );
  }
}
