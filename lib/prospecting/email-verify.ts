// Free, in-code email verification — no paid API. This caps hard bounces before
// they hit the sending domain (bounces = the fastest way to torch deliverability).
//
// Three cheap, deterministic checks + one network check:
//   1. syntax        — RFC-ish shape
//   2. disposable     — throwaway inbox providers (mailinator, tempmail, …)
//   3. role account   — info@ / office@ / kapcsolat@ … (deliverable but generic)
//   4. MX record      — dns.resolveMx: does the domain actually accept mail?
//
// The pure pieces (classifyEmail, deriveEmailStatus) are unit-tested directly;
// the DNS lookup is injected so verifyEmail is testable without a network.

import { promises as dns } from "node:dns";
import type { EmailStatus } from "@/lib/types/app.types";

// Throwaway / disposable inbox domains. Not exhaustive — the common offenders.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "yopmail.com",
  "throwawaymail.com",
  "trashmail.com",
  "getnada.com",
  "sharklasers.com",
  "maildrop.cc",
  "dispostable.com",
  "fakeinbox.com",
  "mailnesia.com",
  "mohmal.com",
]);

// Local-parts that indicate a shared/role mailbox rather than a person. Includes
// the Hungarian ones we actually see on Google Maps listings.
const ROLE_LOCAL_PARTS = new Set([
  "info",
  "office",
  "contact",
  "hello",
  "admin",
  "administrator",
  "sales",
  "support",
  "help",
  "marketing",
  "hr",
  "press",
  "no-reply",
  "noreply",
  "mail",
  "post",
  "webmaster",
  "billing",
  "accounts",
  // Hungarian
  "iroda",
  "kapcsolat",
  "ugyfelszolgalat",
  "rendeles",
  "foglalas",
  "titkarsag",
  "recepcio",
]);

// Deliberately permissive but shape-correct: one @, a dotted domain, no spaces.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface EmailClassification {
  email: string;
  domain: string | null;
  local_part: string | null;
  syntax_ok: boolean;
  disposable: boolean;
  role_account: boolean;
}

/** Pure: shape + disposable + role classification. No network. */
export function classifyEmail(raw: string | null | undefined): EmailClassification {
  const email = (raw ?? "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return {
      email,
      domain: null,
      local_part: null,
      syntax_ok: false,
      disposable: false,
      role_account: false,
    };
  }
  const atIdx = email.lastIndexOf("@");
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);
  return {
    email,
    domain,
    local_part: local,
    syntax_ok: true,
    disposable: DISPOSABLE_DOMAINS.has(domain),
    role_account: ROLE_LOCAL_PARTS.has(local),
  };
}

/**
 * Pure: fold a classification + MX result into a status.
 *   hasMx === true  → domain accepts mail
 *   hasMx === false → definitively no mail server (undeliverable)
 *   hasMx === null  → couldn't determine (transient DNS) → don't fully trust
 */
export function deriveEmailStatus(
  c: EmailClassification,
  hasMx: boolean | null,
): EmailStatus {
  if (!c.syntax_ok) return "invalid";
  if (c.disposable) return "invalid";
  if (hasMx === false) return "invalid";
  if (c.role_account) return "risky";
  if (hasMx === null) return "risky";
  return "valid";
}

/**
 * Does the domain have MX (or fallback A) records? Returns:
 *   true  — has usable mail records
 *   false — resolved, but no mail server
 *   null  — lookup failed transiently (timeout / SERVFAIL)
 */
export async function hasMx(domain: string): Promise<boolean | null> {
  try {
    const records = await withTimeout(dns.resolveMx(domain), 3000);
    return records.length > 0;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    // NXDOMAIN / NODATA = the domain genuinely has no mail records.
    if (code === "ENOTFOUND" || code === "ENODATA") return false;
    // Timeout / SERVFAIL / other = couldn't determine.
    return null;
  }
}

export interface EmailVerification {
  email_status: EmailStatus;
  syntax_ok: boolean;
  disposable: boolean;
  role_account: boolean;
  has_mx: boolean | null;
}

/**
 * Verify one email. `mxLookup` is injectable so tests run without DNS.
 * Returns "unknown" for an empty/absent email (nothing to verify).
 */
export async function verifyEmail(
  raw: string | null | undefined,
  mxLookup: (domain: string) => Promise<boolean | null> = hasMx,
): Promise<EmailVerification> {
  const c = classifyEmail(raw);
  if (!c.email) {
    return {
      email_status: "unknown",
      syntax_ok: false,
      disposable: false,
      role_account: false,
      has_mx: null,
    };
  }
  const mx = c.syntax_ok && c.domain ? await mxLookup(c.domain) : null;
  return {
    email_status: deriveEmailStatus(c, mx),
    syntax_ok: c.syntax_ok,
    disposable: c.disposable,
    role_account: c.role_account,
    has_mx: mx,
  };
}

/**
 * Verify many emails with bounded concurrency, preserving input order. DNS
 * lookups are cheap but we don't want to open hundreds of sockets at once.
 */
export async function verifyManyEmails(
  emails: (string | null | undefined)[],
  concurrency = 8,
): Promise<EmailVerification[]> {
  const results: EmailVerification[] = new Array(emails.length);
  let cursor = 0;
  async function worker() {
    while (cursor < emails.length) {
      const i = cursor++;
      results[i] = await verifyEmail(emails[i]);
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(1, emails.length)) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("dns timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
