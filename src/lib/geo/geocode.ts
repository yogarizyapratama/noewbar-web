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

export async function reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
      latitude
    )}&lon=${encodeURIComponent(longitude)}&zoom=14&addressdetails=1&accept-language=id`;
    const res = await fetch(url, {
      headers: { "User-Agent": "NoewbarCSPro/1.0 (commercial-support@noewbar.com)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, subdistrict: null, city: null, display_name: null, error: `HTTP ${res.status}` };

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

    return { ok: true, subdistrict, city, display_name: json.display_name ?? null };
  } catch (err) {
    return { ok: false, subdistrict: null, city: null, display_name: null, error: err instanceof Error ? err.message : String(err) };
  }
}