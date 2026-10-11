import prisma from "@/lib/prisma";
import { env } from "@/lib/env";

/**
 * Smart Cache-On-Demand Logistics Engine (specification chapter 14.6 + 4 + 12).
 *
 * Cost target: Rp 0 / month. Strategy:
 *   1. Serve from the PostgreSQL `shipping_rates_cache` table (< 10 ms).
 *   2. On a cache miss, resolve the tariff through a configured public courier
 *      provider endpoint (COURIER_PUBLIC_API_URL, no paid subscription).
 *   3. If no provider is configured or the provider fails, fall back to the
 *      deterministic zone matrix and mark the row as an ESTIMATE so the interface
 *      can label it honestly instead of presenting a guess as a real tariff.
 *
 * Estimates are written back to the cache with an explicit `est` marker in
 * service_type, so a later live lookup upgrades the row and the UI can always tell
 * which of the two it is showing.
 */

export type CourierCode = "JNT" | "SICEPAT" | "JNE";

export type RateSource = "cache" | "provider" | "estimate";

export interface CourierRateOption {
  courier: CourierCode;
  service_type: string;
  tariff_per_kg: number;
  total_tariff: number;
  estimated_days: string;
  is_free_shipping_applied: boolean;
  source: RateSource;
  is_estimate: boolean;
}

export interface ShippingCalculationResult {
  origin_subdistrict: string;
  destination_subdistrict: string;
  weight_kg: number;
  order_total_amount: number;
  is_eligible_free_shipping: boolean;
  free_shipping_threshold: number;
  rates: CourierRateOption[];
  provider_configured: boolean;
  calculated_at: string;
}

export const FREE_SHIPPING_THRESHOLD = 200000;
const CACHE_TTL_DAYS = 7;
const ESTIMATE_MARKER = " [est]";

const COURIERS: Array<{
  courier: CourierCode;
  service: string;
  est: string;
  multiplier: number;
  providerName: string;
}> = [
  { courier: "JNT", service: "EZ (Reguler)", est: "1-2 Hari", multiplier: 1.0, providerName: "jnt" },
  { courier: "SICEPAT", service: "REG (Reguler)", est: "1-3 Hari", multiplier: 1.08, providerName: "sicepat" },
  { courier: "JNE", service: "REG", est: "2-3 Hari", multiplier: 1.15, providerName: "jne" },
];

/**
 * Deterministic zone matrix, used only as the documented graceful-degradation
 * fallback (chapter 12). Never random: the same origin/destination always yields
 * the same number, so invoices never drift between two identical chats.
 */
export function estimateBaseTariff(destination: string, courierMultiplier: number): number {
  const d = destination.toLowerCase();

  let raw = 12000; // within island / Jabodetabek default
  if (/(jakarta|tangerang|bekasi|depok|bogor)/.test(d)) raw = 9000;
  else if (/(bandung|cimahi|cirebon|jawa barat|garut|tasik)/.test(d)) raw = 11000;
  else if (/(semarang|solo|surakarta|yogya|jogja|surabaya|malang|jawa tengah|jawa timur)/.test(d)) raw = 17000;
  else if (/(medan|padang|palembang|pekanbaru|banda lampung|sumatera|aceh|jambi|bengkulu)/.test(d)) raw = 28000;
  else if (/(makassar|bali|denpasar|manado|kendari|palu)/.test(d)) raw = 32000;
  else if (/(papua|jayapura|ambon|ternate|merauke)/.test(d)) raw = 55000;
  else if (/(kalimantan|balikpapan|samarinda|banjarmasin|pontianak)/.test(d)) raw = 26000;

  return Math.round((raw * courierMultiplier) / 100) * 100;
}

type ProviderRate = { tariff_per_kg: number; service_type: string; estimated_days?: string };

/**
 * Resolves a tariff from a configured public provider endpoint.
 * Contract: GET {COURIER_PUBLIC_API_URL}?origin=&destination=&courier=&weight=
 * responding { tariff_per_kg, service_type?, estimated_days? }.
 * Returns null when no provider is configured or the call fails.
 */
