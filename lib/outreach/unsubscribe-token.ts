// One-click unsubscribe token — HMAC-signed so the token can't be forged or
// enumerated, but no DB column is needed. The token encodes the recipient
// email; the unsubscribe route verifies the signature, then suppresses.

import crypto from "node:crypto";

function secret(): string {
  // Reuse an existing server secret; fall back to a dev constant so demo works.
  return (
    process.env.UNSUBSCRIBE_SECRET ||
    process.env.INNGEST_SIGNING_KEY ||
    "compass-dev-unsubscribe-secret"
  );
}

/** Make a signed unsubscribe token for an email address. */
export function makeUnsubToken(email: string): string {
  const payload = Buffer.from(email.trim().toLowerCase(), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/** Verify a token, returning the email it encodes, or null if invalid. */
export function verifyUnsubToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const email = Buffer.from(payload, "base64url").toString("utf8");
    return email || null;
  } catch {
    return null;
  }
}
