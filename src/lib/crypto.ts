import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env } from "./env";

export { hashPassword, verifyPassword } from "./password";

/**
 * Cryptographic primitives.
 *
 *  • AES-256-GCM field encryption for sensitive free text (review commentary,
 *    1:1 notes, feedback). The IV is random per write and the GCM auth tag
 *    detects tampering. Format: `v1.<iv_b64>.<tag_b64>.<ciphertext_b64>`.
 *  • SHA-256 for opaque-token storage — tokens are high-entropy random values,
 *    so a fast hash is appropriate (unlike user passwords, which use scrypt —
 *    see `./password` — for the small set of local/non-SSO accounts).
 *  • Constant-time comparison for CSRF and token checks.
 */

const KEY = createHash("sha256")
  .update(Buffer.from(env.FIELD_ENCRYPTION_KEY, "utf8"))
  .digest();

export function encryptField(plaintext: string | null | undefined): string | null {
  if (plaintext === null || plaintext === undefined || plaintext === "") {
    return null;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ct.toString("base64url")}`;
}

export function decryptField(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    // Tolerate legacy/plaintext values rather than crashing a read path.
    return payload;
  }
  const [, ivB64, tagB64, ctB64] = parts as [string, string, string, string];
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      KEY,
      Buffer.from(ivB64, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    const pt = Buffer.concat([
      decipher.update(Buffer.from(ctB64, "base64url")),
      decipher.final(),
    ]);
    return pt.toString("utf8");
  } catch {
    // Wrong key or tampered ciphertext — never leak the payload.
    return null;
  }
}

/** Convenience wrapper for arrays of records with `*Enc` columns. */
export function decryptMany<T extends Record<string, unknown>>(
  rows: T[],
  fields: (keyof T)[],
): T[] {
  return rows.map((row) => {
    const next: Record<string, unknown> = { ...row };
    for (const f of fields) {
      const k = String(f);
      next[k] = decryptField(row[f] as string | null);
    }
    return next as T;
  });
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** HMAC-free signed token: `<payload>.<sha256(payload + secret)>`. */
export function signValue(payload: string): string {
  return `${payload}.${sha256Hex(`${payload}.${env.APP_SECRET}`)}`;
}

export function verifySignedValue(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx <= 0) return null;
  const payload = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  return constantTimeEqual(sig, sha256Hex(`${payload}.${env.APP_SECRET}`))
    ? payload
    : null;
}

/**
 * Mask an email/serial for logs and UI where full PII is unnecessary.
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = (local ?? "").slice(0, 2);
  return `${visible}${"*".repeat(Math.max(1, (local ?? "").length - 2))}@${domain}`;
}
