// Contact extraction — mine emails, phones and social profiles out of HTML we
// have ALREADY downloaded (the static probe in site-analyzer, and the rendered
// Apify crawl in verify-website). Zero extra network requests, zero AI tokens.
//
// Why deterministic and not an LLM: the output of this module gets EMAILED from
// a sending domain whose reputation we are carefully warming. An LLM asked to
// "find the contact email" will occasionally invent a plausible one; a parser
// physically cannot return an address that is not in the page. Inventing a
// recipient is the same class of failure Scraping 2.0 existed to kill (a
// confident claim not grounded in what was actually observed), and here it
// costs bounces — the one thing that burns a cold-sending domain. So: no AI.
//
// Ranking is the whole value. A naive email regex on a Hungarian SMB page
// returns asset filenames, Sentry DSNs, theme-author addresses and
// noreply@ boxes. What we want is the address a human would pick: the one on
// the site's own domain, preferring a named person over a role box, and
// freemail (very common for HU small business) as a real but lower-ranked
// fallback.

import type { SocialLinks } from "@/lib/types/app.types";

const MAX_SCAN_CHARS = 250_000;
const MAX_EMAILS = 8;
const MAX_PHONES = 5;

export type EmailKind = "personal" | "role" | "freemail";

export interface DiscoveredEmail {
  email: string;
  /** Higher = better candidate. See rankEmail(). */
  rank: number;
  kind: EmailKind;
  /** True when the address is on the site's own domain (or a subdomain of it). */
  own_domain: boolean;
  /** mailto: hrefs are a stronger signal than a string in body text. */
  from_mailto: boolean;
}

export interface ExtractedContacts {
  emails: DiscoveredEmail[];
  phones: string[];
  /**
   * Same shape as the existing `leads.social_links` column, so discovered
   * profiles merge straight into it — and therefore feed the scorer's
   * social_links_count with no extra plumbing.
   */
  socials: SocialLinks;
}

export const EMPTY_CONTACTS: ExtractedContacts = {
  emails: [],
  phones: [],
  socials: {},
};

// ---------------------------------------------------------------------
// Rejection lists
// ---------------------------------------------------------------------

/** Local parts we never want to email — automated or infrastructure boxes. */
const REJECT_LOCAL_PARTS = new Set([
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "postmaster",
  "mailer-daemon",
  "abuse",
  "webmaster",
  "hostmaster",
  "privacy",
  "dmarc",
  "dmarc-reports",
  "spam",
  "bounce",
  "bounces",
  "notifications",
  "notification",
  "wordpress",
  "sentry",
]);

/**
 * Domains that appear in page source but are never the business's own contact:
 * placeholder examples, platform/theme boilerplate, and error-reporting hosts.
 */
const REJECT_DOMAIN_PATTERNS: RegExp[] = [
  /^example\.(com|org|net|hu)$/i,
  /^(your|yourdomain|domain|email|mail|site|website|company)\.(com|hu|org|net)$/i,
  /^sentry\./i,
  /\.sentry\.io$/i,
  /^ingest\./i,
  /wixpress\.com$/i,
  /^sentry\.io$/i,
  /^wordpress\.(org|com)$/i,
  /^w3\.org$/i,
  /^schema\.org$/i,
  /^googleapis\.com$/i,
  /^gstatic\.com$/i,
  /^cloudflare\.com$/i,
  /^jquery\.com$/i,
  /^fontawesome\.com$/i,
  /^themeforest\.net$/i,
  /^envato\.com$/i,
  /^adobe\.com$/i,
  /^placeholder\./i,
  /^test\.(com|hu)$/i,
  /^email\.tld$/i,
  /^sativa\./i,
];

/** Placeholder local parts used in template/demo markup. */
const PLACEHOLDER_LOCALS = new Set([
  "youremail",
  "your-email",
  "your_email",
  "email",
  "name",
  "firstname",
  "lastname",
  "user",
  "username",
  "someone",
  "sample",
  "test",
  "demo",
  "placeholder",
  "valaki",
  "nev",
]);

/**
 * Role boxes — a real human reads these, they are just not a named person.
 * Hungarian first because most of our targets are HU SMBs.
 */
const ROLE_LOCAL_PARTS = new Set([
  // Hungarian
  "info",
  "iroda",
  "kapcsolat",
  "titkarsag",
  "ugyfelszolgalat",
  "rendeles",
  "foglalas",
  "recepcio",
  "penzugy",
  "szamlazas",
  "marketing",
  "ertekesites",
  "allas",
  "panasz",
  // International
  "office",
  "hello",
  "contact",
  "sales",
  "support",
  "help",
  "mail",
  "admin",
  "booking",
  "reservations",
  "reception",
  "shop",
  "orders",
  "team",
  "hi",
  "hey",
  "welcome",
  "billing",
  "accounts",
  "hr",
  "jobs",
  "press",
  "media",
  "partner",
  "partners",
]);

