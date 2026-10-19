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

async function resolveFromBiteship(
  origin: string,
  destination: string,
  courier: CourierCode,
  weightGrams = 1000,
  timeoutMs = 5000
): Promise<ProviderRate | null> {
  const apiKey = env.BITESHIP_API_KEY.trim();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const courierCodeMap: Record<CourierCode, string> = {
      JNT: "jnt",
      SICEPAT: "sicepat",
      JNE: "jne",
    };
    const courierSlug = courierCodeMap[courier] || courier.toLowerCase();

    const res = await fetch("https://api.biteship.com/v1/rates/couriers", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        origin_area_id: origin,
        destination_area_id: destination,
        couriers: courierSlug,
        items: [{ name: "Produk", value: 100000, quantity: 1, weight: Math.max(1000, weightGrams) }],
      }),
      cache: "no-store",
    });

    if (!res.ok) return null;
    const json = (await res.json()) as {
      pricing?: Array<{
        courier_service_name?: string;
        courier_service_code?: string;
        price?: number;
        duration?: string;
        type?: string;
      }>;
    };
    if (!json?.pricing || !Array.isArray(json.pricing) || json.pricing.length === 0) return null;

    const best = json.pricing.find((p) => p.type === "standard") || json.pricing[0];
    if (!best || !best.price || best.price <= 0) return null;

    return {
      tariff_per_kg: Math.round(best.price),
      service_type: best.courier_service_name || `${courier} Regular`,
      estimated_days: best.duration || undefined,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveFromRajaOngkir(
  origin: string,
  destination: string,
  courier: CourierCode,
  weightGrams = 1000,
  timeoutMs = 5000
): Promise<ProviderRate | null> {
  const apiKey = env.RAJAONGKIR_API_KEY.trim();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const courierCodeMap: Record<CourierCode, string> = {
      JNT: "j&t",
      SICEPAT: "sicepat",
      JNE: "jne",
    };
    const courierSlug = courierCodeMap[courier] || courier.toLowerCase();

    const res = await fetch("https://api.rajaongkir.com/starter/cost", {
      method: "POST",
      signal: controller.signal,
      headers: {
        key: apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        origin,
        destination,
        weight: String(Math.max(1000, weightGrams)),
        courier: courierSlug,
      }),
      cache: "no-store",
    });

    if (!res.ok) return null;
    const json = (await res.json()) as {
      rajaongkir?: {
        results?: Array<{
          costs?: Array<{
            service?: string;
            description?: string;
            cost?: Array<{ value: number; etd?: string }>;
          }>;
        }>;
      };
    };

    const results = json.rajaongkir?.results?.[0]?.costs;
    if (!results || results.length === 0) return null;

    const standard = results.find((r) => r.service === "REG" || r.service === "EZ") || results[0];
    const costEntry = standard?.cost?.[0];
    if (!costEntry || costEntry.value <= 0) return null;

    return {
      tariff_per_kg: Math.round(costEntry.value),
      service_type: standard.description ? `${standard.service} (${standard.description})` : standard.service || "REG",
      estimated_days: costEntry.etd ? `${costEntry.etd} HARI` : undefined,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveFromPublicApi(
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

/**
 * Resolves a tariff from available providers in order: Biteship -> RajaOngkir -> Public endpoint.
 * Returns null when no provider is configured or all fail.
 */
async function resolveFromProvider(
  origin: string,
  destination: string,
  courier: CourierCode,
  weightGrams = 1000,
  timeoutMs = 6000
): Promise<ProviderRate | null> {
  // 1. Try Biteship
  const biteship = await resolveFromBiteship(origin, destination, courier, weightGrams, timeoutMs);
  if (biteship) return biteship;

  // 2. Try RajaOngkir
  const rajaongkir = await resolveFromRajaOngkir(origin, destination, courier, weightGrams, timeoutMs);
  if (rajaongkir) return rajaongkir;

  // 3. Try Public API
  return resolveFromPublicApi(origin, destination, courier, timeoutMs);
}

function isEstimateRow(serviceType: string): boolean {
  return serviceType.endsWith(ESTIMATE_MARKER);
}

function stripMarker(serviceType: string): string {
  return serviceType.replace(ESTIMATE_MARKER, "");
}

/** Indonesian courier weight tolerance: ceiling round if decimal exceeds 0.25 kg. */
export function calculateCourierBillableWeight(weightKg: number): number {
  if (weightKg <= 1) return 1;
  const intPart = Math.floor(weightKg);
  const decPart = weightKg - intPart;
  return decPart > 0.25 ? intPart + 1 : intPart;
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

  const weight = calculateCourierBillableWeight(params.weightKg || 1);
  const weightGrams = Math.max(1000, Math.round(weight * 1000));
  const totalAmount = params.orderTotalAmount || 0;
  const isFree = totalAmount >= FREE_SHIPPING_THRESHOLD;
  const providerConfigured =
    env.BITESHIP_API_KEY.trim().length > 0 ||
    env.RAJAONGKIR_API_KEY.trim().length > 0 ||
    env.COURIER_PUBLIC_API_URL.trim().length > 0;

  const validUntil = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);

  let cachedRows: Array<{
    id: string;
    origin_subdistrict: string;
    destination_subdistrict: string;
    courier: string;
    service_type: string;
    tariff_per_kg: unknown;
    last_checked_at: Date;
  }> = [];

  try {
    cachedRows = await prisma.shippingRatesCache.findMany({
      where: {
        origin_subdistrict: { equals: origin, mode: "insensitive" },
        destination_subdistrict: { equals: destination, mode: "insensitive" },
        last_checked_at: { gte: validUntil },
        ...(params.courierFilter ? { courier: params.courierFilter } : {}),
      },
    });
  } catch {
    cachedRows = [];
  }

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
    const fromProvider = await resolveFromProvider(origin, destination, c.courier, weightGrams);

    if (fromProvider) {
      let serviceType = fromProvider.service_type;
      try {
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
        serviceType = record.service_type;
      } catch {
        // DB cache write is optional
      }

      rates.push({
        courier: c.courier,
        service_type: stripMarker(serviceType),
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

    try {
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
    } catch {
      // DB cache write is optional
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
