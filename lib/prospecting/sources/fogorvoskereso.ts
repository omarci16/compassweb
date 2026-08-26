// Directory source: fogorvoskereso.hu — the national Hungarian dentist registry.
//
// Why a second source at all: Google Maps gives us "businesses with a shopfront
// in city X". A trade directory gives us a list pre-filtered by profession,
// including practices whose Maps listing is thin or missing. Same funnel, wider
// top.
//
// Why hand-written and deterministic rather than an LLM scraper: the site's
// markup carries the fields on `data-*` attributes and one unambiguous
// `div.view-website > a` anchor. Parsing that is exact and free; asking a model
// to "find the website" would cost tokens per page and occasionally invent one.
// We only need intelligence ONCE — at the time this file is written.
//
// Politeness: robots.txt allows everything but /admin/ (checked 2026-08-10). We
// identify ourselves in the UA, cap pages per run, cap concurrency, and space
// out detail fetches. Only public business contact details are read.
//
// Shape of the site (Laravel + jQuery, list rendered over AJAX):
//   GET  /rendelok                       → HTML carrying a csrf-token meta + session cookie
//   POST /ajax/clinics/get-list          → { result, template } where template is card HTML
//   GET  /rendelok/{id}-{slug}           → detail page holding the practice's own website

import type { LeadCandidate } from "@/lib/apify/google-maps";
import type { ProspectingNiche } from "@/lib/types/app.types";

export const FOGORVOSKERESO_BASE = "https://fogorvoskereso.hu";
export const FOGORVOSKERESO_KEY = "fogorvoskereso";

const USER_AGENT =
  "Mozilla/5.0 (compatible; CompassBot/1.0; +https://compassmarketing.hu)";
const DETAIL_CONCURRENCY = 3;
const DETAIL_SPACING_MS = 250;
const REQUEST_TIMEOUT_MS = 20_000;

export interface DirectoryClinic {
  /** The directory's own id — stable, used to build a dedup key. */
  external_id: string;
  name: string;
  city: string | null;
  detail_url: string;
  lat: number | null;
  lng: number | null;
}

export interface ClinicDetail {
  website_url: string | null;
  phone: string | null;
}

// ---------------------------------------------------------------------
// Pure parsers
// ---------------------------------------------------------------------

/** Decode the HTML entities that actually appear in this site's markup. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&([a-z]+)(acute|uml|circ|grave|tilde|cedil);/gi, "$1")
    .trim();
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`${name}="([^"]*)"`, "i").exec(tag);
  return m ? decodeEntities(m[1]) : null;
}

function num(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse the card HTML returned by /ajax/clinics/get-list.
 *
 * Each real clinic card carries data-id / data-name / data-city / lat / lng and
 * links to its detail page. Sponsored banner cards (`clinic-banner-item`) have
 * no data-id and are skipped — they advertise one practice, they are not rows.
 */
export function parseClinicCards(html: string): DirectoryClinic[] {
  const out: DirectoryClinic[] = [];
  const seen = new Set<string>();

  // Split on card boundaries, then read attributes off the opening tag and the
  // detail link out of the card body.
  const chunks = html.split(/(?=<div[^>]*class="[^"]*clinic-list-item)/i);

  for (const chunk of chunks) {
    const openTag = /<div[^>]*clinic-list-item[^>]*>/i.exec(chunk)?.[0];
    if (!openTag) continue;

    const externalId = attr(openTag, "data-id");
    const name = attr(openTag, "data-name");
    if (!externalId || !name) continue; // banner / promo card
    if (seen.has(externalId)) continue;

    const detail = /href="((?:https?:\/\/[^"]*)?\/rendelok\/[^"]+)"/i.exec(chunk)?.[1];
    if (!detail) continue;
    const detailUrl = detail.startsWith("http") ? detail : `${FOGORVOSKERESO_BASE}${detail}`;
    // /rendelok/regisztracio is the "add your practice" CTA, not a listing.
    if (/\/rendelok\/regisztracio/i.test(detailUrl)) continue;

    seen.add(externalId);
    out.push({
      external_id: externalId,
      name,
      city: attr(openTag, "data-city"),
      detail_url: detailUrl,
      lat: num(attr(openTag, "data-location-lat")),
      lng: num(attr(openTag, "data-location-lng")),
    });
  }

  return out;
}

/**
 * Pull the practice's own website + phone off a detail page.
 *
 * The website lives in exactly one place — `div.view-website > a` — so we read
 * that rather than guessing at "the first external link", which on these pages
 * would pick up the payment provider's PDF.
 */
export function parseClinicDetail(html: string): ClinicDetail {
  let websiteUrl: string | null = null;

  const block = /<div[^>]*class="[^"]*view-website[^"]*"[^>]*>([\s\S]{0,600}?)<\/div>/i.exec(html);
  if (block) {
    const href = /href="(https?:\/\/[^"]+)"/i.exec(block[1])?.[1];
    if (href && !href.includes("fogorvoskereso.hu")) websiteUrl = decodeEntities(href);
  }

  // tel: hrefs on this site are sometimes malformed (review text bleeds into
  // the attribute), so require a plausible Hungarian number.
  let phone: string | null = null;
  for (const m of html.matchAll(/href="tel:([^"]{6,25})"/gi)) {
    const raw = m[1].replace(/[^\d+]/g, "");
    if (/^(\+?36|06)\d{8,9}$/.test(raw)) {
      phone = decodeEntities(m[1]).trim();
      break;
    }
  }

  return { website_url: websiteUrl, phone };
}

