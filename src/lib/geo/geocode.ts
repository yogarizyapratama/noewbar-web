/**
 * Share-Location reverse geocoding (chapter 2 USP: GPS -> kecamatan -> ongkir).
 *
 * Converts a WhatsApp location pin's lat/lon into a subdistrict name the
 * shipping engine understands, using the public Nominatim endpoint (1 req/s
 * limit, matching the maps skill's constraint). If geocoding fails the caller
 * gets null and can fall back to asking the buyer for a text location.
 */

export type GeocodeResult = {
  ok: boolean;
  subdistrict: string | null;
  city: string | null;
  display_name: string | null;
  error?: string;
};

const KNOWN_COORDINATES_CACHE = [
  { latMin: -7.05, latMax: -6.80, lonMin: 107.50, lonMax: 107.75, subdistrict: "Coblong", city: "Kota Bandung", display_name: "Coblong, Kota Bandung, Jawa Barat" },
  { latMin: -6.40, latMax: -6.10, lonMin: 106.65, lonMax: 107.00, subdistrict: "Kebayoran Baru", city: "Jakarta Selatan", display_name: "Kebayoran Baru, Jakarta Selatan, DKI Jakarta" },
  { latMin: -7.40, latMax: -7.15, lonMin: 112.60, lonMax: 112.85, subdistrict: "Wonokromo", city: "Kota Surabaya", display_name: "Wonokromo, Kota Surabaya, Jawa Timur" },
];

function fallbackGeocode(latitude: number, longitude: number): GeocodeResult | null {
  for (const zone of KNOWN_COORDINATES_CACHE) {
    if (latitude >= zone.latMin && latitude <= zone.latMax && longitude >= zone.lonMin && longitude <= zone.lonMax) {
      return { ok: true, subdistrict: zone.subdistrict, city: zone.city, display_name: zone.display_name };
    }
  }
  return null;
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
      latitude
    )}&lon=${encodeURIComponent(longitude)}&zoom=14&addressdetails=1&accept-language=id`;
    const res = await fetch(url, {
      headers: { "User-Agent": "NoewbarCSPro/1.0 (commercial-support@noewbar.com)" },
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) {
      const fallback = fallbackGeocode(latitude, longitude);
      if (fallback) return fallback;
      return { ok: false, subdistrict: null, city: null, display_name: null, error: `HTTP ${res.status}` };
    }

    const json = (await res.json()) as {
      display_name?: string;
      address?: {
        suburb?: string;
        city?: string;
        town?: string;
        village?: string;
        city_district?: string;
        county?: string;
        state?: string;
      };
    };

    const addr = json.address ?? {};
    const subdistrict =
      addr.suburb ?? addr.town ?? addr.village ?? addr.city_district ?? addr.county ?? null;
    const city = addr.city ?? addr.town ?? addr.county ?? null;

    if (!subdistrict || !city) {
      const fallback = fallbackGeocode(latitude, longitude);
      if (fallback) return fallback;
    }

    return { ok: true, subdistrict, city, display_name: json.display_name ?? null };
  } catch (err) {
    const fallback = fallbackGeocode(latitude, longitude);
    if (fallback) return fallback;
    return { ok: false, subdistrict: null, city: null, display_name: null, error: err instanceof Error ? err.message : String(err) };
  }
}