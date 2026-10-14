import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import crypto from "crypto";

/**
 * Argon2id password hashing (specification chapter 14.2: PBKDF2/Argon2 for the
 * tenant login credentials).
 *
 * Parameters mirror the OWASP baseline for Argon2id: m=19456 KiB, t=2, p=1.
 * The stored hash is the standard PHC string, so it is portable across runtimes.
 */
const ARGON_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  return argonHash(plain, ARGON_OPTIONS);
}

/**
 * Verifies a plaintext password against an Argon2id PHC hash.
 * Returns false (never throws) for malformed hashes so a placeholder value in the
 * environment can never be mistaken for a valid credential.
 */
export async function verifyPassword(plain: string, phcHash: string): Promise<boolean> {
  if (!phcHash.startsWith("$argon2")) return false;
  try {
    return await argonVerify(phcHash, plain);
  } catch {
    return false;
  }
}

/** True when a string is a structurally complete Argon2id PHC hash (6 segments). */
export function isValidArgonHash(value: string): boolean {
  return /^\$argon2(id|i|d)\$v=\d+\$m=\d+,t=\d+,p=\d+\$[^$]+\$[^$]+$/.test(value);
}

// ---------------------------------------------------------------------------
// Session tokens: dependency-free HMAC-SHA256 signed payloads.
// ---------------------------------------------------------------------------

export type SessionPayload = {
  sub: string; // tenant id
  email: string;
  role: "TENANT";
  exp: number; // unix seconds
};

export type AdminPayload = {
  sub: "superadmin";
  email: string;
  role: "SUPERADMIN";
  exp: number;
};

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(body: string, secret: string): string {
  return b64url(crypto.createHmac("sha256", secret).update(body).digest());
}

export function createToken<T extends { exp: number }>(payload: T, secret: string): string {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body, secret)}`;
}

/**
 * Verifies and decodes a token. Returns null for a bad signature, malformed
 * payload, or an expired token.
 */
export function verifyToken<T extends { exp: number }>(token: string, secret: string): T | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [body, signature] = parts;
  const expected = sign(body, secret);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(fromB64url(body).toString("utf8")) as T;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Order helpers
// ---------------------------------------------------------------------------

/** Three digit unique code (100-999) appended to every store invoice total. */
export function generateUniqueCode(): number {
  return crypto.randomInt(100, 1000);
}

/** Cryptographically random instance key for a tenant WhatsApp session. */
export function generateInstanceKey(seed: string): string {
  const slug = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return `${slug}-${crypto.randomBytes(4).toString("hex")}`;
}

/** Constant-time comparison of two secrets of arbitrary length. */
export function safeEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}