/**
 * Map a directory row into the same LeadCandidate the Google Maps path emits,
 * so everything downstream (dedup → contact harvest → verify → score → offer
 * routing) is reused untouched.
 *
 * `gmaps_place_id` carries a namespaced key rather than a Google id: it is the
 * external-identity column in practice, and its unique index gives this source
 * idempotent re-runs for free. The prefix makes the provenance unmistakable.
 */
export function toLeadCandidate(
  clinic: DirectoryClinic,
  detail: ClinicDetail,
  niche: ProspectingNiche,
): LeadCandidate {
  return {
    company_name: clinic.name,
    niche,
    gmaps_category: "Fogászat",
    gmaps_address: null,
    gmaps_city: clinic.city,
    gmaps_rating: null,
    gmaps_review_count: null,
    gmaps_phone: detail.phone,
    gmaps_url: clinic.detail_url,
    gmaps_place_id: `${FOGORVOSKERESO_KEY}:${clinic.external_id}`,
    website_url: detail.website_url,
    email: null, // harvested later from the practice's own site (Phase I)
    social_links: {},
  };
}

// ---------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------

async function get(url: string, cookie?: string): Promise<{ body: string; cookie: string }> {
  const res = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml",
      ...(cookie ? { cookie } : {}),
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const setCookie = res.headers.get("set-cookie");
  return {
    body: await res.text(),
    cookie: setCookie ? setCookie.split(",").map((c) => c.split(";")[0].trim()).join("; ") : (cookie ?? ""),
  };
}

/** The list endpoint is CSRF-protected, so open the page first for a token + session. */
async function openSession(): Promise<{ token: string; cookie: string }> {
  const { body, cookie } = await get(`${FOGORVOSKERESO_BASE}/rendelok`);
  const token = /name="csrf-token"\s+content="([^"]+)"/i.exec(body)?.[1] ?? "";
  return { token, cookie };
}

async function fetchListPage(
  session: { token: string; cookie: string },
  page: number,
  city: string | null,
): Promise<DirectoryClinic[]> {
  const form = new URLSearchParams({ _token: session.token, page: String(page) });
  if (city) form.set("filter_location", city);

  const res = await fetch(`${FOGORVOSKERESO_BASE}/ajax/clinics/get-list`, {
    method: "POST",
    headers: {
      "user-agent": USER_AGENT,
      "content-type": "application/x-www-form-urlencoded",
      "x-requested-with": "XMLHttpRequest",
      cookie: session.cookie,
    },
    body: form.toString(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) return [];

  const json = (await res.json()) as { result?: boolean; template?: string };
  return json.template ? parseClinicCards(json.template) : [];
}

/** Fetch detail pages with a concurrency cap and spacing — be a good citizen. */
async function fetchDetails(clinics: DirectoryClinic[]): Promise<ClinicDetail[]> {
  const out: ClinicDetail[] = new Array(clinics.length);
  let i = 0;

  const worker = async () => {
    while (true) {
      const idx = i++;
      if (idx >= clinics.length) return;
      try {
        const { body } = await get(clinics[idx].detail_url);
        out[idx] = parseClinicDetail(body);
      } catch {
        out[idx] = { website_url: null, phone: null };
      }
      await new Promise((r) => setTimeout(r, DETAIL_SPACING_MS));
    }
  };

  await Promise.all(
    new Array(Math.min(DETAIL_CONCURRENCY, clinics.length || 1)).fill(0).map(worker),
  );
  return out;
}

export interface FogorvoskeresoOptions {
  city?: string | null;
  /** Hard cap on rows per run — keeps a manual launch predictable. */
  maxResults?: number;
  maxPages?: number;
}

/**
 * Walk the directory and return LeadCandidates ready for the normal import
 * path. Never throws: a partial list is more useful than a failed job.
 */
export async function fetchFogorvoskeresoCandidates(
  niche: ProspectingNiche,
  opts: FogorvoskeresoOptions = {},
): Promise<LeadCandidate[]> {
  const maxResults = opts.maxResults ?? 200;
  const maxPages = opts.maxPages ?? 20;
  const city = opts.city ?? null;

  let session: { token: string; cookie: string };
  try {
    session = await openSession();
  } catch (err) {
    console.error("[fogorvoskereso] could not open session", err);
    return [];
  }
  if (!session.token) {
    console.error("[fogorvoskereso] no csrf token — site markup may have changed");
    return [];
  }

  const clinics: DirectoryClinic[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= maxPages && clinics.length < maxResults; page++) {
    let batch: DirectoryClinic[];
    try {
      batch = await fetchListPage(session, page, city);
    } catch (err) {
      console.error(`[fogorvoskereso] list page ${page} failed`, err);
      break;
    }
    if (batch.length === 0) break; // ran out of results

    let added = 0;
    for (const c of batch) {
      if (seen.has(c.external_id) || clinics.length >= maxResults) continue;
      seen.add(c.external_id);
      clinics.push(c);
      added++;
    }
    // Same page echoed back = pagination has stopped advancing.
    if (added === 0) break;
  }

  if (clinics.length === 0) return [];

  const details = await fetchDetails(clinics);
  return clinics.map((c, idx) =>
    toLeadCandidate(c, details[idx] ?? { website_url: null, phone: null }, niche),
  );
}
