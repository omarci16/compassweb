// Site analyzer — resolve a URL to the site that actually serves content, then
// extract health + tech stack + pain signals from a single rendered-agnostic
// static fetch.
//
// Why this shape: cheap signal extraction at scale beats per-lead AI analysis
// for bulk discovery. But the cheap layer must never LIE — a lead flagged as a
// "placeholder with no HTTPS" that in reality has a perfectly good site poisons
// every downstream audit and email. So this module:
//   1. Resolves both schemes (the windingatlan.hu trap: Google Maps lists
//      http://, which serves a stub, while https:// serves the real site).
//   2. Distinguishes "we couldn't look" (blocked / unreachable) from "the site
//      is genuinely bad" — the former must score zero, never a buy signal.
//   3. Distinguishes a JS-rendered shell from a real placeholder.
//   4. Tags every pain signal with confidence + evidence so a human (and the
//      pain-audit prompt) can tell a measured fact from a static-HTML guess.
//
// Static fetch only — no JS execution. Content-derived signals are therefore
// "heuristic" until the Phase 2 verification layer renders the page.

import type {
  PainSignal,
  SignalConfidence,
  SignalEvidence,
  TechStack,
  WebsiteHealthDetails,
  WebsiteHealthStatus,
} from "@/lib/types/app.types";
import {
  extractContacts,
  socialFromUrl,
  type ExtractedContacts,
} from "./contact-extract";

const PROBE_TIMEOUT_MS = 9000;
const RETRY_TIMEOUT_MS = 12000;
export const TINY_BODY_THRESHOLD = 5000;
const STALE_LAST_MODIFIED_DAYS = 365 * 3;
const MAX_HTML_READ = 200_000;

const USER_AGENT =
  "Mozilla/5.0 (compatible; CompassBot/1.0; +https://compassmarketing.hu)";

const SOCIAL_HOSTS = [
  "instagram.com", "www.instagram.com",
  "facebook.com", "www.facebook.com", "fb.com", "m.facebook.com",
  "linkedin.com", "www.linkedin.com",
  "tiktok.com", "www.tiktok.com",
];

export interface SiteAnalysis {
  health_status: WebsiteHealthStatus;
  health_details: WebsiteHealthDetails;
  tech_stack: TechStack | null;
  pain_signals: PainSignal[];
  /**
   * Contacts mined from the HTML this probe already downloaded — free, no
   * extra request. Null whenever we never saw a real page (no URL, blocked,
   * unreachable, error page), so "no contacts found" is never confused with
   * "we never looked".
   */
  contacts: ExtractedContacts | null;
}

const EMPTY_TECH_STACK: TechStack = {
  cms: null,
  ecommerce: null,
  analytics: [],
  booking: null,
  has_blog: false,
  has_schema_org: false,
  has_open_graph: false,
  has_viewport_meta: false,
  has_https: false,
  has_contact_form: false,
  has_sitemap: null,
};

// ---------------------------------------------------------------------
// Dual-scheme resolution
// ---------------------------------------------------------------------

type ResolveResult =
  | {
      ok: true;
      res: Response;
      html: string;
      requestedUrl: string;
      finalUrl: string;
      hasHttps: boolean;
      schemeMismatch: boolean;
      retried: boolean;
      responseMs: number;
    }
  | { ok: false; reason: string; requestedUrl: string; retried: boolean };

async function fetchOnce(
  url: string,
  timeoutMs: number,
): Promise<{ res: Response; html: string; ms: number } | { error: string; aborted: boolean; ms: number }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
    });
    const html = await readBoundedText(res, MAX_HTML_READ);
    return { res, html, ms: Date.now() - start };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      error: aborted ? "Timeout" : err instanceof Error ? err.message : "Network error",
      aborted,
      ms: Date.now() - start,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Always tries https:// first — regardless of the scheme the URL was listed
 * under — then falls back to http:// only if https genuinely fails to connect.
 * `has_https` therefore reflects whether TLS actually served the page, not a
 * string check on the input. Retries each scheme once on a network error.
 */