async function resolveFromProvider(
  origin: string,
  destination: string,
  courier: CourierCode,
  timeoutMs = 6000
): Promise<ProviderRate | null> {
  const base = env.COURIER_PUBLIC_API_URL.trim();
  if (!base) return null;

  const url = new URL(base);
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("courier", courier);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const json = (await res.json()) as Record<string, unknown>;
    const raw = json.tariff_per_kg ?? json.tariff ?? json.cost ?? json.price;
    const tariff = typeof raw === "string" ? parseFloat(raw) : Number(raw);
    if (!Number.isFinite(tariff) || tariff <= 0) return null;

    return {
      tariff_per_kg: Math.round(tariff),
      service_type:
        typeof json.service_type === "string" ? json.service_type : "REG (Reguler)",
      estimated_days: typeof json.estimated_days === "string" ? json.estimated_days : undefined,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function isEstimateRow(serviceType: string): boolean {
  return serviceType.endsWith(ESTIMATE_MARKER);
}

function stripMarker(serviceType: string): string {
  return serviceType.replace(ESTIMATE_MARKER, "");
}

export async function calculateShippingRates(params: {
  originSubdistrict: string;
  destinationSubdistrict: string;
  orderTotalAmount?: number;
  weightKg?: number;
  courierFilter?: CourierCode;
}): Promise<ShippingCalculationResult> {
  const origin = (params.originSubdistrict || "Jakarta Selatan").trim();
  const destination = (params.destinationSubdistrict || "").trim();

  if (!origin || !destination) {
    throw new Error("origin_subdistrict and destination_subdistrict are required");
  }

  const weight = Math.max(1, Math.round(params.weightKg || 1));
  const totalAmount = params.orderTotalAmount || 0;
  const isFree = totalAmount >= FREE_SHIPPING_THRESHOLD;
  const providerConfigured = env.COURIER_PUBLIC_API_URL.trim().length > 0;

  const validUntil = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const cachedRows = await prisma.shippingRatesCache.findMany({
    where: {
      origin_subdistrict: { equals: origin, mode: "insensitive" },
      destination_subdistrict: { equals: destination, mode: "insensitive" },
      last_checked_at: { gte: validUntil },
      ...(params.courierFilter ? { courier: params.courierFilter } : {}),
    },
  });

  const rates: CourierRateOption[] = [];

  for (const c of COURIERS) {
    if (params.courierFilter && params.courierFilter !== c.courier) continue;

    const cached = cachedRows.find((r) => r.courier === c.courier);

    // 1. Cache hit (prefer non-estimate rows; an estimate row is reused only when
    //    no provider is configured, i.e. it is the best information available).
    if (cached && (!isEstimateRow(cached.service_type) || !providerConfigured)) {
      const tariffPerKg = Number(cached.tariff_per_kg);
      const estimate = isEstimateRow(cached.service_type);
      rates.push({
        courier: c.courier,
        service_type: stripMarker(cached.service_type),
        tariff_per_kg: tariffPerKg,
        total_tariff: isFree ? 0 : tariffPerKg * weight,
        estimated_days: c.est,
        is_free_shipping_applied: isFree,
        source: "cache",
        is_estimate: estimate,
      });
      continue;
    }

    // 2. Cache miss -> public provider.
    const fromProvider = await resolveFromProvider(origin, destination, c.courier);

    if (fromProvider) {
      const record = await prisma.shippingRatesCache.create({
        data: {
          origin_subdistrict: origin,
          destination_subdistrict: destination,
          courier: c.courier,
          service_type: fromProvider.service_type,
          tariff_per_kg: fromProvider.tariff_per_kg,
          last_checked_at: new Date(),
        },
      });

      rates.push({
        courier: c.courier,
        service_type: stripMarker(record.service_type),
        tariff_per_kg: fromProvider.tariff_per_kg,
        total_tariff: isFree ? 0 : fromProvider.tariff_per_kg * weight,
        estimated_days: fromProvider.estimated_days ?? c.est,
        is_free_shipping_applied: isFree,
        source: "provider",
        is_estimate: false,
      });
      continue;
    }

    // 3. Documented fallback: deterministic zone matrix, explicitly labelled.
    const base = estimateBaseTariff(destination, c.multiplier);

    if (!cached) {
      await prisma.shippingRatesCache.create({
        data: {
          origin_subdistrict: origin,
          destination_subdistrict: destination,
          courier: c.courier,
          service_type: `${c.service}${ESTIMATE_MARKER}`,
          tariff_per_kg: base,
          last_checked_at: new Date(),
        },
      });
    } else {
      await prisma.shippingRatesCache.update({
        where: { id: cached.id },
        data: { tariff_per_kg: base, last_checked_at: new Date() },
      });
    }

    rates.push({
      courier: c.courier,
      service_type: c.service,
      tariff_per_kg: base,
      total_tariff: isFree ? 0 : base * weight,
      estimated_days: c.est,
      is_free_shipping_applied: isFree,
      source: "estimate",
      is_estimate: true,
    });
  }

  return {
    origin_subdistrict: origin,
    destination_subdistrict: destination,
    weight_kg: weight,
    order_total_amount: totalAmount,
    is_eligible_free_shipping: isFree,
    free_shipping_threshold: FREE_SHIPPING_THRESHOLD,
    rates,
    provider_configured: providerConfigured,
    calculated_at: new Date().toISOString(),
  };
}

/** Cheapest available option, used when the buyer does not name a courier. */
export function cheapestRate(rates: CourierRateOption[]): CourierRateOption | undefined {
  return [...rates].sort((a, b) => a.total_tariff - b.total_tariff)[0];
}
