import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

export type ApiError = {
  ok: false;
  error: string;
  detail?: unknown;
};

export function ok<T extends object>(data: T, init?: number): NextResponse {
  return NextResponse.json({ ok: true, ...data }, { status: init ?? 200 });
}

export function fail(
  error: string,
  status = 400,
  detail?: unknown
): NextResponse {
  const body: ApiError = { ok: false, error };
  if (detail !== undefined) body.detail = detail;
  return NextResponse.json(body, { status });
}

/**
 * Parses and validates a JSON body against a Zod schema.
 * Returns a discriminated union so callers never reach into an unvalidated body
 * (specification chapter 16: untrusted input is schema validated).
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: fail("Body must be valid JSON", 400) };
  }

  try {
    return { ok: true, data: schema.parse(raw) };
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        ok: false,
        response: fail(
          "Payload validation failed",
          422,
          err.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
        ),
      };
    }
    return { ok: false, response: fail("Payload validation failed", 422) };
  }
}

// ---------------------------------------------------------------------------
// Fixed window rate limiter (in-process).
// Used for the anti-abuse guard (chapter 11: freeze a store that fires more than
// 120 messages within 3 minutes) and for public endpoint throttling.
// ---------------------------------------------------------------------------

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    retryAfterMs: allowed ? 0 : existing.resetAt - now,
  };
}

/** Test/ops helper: clears limiter state. */
export function resetRateLimits(): void {
  buckets.clear();
}

export function nowIso(): string {
  return new Date().toISOString();
}