export async function resolveAndFetch(rawHost: string): Promise<ResolveResult> {
  const cleaned = rawHost.replace(/^https?:\/\//i, "");
  const httpsUrl = `https://${cleaned}`;
  const httpUrl = `http://${cleaned}`;
  const listedHttp = /^http:\/\//i.test(rawHost);

  // Round 1
  const https1 = await fetchOnce(httpsUrl, PROBE_TIMEOUT_MS);
  if ("res" in https1) {
    return buildOk(https1, httpsUrl, true, listedHttp, false);
  }
  const http1 = await fetchOnce(httpUrl, PROBE_TIMEOUT_MS);
  if ("res" in http1) {
    // https failed but http served → genuinely no HTTPS (measured).
    return buildOk(http1, httpUrl, false, !listedHttp, false);
  }

  // Round 2 — retry once with a longer timeout before giving up.
  const https2 = await fetchOnce(httpsUrl, RETRY_TIMEOUT_MS);
  if ("res" in https2) {
    return buildOk(https2, httpsUrl, true, listedHttp, true);
  }
  const http2 = await fetchOnce(httpUrl, RETRY_TIMEOUT_MS);
  if ("res" in http2) {
    return buildOk(http2, httpUrl, false, !listedHttp, true);
  }

  return {
    ok: false,
    reason: http2.error || https2.error || "Unreachable",
    requestedUrl: httpsUrl,
    retried: true,
  };
}

function buildOk(
  r: { res: Response; html: string; ms: number },
  requestedUrl: string,
  hasHttps: boolean,
  schemeMismatch: boolean,
  retried: boolean,
): ResolveResult {
  return {
    ok: true,
    res: r.res,
    html: r.html,
    requestedUrl,
    finalUrl: r.res.url || requestedUrl,
    hasHttps,
    schemeMismatch,
    retried,
    responseMs: r.ms,
  };
}

// ---------------------------------------------------------------------
// Pure classifiers (network-free — unit-tested directly)
// ---------------------------------------------------------------------

/**
 * True when the response is a bot wall / WAF / challenge rather than the real
 * site. Such a response means "we couldn't look", not "the site is broken", so
 * it must never become a buy signal.
 */
export function detectBotBlock(status: number, headers: Headers, bodySnippet: string): boolean {
  if (status === 403 || status === 429 || status === 503) return true;
  const server = (headers.get("server") ?? "").toLowerCase();
  if (/cloudflare|akamai|imperva|incapsula|sucuri|ddos-guard/.test(server)) {
    // A challenge page from these — not the "Server:" header of a site merely
    // hosted behind them. Confirm with a body marker.
    if (/just a moment|__cf_chl|cf-browser-verification|captcha|attention required|ddos-guard|checking your browser/i.test(bodySnippet)) {
      return true;
    }
  }
  return /just a moment|__cf_chl|cf-browser-verification|captcha|attention required|ddos-guard|checking your browser/i.test(bodySnippet);
}

/**
 * True when the HTML is small but carries client-side framework markers — a
 * JS-rendered shell whose real content only appears after execution. Must NOT
 * be scored as a "tiny placeholder"; it needs a rendered crawl first.
 */
export function detectJsShell(html: string): boolean {
  if (html.length >= TINY_BODY_THRESHOLD) return false;
  return (
    html.includes("__NEXT_DATA__") ||
    html.includes("data-reactroot") ||
    /<div[^>]+id=["'](root|app|__next|__nuxt)["']/i.test(html) ||
    html.includes("ng-version") ||
    /<script[^>]+type=["']module["']/i.test(html) ||
    html.includes("/_next/static") ||
    html.includes("webpackJsonp") ||
    html.includes("__vite") ||
    /\/assets\/index-[\w]+\.js/i.test(html)
  );
}

// ---------------------------------------------------------------------
// Tech stack detection — single-pass regex over HTML
// ---------------------------------------------------------------------
export function detectTechStack(html: string, headers: Headers, hasHttps: boolean): TechStack {
  const lower = html.toLowerCase();
  const tech: TechStack = { ...EMPTY_TECH_STACK, analytics: [] };

  tech.has_https = hasHttps;

  // CMS detection
  if (lower.includes("/wp-content/") || lower.includes("/wp-includes/")) tech.cms = "wordpress";
  else if (lower.includes("wix.com") || lower.includes('content="wix.com')) tech.cms = "wix";
  else if (lower.includes("squarespace.com") || lower.includes("static.squarespace")) tech.cms = "squarespace";
  else if (lower.includes("webflow.com") || lower.includes("data-wf-")) tech.cms = "webflow";
  else if (lower.includes("cdn.shopify.com")) tech.cms = "shopify";
  else if (lower.includes("joomla!") || lower.includes("content=\"joomla")) tech.cms = "joomla";
  else if (lower.includes("drupal.settings") || lower.includes("/sites/default/files/")) tech.cms = "drupal";

  // Generator header / meta
  const generatorMeta = /<meta\s+name=["']generator["']\s+content=["']([^"']+)["']/i.exec(html);
  if (!tech.cms && generatorMeta) {
    const g = generatorMeta[1].toLowerCase();
    if (g.includes("wordpress")) tech.cms = "wordpress";
    else if (g.includes("wix")) tech.cms = "wix";
    else if (g.includes("squarespace")) tech.cms = "squarespace";
    else if (g.includes("webflow")) tech.cms = "webflow";
    else if (g.includes("shopify")) tech.cms = "shopify";
    else if (g.includes("drupal")) tech.cms = "drupal";
    else if (g.includes("joomla")) tech.cms = "joomla";
  }

  // Server / X-Powered-By hints
  const xPow = (headers.get("x-powered-by") ?? "").toLowerCase();
  if (!tech.cms && xPow.includes("wordpress")) tech.cms = "wordpress";

  // E-commerce
  if (lower.includes("cdn.shopify.com") || lower.includes("shopify.com/s/")) tech.ecommerce = "shopify";
  else if (lower.includes("woocommerce") || lower.includes("wc-block")) tech.ecommerce = "woocommerce";
  else if (lower.includes("unas.hu") || lower.includes("data-unas")) tech.ecommerce = "unas";
  else if (lower.includes("shoprenter")) tech.ecommerce = "shoprenter";
  else if (lower.includes("magento") || lower.includes("mage/cookies")) tech.ecommerce = "magento";

  // Analytics
  const analytics: TechStack["analytics"] = [];
  if (lower.includes("googletagmanager.com/gtm.js") || lower.includes("gtm-")) analytics.push("gtm");
  if (lower.includes("gtag(") || lower.includes("googletagmanager.com/gtag/js") || /google-analytics\.com\/g\//.test(lower)) {
    analytics.push("ga4");
  }
  if (lower.includes("connect.facebook.net") && lower.includes("fbq(")) analytics.push("meta_pixel");
  if (lower.includes("static.hotjar.com") || lower.includes("hjsv=")) analytics.push("hotjar");
  if (lower.includes("matomo.js") || lower.includes("_paq.push")) analytics.push("matomo");
  if (lower.includes("snap.licdn.com") || lower.includes("_linkedin_partner_id")) analytics.push("linkedin_insight");
  tech.analytics = Array.from(new Set(analytics));

  // Booking systems
  if (lower.includes("calendly.com")) tech.booking = "calendly";
  else if (lower.includes("simplybook.me") || lower.includes("simplybook.it")) tech.booking = "simplybook";
  else if (lower.includes("salonized") || lower.includes("salonkee")) tech.booking = "salonized";
  else if (lower.includes("booksy.com")) tech.booking = "booksy";
  else if (lower.includes("setmore.com")) tech.booking = "setmore";
  else if (lower.includes("tidycal.com")) tech.booking = "tidycal";

  // Has-blog: a link to /blog, /news, /cikkek, /posts
  tech.has_blog = /<a[^>]+href=["'][^"']*\/(blog|news|cikkek|posts|article|hirek)/i.test(html);

  // Schema.org structured data
  tech.has_schema_org = /application\/ld\+json/i.test(html) || /itemtype=["']https?:\/\/schema\.org/i.test(html);

  // Open Graph
  tech.has_open_graph = /<meta[^>]+property=["']og:(title|image|description)["']/i.test(html);

  // Viewport meta
  tech.has_viewport_meta = /<meta[^>]+name=["']viewport["']/i.test(html);

  // Contact form
  tech.has_contact_form = /<form[^>]*>/i.test(html);

  // We don't probe /sitemap.xml here (extra fetch). null = unknown.
  tech.has_sitemap = null;

  return tech;
}

// ---------------------------------------------------------------------
// Pain signal derivation
//
// Labels state ONLY what a single static fetch can support — no baked-in causal
// claims ("Google penalises", "invisible to AI search"). The pain-audit prompt
// and the human decide how to frame consequences, weighting by confidence.
// ---------------------------------------------------------------------
export function derivePainSignals(
  input: {
    health: WebsiteHealthStatus;
    tech: TechStack;
    bodyBytes: number;
    staleByDate: boolean;
    responseMs: number;
  },
  evidence: SignalEvidence,
): PainSignal[] {
  const signals: PainSignal[] = [];
  const push = (
    code: string,
    severity: PainSignal["severity"],
    label_hu: string,
    label_en: string,
    confidence: SignalConfidence,
  ) => signals.push({ code, severity, label_hu, label_en, confidence, evidence });

  // no_https is measured: https:// did not serve the page, http:// did.
  if (!input.tech.has_https) {
    push(
      "no_https",
      "high",
      "Nincs HTTPS titkosítás — a böngészők figyelmeztetést mutatnak",
      "No HTTPS — browsers warn visitors",
      "verified",
    );
  }

  // For a JS shell we can't trust any content-derived check — the real content
  // is rendered client-side. Only the measured no_https above is emitted.
  if (input.health === "js_shell") return signals;

  // A genuinely tiny static page: flag it, but leave the redundant "no X"
  // content signals off (there's simply nothing there yet).
  if (input.health === "tiny") {
    push(
      "tiny_page",
      "high",
      "Nagyon kevés tartalom a főoldalon (minimál/placeholder oldal)",
      "Very little content on the homepage (minimal/placeholder page)",
      "heuristic",
    );
    return signals;
  }

  if (input.staleByDate) {
    push(
      "stale_site",
      "medium",
      "A főoldalt a szerver szerint 3+ éve nem módosították",
      "Homepage not modified in 3+ years per the server",
      "heuristic",
    );
  }

  if (!input.tech.has_viewport_meta) {
    push(
      "no_mobile_viewport",
      "high",
      "Hiányzik a mobil viewport meta a főoldalon",
      "No mobile viewport meta on the homepage",
      "heuristic",
    );
  }

  if (input.tech.analytics.length === 0) {
    push(
      "no_analytics",
      "medium",
      "Nem találtunk analitikát a főoldal HTML-jében",
      "No analytics found in the homepage HTML",
      "heuristic",
    );
  } else if (!input.tech.analytics.includes("ga4") && !input.tech.analytics.includes("gtm")) {
    push(
      "no_ga4",
      "low",
      "Régi tracking, GA4/GTM nélkül a főoldalon",
      "Older tracking, no GA4/GTM on the homepage",
      "heuristic",
    );
  }

  if (!input.tech.has_schema_org) {
    push(
      "no_schema",
      "medium",
      "Nincs schema.org strukturált adat a főoldalon",
      "No schema.org structured data on the homepage",
      "heuristic",
    );
  }

  if (!input.tech.has_open_graph) {
    push(
      "no_open_graph",
      "low",
      "Nincs Open Graph meta — megosztáskor nincs kép/leírás",
      "No Open Graph meta — no image/description when shared",
      "heuristic",
    );
  }

  if (input.tech.cms === "wix" || input.tech.cms === "squarespace") {
    push(
      "drag_drop_cms",
      "low",
      `${input.tech.cms === "wix" ? "Wix" : "Squarespace"} platform`,
      `${input.tech.cms === "wix" ? "Wix" : "Squarespace"} platform`,
      "heuristic",
    );
  }

  if (input.responseMs > 5000) {
    push(
      "site_slow",
      "medium",
      `Lassú válaszidő a mérésnél (${(input.responseMs / 1000).toFixed(1)}s)`,
      `Slow response on our probe (${(input.responseMs / 1000).toFixed(1)}s)`,
      "heuristic",
    );
  }

  if (!input.tech.has_contact_form) {
    push(
      "no_contact_form",
      "low",
      "Nincs űrlap a főoldalon",
      "No form on the homepage",
      "heuristic",
    );
  }

  return signals;
}

// ---------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------

/**
 * Analyse a single URL. Never throws — failure modes return a result whose
 * health_status distinguishes "we couldn't look" (unreachable/blocked/unknown)
 * from a site that is genuinely bad.
 */
export async function analyzeSite(rawUrl: string | null | undefined): Promise<SiteAnalysis> {
  if (!rawUrl) {
    return {
      health_status: "no_website",
      health_details: { reason: "No URL provided" },
      tech_stack: null,
      pain_signals: [
        {
          code: "no_website",
          severity: "high",
          label_hu: "Nincs weboldal a Google Maps találatban",
          label_en: "No website listed on Google Maps",
          confidence: "verified",
        },
      ],
      contacts: null,
    };
  }

  const cleaned = rawUrl.trim().replace(/^https?:\/\//i, "");
  let parsed: URL;
  try {
    parsed = new URL(`https://${cleaned}`);
  } catch {
    return {
      health_status: "unknown",
      health_details: { reason: "Invalid URL", requested_url: rawUrl },
      tech_stack: null,
      pain_signals: [],
      contacts: null,
    };
  }

  // Short-circuit social profiles (the listed "website" is just a social page).
  if (SOCIAL_HOSTS.includes(parsed.hostname.toLowerCase())) {
    return {
      health_status: "redirect_social",
      health_details: { redirect_to: parsed.toString(), reason: "Social profile, no real site" },
      tech_stack: null,
      pain_signals: [
        {
          code: "social_only",
          severity: "high",
          label_hu: "Csak közösségi profil, nincs önálló weboldal",
          label_en: "Social profile only, no standalone website",
          confidence: "verified",
        },
      ],
      // The listed "website" IS the social profile — record it as a DM channel
      // rather than losing it, since these leads have no site to email about.
      contacts: { emails: [], phones: [], socials: socialFromUrl(parsed.toString()) },
    };
  }

  const resolved = await resolveAndFetch(rawUrl.trim());

  if (!resolved.ok) {
    // We could not reach the site on either scheme — we did NOT observe a
    // problem with their site, so emit zero pain signals and zero buy signal.
    return {
      health_status: "unreachable",
      health_details: {
        reason: resolved.reason,
        requested_url: resolved.requestedUrl,
        retried: resolved.retried,
      },
      tech_stack: null,
      pain_signals: [],
      contacts: null,
    };
  }

  const { res, html, requestedUrl, finalUrl, hasHttps, schemeMismatch, retried, responseMs } = resolved;
  const bodyBytes = html.length;
  const checkedAt = new Date().toISOString();

  const baseDetails: WebsiteHealthDetails = {
    http_status: res.status,
    response_ms: responseMs,
    body_size: bodyBytes,
    requested_url: requestedUrl,
    final_url: finalUrl,
    https_ok: hasHttps,
    scheme_mismatch: schemeMismatch,
    retried,
  };

  // Redirected to a social profile?
  try {
    const finalHost = new URL(finalUrl).hostname.toLowerCase();
    if (SOCIAL_HOSTS.includes(finalHost)) {
      return {
        health_status: "redirect_social",
        health_details: { ...baseDetails, redirect_to: finalUrl },
        tech_stack: null,
        pain_signals: [
          {
            code: "social_only",
            severity: "high",
            label_hu: "A weboldal közösségi profilra irányít át",
            label_en: "The website redirects to a social profile",
            confidence: "verified",
            evidence: {
              requested_url: requestedUrl,
              final_url: finalUrl,
              http_status: res.status,
              content_bytes: bodyBytes,
              checked_at: checkedAt,
              method: "static_probe",
            },
          },
        ],
        // Redirected to a social page — keep the profile as a DM channel.
        contacts: { emails: [], phones: [], socials: socialFromUrl(finalUrl) },
      };
    }
  } catch {
    /* ignore */
  }

  // Bot wall / WAF / challenge → we couldn't look. Zero pain signals.
  if (detectBotBlock(res.status, res.headers, html.slice(0, 4000))) {
    return {
      health_status: "blocked",
      health_details: { ...baseDetails, reason: `Blocked / challenge (HTTP ${res.status})` },
      tech_stack: null,
      pain_signals: [],
      contacts: null,
    };
  }

  // Genuine error (404/410/451/5xx) — a real, verifiable problem.
  if (res.status >= 400) {
    return {
      health_status: "broken",
      health_details: { ...baseDetails, reason: `HTTP ${res.status}` },
      tech_stack: null,
      pain_signals: [
        {
          code: "site_broken",
          severity: "high",
          label_hu: `A weboldal hibát ad vissza (HTTP ${res.status})`,
          label_en: `The website returns an error (HTTP ${res.status})`,
          confidence: "verified",
          evidence: {
            requested_url: requestedUrl,
            final_url: finalUrl,
            http_status: res.status,
            content_bytes: bodyBytes,
            checked_at: checkedAt,
            method: "static_probe",
          },
        },
      ],
      // An error page's contents are not the business's contact details.
      contacts: null,
    };
  }

  const lastModifiedHeader = res.headers.get("last-modified");
  let staleByDate = false;
  if (lastModifiedHeader) {
    const lm = new Date(lastModifiedHeader);
    if (!isNaN(lm.getTime())) {
      const ageDays = (Date.now() - lm.getTime()) / 86_400_000;
      if (ageDays > STALE_LAST_MODIFIED_DAYS) staleByDate = true;
    }
  }

  const tech = detectTechStack(html, res.headers, hasHttps);

  let health: WebsiteHealthStatus;
  if (detectJsShell(html)) health = "js_shell";
  else if (bodyBytes < TINY_BODY_THRESHOLD) health = "tiny";
  else if (staleByDate) health = "stale";
  else health = "healthy";

  const evidence: SignalEvidence = {
    requested_url: requestedUrl,
    final_url: finalUrl,
    http_status: res.status,
    content_bytes: bodyBytes,
    checked_at: checkedAt,
    method: "static_probe",
  };

  const pains = derivePainSignals(
    { health, tech, bodyBytes, staleByDate, responseMs },
    evidence,
  );

  return {
    health_status: health,
    health_details: { ...baseDetails, last_modified: lastModifiedHeader ?? undefined },
    tech_stack: tech,
    pain_signals: pains,
    // Free: this HTML is already in memory. `finalUrl` (post-redirect) is what
    // decides "own domain", so the ranking follows the site we actually read.
    contacts: extractContacts(html, finalUrl),
  };
}

async function readBoundedText(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) {
    // Some fetch mocks / responses expose text() but not a stream body.
    try {
      const t = await res.text();
      return t.slice(0, maxBytes);
    } catch {
      return "";
    }
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.length;
      }
    }
  } catch {
    /* ignore — partial body is acceptable */
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c.subarray(0, Math.min(c.length, maxBytes - offset)), offset);
    offset += c.length;
    if (offset >= maxBytes) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

/**
 * Parallel analyzer with concurrency cap.
 */
export async function analyzeMany(
  urls: (string | null | undefined)[],
  concurrency = 6,
): Promise<SiteAnalysis[]> {
  const results: SiteAnalysis[] = new Array(urls.length);
  let i = 0;
  const workers = new Array(Math.min(concurrency, urls.length || 1))
    .fill(0)
    .map(async () => {
      while (true) {
        const idx = i++;
        if (idx >= urls.length) return;
        results[idx] = await analyzeSite(urls[idx]);
      }
    });
  await Promise.all(workers);
  return results;
}