/** Free mailbox providers common in Hungary. Real, but weaker than own-domain. */
const FREEMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "freemail.hu",
  "citromail.hu",
  "citromail.com",
  "vipmail.hu",
  "indamail.hu",
  "t-online.hu",
  "chello.hu",
  "invitel.hu",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "outlook.hu",
  "live.com",
  "icloud.com",
  "me.com",
  "protonmail.com",
  "proton.me",
  "gmx.com",
  "gmx.net",
  "web.de",
  "mail.ru",
  "seznam.cz",
]);

/** File extensions that make an "@"-containing token an asset, not an address. */
const ASSET_EXT = /\.(png|jpe?g|gif|svg|webp|avif|ico|css|js|mjs|json|woff2?|ttf|eot|mp4|webm|pdf|zip)$/i;

// ---------------------------------------------------------------------
// Email extraction
// ---------------------------------------------------------------------

// Deliberately conservative: no consecutive dots, TLD 2-24 alpha.
const EMAIL_RE =
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,24}/g;

const MAILTO_RE = /mailto:\s*([^"'?>\s]+)/gi;

/**
 * Common lightweight obfuscations on HU SMB sites. We only undo the textual
 * ones — never guess at JS-assembled addresses (that is what the rendered
 * crawl in verify-website is for).
 */
function deobfuscate(html: string): string {
  return html
    .replace(/\s*\[\s*(?:at|kukac)\s*\]\s*/gi, "@")
    .replace(/\s*\(\s*(?:at|kukac)\s*\)\s*/gi, "@")
    .replace(/\s+(?:kukac)\s+/gi, "@")
    .replace(/\s*\[\s*dot\s*\]\s*/gi, ".")
    .replace(/\s*\(\s*dot\s*\)\s*/gi, ".")
    .replace(/&#64;/g, "@")
    .replace(/&#46;/g, ".")
    .replace(/&commat;/gi, "@");
}

/**
 * Accept either a bare host or a full URL — callers hold both shapes
 * (`final_url` from the probe, `hostname` from a parsed URL) and silently
 * comparing a URL against a host would misclassify every own-domain address.
 */
function normalizeHost(hostOrUrl: string): string {
  let h = hostOrUrl.trim().toLowerCase();
  if (h.includes("://")) {
    try {
      h = new URL(h).hostname;
    } catch {
      /* fall through to string handling */
    }
  }
  h = h.replace(/^https?:\/\//, "");
  h = h.split("/")[0] ?? "";
  h = h.split("@").pop() ?? "";
  h = h.split(":")[0] ?? "";
  return h.replace(/^www\./, "");
}

/** "shop.example.co.uk" and "example.co.uk" should count as the same business. */
function isOwnDomain(emailDomain: string, siteHost: string | null): boolean {
  if (!siteHost) return false;
  const a = normalizeHost(emailDomain);
  const b = normalizeHost(siteHost);
  if (!b) return false;
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

function classifyEmailKind(local: string, domain: string): EmailKind {
  if (FREEMAIL_DOMAINS.has(normalizeHost(domain))) return "freemail";
  if (ROLE_LOCAL_PARTS.has(local)) return "role";
  return "personal";
}

/** Is this a plausible business contact address at all? */
export function isRejectedEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at <= 0) return true;
  const local = email.slice(0, at).toLowerCase();
  const domain = email.slice(at + 1).toLowerCase();

  if (ASSET_EXT.test(email)) return true;
  if (local.length > 64 || domain.length > 255) return true;
  if (REJECT_LOCAL_PARTS.has(local)) return true;
  if (PLACEHOLDER_LOCALS.has(local)) return true;
  if (REJECT_DOMAIN_PATTERNS.some((re) => re.test(domain))) return true;
  // Sentry DSNs and cache-busted asset hashes: long hex local parts.
  if (/^[0-9a-f]{16,}$/i.test(local)) return true;
  // "logo@2x" style retina asset tokens.
  if (/^\d+x$/i.test(domain.split(".")[0] ?? "")) return true;
  if (/^\d+$/.test(local)) return true;
  return false;
}

/**
 * Score a candidate. Ordering intent, best first:
 *   own-domain personal > own-domain role > own-domain other
 *   > freemail personal > freemail role > off-domain
 * mailto: presence adds a small bump so a linked address beats a loose string.
 */
export function rankEmail(
  email: string,
  siteHost: string | null,
  fromMailto: boolean,
): { rank: number; kind: EmailKind; own_domain: boolean } {
  const at = email.lastIndexOf("@");
  const local = email.slice(0, at).toLowerCase();
  const domain = email.slice(at + 1).toLowerCase();
  const own = isOwnDomain(domain, siteHost);
  const kind = classifyEmailKind(local, domain);

  let rank = 0;
  if (own) rank += 100;
  if (kind === "personal") rank += 30;
  else if (kind === "role") rank += 20;
  else rank += 5; // freemail
  // A dotted or dashed local part usually means a real person (kovacs.peter).
  if (kind === "personal" && /[._-]/.test(local)) rank += 5;
  if (fromMailto) rank += 10;

  return { rank, kind, own_domain: own };
}

export function extractEmails(html: string, siteHost: string | null): DiscoveredEmail[] {
  const scan = deobfuscate(html.slice(0, MAX_SCAN_CHARS));

  const mailtos = new Set<string>();
  for (const m of scan.matchAll(MAILTO_RE)) {
    const decoded = decodeURIComponent(m[1] ?? "").trim().toLowerCase();
    const found = decoded.match(EMAIL_RE);
    if (found?.[0]) mailtos.add(found[0]);
  }

  const all = new Map<string, boolean>(); // email -> fromMailto
  for (const e of mailtos) all.set(e, true);
  for (const m of scan.match(EMAIL_RE) ?? []) {
    const e = m.toLowerCase();
    if (!all.has(e)) all.set(e, false);
  }

  const out: DiscoveredEmail[] = [];
  for (const [email, fromMailto] of all) {
    if (isRejectedEmail(email)) continue;
    const { rank, kind, own_domain } = rankEmail(email, siteHost, fromMailto);
    out.push({ email, rank, kind, own_domain, from_mailto: fromMailto });
  }

  out.sort((a, b) => b.rank - a.rank || a.email.localeCompare(b.email));
  return out.slice(0, MAX_EMAILS);
}

// ---------------------------------------------------------------------
// Phone extraction
// ---------------------------------------------------------------------

const TEL_RE = /tel:\s*([+0-9()\s.\-]{6,25})/gi;
// +36 1 234 5678 / 06 30 123 4567 / (06-1) 234-5678
const PHONE_TEXT_RE = /(?:\+36|0036|06)[\s.\-/()]*\d[\d\s.\-/()]{6,14}\d/g;

/**
 * Normalize a Hungarian number to +36XXXXXXXXX.
 * Returns null when the digits cannot be a HU subscriber number — this is what
 * keeps tax numbers (adószám, 11 digits) and dates out of the phone field.
 */
export function normalizeHuPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  let d = digits.startsWith("+") ? digits.slice(1) : digits;

  if (d.startsWith("0036")) d = `36${d.slice(4)}`;
  else if (d.startsWith("06")) d = `36${d.slice(2)}`;
  else if (!d.startsWith("36")) return null;

  const national = d.slice(2);
  // Budapest landline is 1 + 7 digits (8); mobile/other is 2 + 7 digits (9).
  if (national.length !== 8 && national.length !== 9) return null;
  if (national.startsWith("0")) return null;
  if (/^(\d)\1+$/.test(national)) return null; // 111111111

  if (national.startsWith("1") && national.length === 8) {
    return `+36 1 ${national.slice(1, 4)} ${national.slice(4)}`;
  }
  if (national.length === 9) {
    return `+36 ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}`;
  }
  return `+36 ${national}`;
}

export function extractPhones(html: string): string[] {
  const scan = html.slice(0, MAX_SCAN_CHARS);
  const ordered: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string) => {
    const n = normalizeHuPhone(raw);
    if (n && !seen.has(n)) {
      seen.add(n);
      ordered.push(n);
    }
  };

  // tel: hrefs are author-declared — trust them first.
  for (const m of scan.matchAll(TEL_RE)) push(m[1] ?? "");
  // Strip tags so digits inside markup/attributes don't concatenate into
  // number-shaped noise.
  const text = scan.replace(/<[^>]+>/g, " ");
  for (const m of text.match(PHONE_TEXT_RE) ?? []) push(m);

  return ordered.slice(0, MAX_PHONES);
}

// ---------------------------------------------------------------------
// Social links
// ---------------------------------------------------------------------

/**
 * Platform paths that are never a business profile (share widgets, the
 * platform's own pages, developer docs).
 */
const SOCIAL_PATH_REJECT =
  /^\/(sharer|share|share\.php|dialog|plugins|tr|intent|home|login|signup|privacy|policies|legal|about|developers?|help|settings|search|hashtag|explore|p|reel|watch|events|groups)(\/|$|\.php)/i;

const SOCIAL_MATCHERS: {
  key: keyof SocialLinks;
  host: RegExp;
}[] = [
  { key: "facebook", host: /(^|\.)(facebook\.com|fb\.com)$/i },
  { key: "instagram", host: /(^|\.)instagram\.com$/i },
  { key: "linkedin", host: /(^|\.)linkedin\.com$/i },
  { key: "tiktok", host: /(^|\.)tiktok\.com$/i },
];

const HREF_RE = /href\s*=\s*["']([^"']+)["']/gi;

/**
 * Pull the business's own social profiles. These matter beyond bookkeeping: a
 * lead with no usable email but a live Instagram page is still reachable, and
 * `instagram_dm` is already a first-class lead source in the schema.
 */
export function extractSocials(html: string): SocialLinks {
  const scan = html.slice(0, MAX_SCAN_CHARS);
  const out: SocialLinks = {};

  for (const m of scan.matchAll(HREF_RE)) {
    const rawHref = (m[1] ?? "").trim();
    if (!rawHref || rawHref.startsWith("#")) continue;
    const href = rawHref.startsWith("//") ? `https:${rawHref}` : rawHref;
    if (!/^https?:\/\//i.test(href)) continue;

    let url: URL;
    try {
      url = new URL(href);
    } catch {
      continue;
    }

    const host = url.hostname.toLowerCase();
    const match = SOCIAL_MATCHERS.find((s) => s.host.test(host));
    if (!match) continue;
    if (out[match.key]) continue; // first occurrence wins
    if (url.pathname === "/" || url.pathname === "") continue;
    if (SOCIAL_PATH_REJECT.test(url.pathname)) continue;

    // Drop tracking params — these links get shown and clicked by a human.
    url.search = "";
    url.hash = "";
    out[match.key] = url.toString().replace(/\/$/, "");
  }

  return out;
}

/**
 * Classify a single URL that is itself a social profile. Used when a lead's
 * listed "website" turns out to be a Facebook/Instagram page — that profile is
 * still a reachable channel, so it must not be discarded.
 */
export function socialFromUrl(rawUrl: string): SocialLinks {
  let url: URL;
  try {
    url = new URL(rawUrl.includes("://") ? rawUrl : `https://${rawUrl}`);
  } catch {
    return {};
  }
  const host = url.hostname.toLowerCase();
  const match = SOCIAL_MATCHERS.find((s) => s.host.test(host));
  if (!match) return {};
  if (url.pathname === "/" || url.pathname === "") return {};
  if (SOCIAL_PATH_REJECT.test(url.pathname)) return {};
  url.search = "";
  url.hash = "";
  return { [match.key]: url.toString().replace(/\/$/, "") };
}

// ---------------------------------------------------------------------
// Orchestrator + merge
// ---------------------------------------------------------------------

/**
 * Extract every contact channel from one HTML document.
 * `siteUrl` is used only to decide what "own domain" means — pass the URL the
 * content actually came from (final_url after redirects), not the requested one.
 */
export function extractContacts(
  html: string | null | undefined,
  siteUrl: string | null | undefined,
): ExtractedContacts {
  if (!html || html.length === 0) return { emails: [], phones: [], socials: {} };

  let siteHost: string | null = null;
  if (siteUrl) {
    try {
      siteHost = new URL(siteUrl.includes("://") ? siteUrl : `https://${siteUrl}`).hostname;
    } catch {
      siteHost = null;
    }
  }

  return {
    emails: extractEmails(html, siteHost),
    phones: extractPhones(html),
    socials: extractSocials(html),
  };
}

/**
 * Merge two extractions, `primary` winning ties. Used to fold the rendered
 * crawl (which sees JS-injected addresses) over the static probe result.
 */
export function mergeContacts(
  primary: ExtractedContacts | null,
  secondary: ExtractedContacts | null,
): ExtractedContacts {
  const a = primary ?? EMPTY_CONTACTS;
  const b = secondary ?? EMPTY_CONTACTS;

  const byEmail = new Map<string, DiscoveredEmail>();
  for (const e of [...a.emails, ...b.emails]) {
    const existing = byEmail.get(e.email);
    if (!existing || e.rank > existing.rank) byEmail.set(e.email, e);
  }
  const emails = [...byEmail.values()]
    .sort((x, y) => y.rank - x.rank || x.email.localeCompare(y.email))
    .slice(0, MAX_EMAILS);

  const phones = [...new Set([...a.phones, ...b.phones])].slice(0, MAX_PHONES);
  // Primary wins per key; absent keys stay absent (matches SocialLinks shape).
  const socials: SocialLinks = { ...b.socials, ...a.socials };

  return { emails, phones, socials };
}

/** The address we would actually send to, or null if there is none. */
export function bestEmail(contacts: ExtractedContacts | null | undefined): string | null {
  return contacts?.emails[0]?.email ?? null;
}

/**
 * True when at least one social profile exists — i.e. a DM channel. A lead with
 * no usable email but a live Instagram page is still reachable, and
 * `instagram_dm` is already a first-class lead source in the schema.
 */
export function hasSocialChannel(socials: SocialLinks | null | undefined): boolean {
  if (!socials) return false;
  return Boolean(socials.instagram || socials.facebook || socials.linkedin);
}
