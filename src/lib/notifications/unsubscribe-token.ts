import { createHmac, timingSafeEqual } from "crypto";

/**
 * Signed, no-login-required unsubscribe tokens (confirmed 2026-09-03,
 * email redesign brief) — HMAC-SHA256 over `{recipientId, key}`, using
 * Node's built-in `crypto` (no new dependency), same "one small
 * always-verify-server-side secret" pattern already used for CRON_SECRET
 * elsewhere in this codebase. Deliberately no expiry — an unsubscribe
 * link that stops working after N days is a worse experience than one
 * that always works, and there's no security reason to expire this one
 * (worst case a stale token still only ever flips ONE specific person's
 * ONE specific preference, never anything else).
 *
 * `key` is either a `keyof NotificationPreferences` (unsubscribe from one
 * event type) or the literal "all" (the master opt-out, confirmed
 * 2026-09-03 — cheap to add alongside the per-type option, expected by
 * users once they're already on the confirm page).
 */

function getSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("UNSUBSCRIBE_SECRET is not set.");
  return secret;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function signUnsubscribeToken(recipientId: string, key: string): string {
  const payload = `${recipientId}:${key}`;
  const signature = createHmac("sha256", getSecret()).update(payload).digest();
  return `${base64url(payload)}.${base64url(signature)}`;
}

export interface VerifiedUnsubscribeToken {
  recipientId: string;
  key: string;
}

/** Returns null on any malformed/tampered/mismatched token — never throws, so callers can render a plain "invalid link" state. */
export function verifyUnsubscribeToken(token: string): VerifiedUnsubscribeToken | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadPart, signaturePart] = parts;

  let payload: string;
  try {
    payload = Buffer.from(payloadPart, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expectedSignature = createHmac("sha256", getSecret()).update(payload).digest();
  let providedSignature: Buffer;
  try {
    providedSignature = Buffer.from(signaturePart, "base64url");
  } catch {
    return null;
  }
  if (providedSignature.length !== expectedSignature.length) return null;
  if (!timingSafeEqual(providedSignature, expectedSignature)) return null;

  const separatorIndex = payload.indexOf(":");
  if (separatorIndex === -1) return null;
  const recipientId = payload.slice(0, separatorIndex);
  const key = payload.slice(separatorIndex + 1);
  if (!recipientId || !key) return null;
  return { recipientId, key };
}
