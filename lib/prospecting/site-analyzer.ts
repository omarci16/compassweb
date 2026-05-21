// Site analyzer — one HTTP fetch yields: health + tech stack + pain signals.
//
// Why one function: every additional fetch costs latency & politeness.
// We do a single GET, read up to 200KB of HTML, then regex-extract everything.
// Hostile-domain protection: timeouts, body size caps, no JS execution.
//
// This is the moat layer. Cheap signal extraction at scale beats expensive
// per-lead AI analysis for the bulk discovery flow.

import type {
  PainSignal,
  TechStack,
  WebsiteHealthDetails,
  WebsiteHealthStatus,
} from "@/lib/types/app.types";

const PROBE_TIMEOUT_MS = 9000;
const TINY_BODY_THRESHOLD = 5000;
const STALE_LAST_MODIFIED_DAYS = 365 * 3;
const MAX_HTML_READ = 200_000;

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

/**
 * Analyse a single URL. Never throws — failure modes return a result with
 * health_status set to 'broken' or 'unknown' and null tech_stack.
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
          label_hu: "Nincs weboldal — láthatatlan a Google-ban",
          label_en: "No website — invisible on Google",
        },
      ],
    };
  }

  let url: URL;
  try {
    url = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  } catch {
    return {
      health_status: "unknown",
      health_details: { reason: "Invalid URL" },
      tech_stack: null,
      pain_signals: [],
    };
  }

  // Short-circuit social profiles
  if (SOCIAL_HOSTS.includes(url.hostname.toLowerCase())) {
    return {
      health_status: "redirect_social",
      health_details: { redirect_to: url.toString(), reason: "Social profile, no real site" },
      tech_stack: null,
      pain_signals: [
        {
          code: "social_only",
          severity: "high",
          label_hu: "Csak közösségi profil, nincs igazi weboldal",
          label_en: "Social profile only, no real website",
        },
      ],
    };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  const start = Date.now();

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; CompassBot/1.0; +https://compassmarketing.hu)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    const elapsed = Date.now() - start;

    // Redirected to social? Treat as redirect_social.
    try {
      const finalHost = new URL(res.url).hostname.toLowerCase();
      if (SOCIAL_HOSTS.includes(finalHost)) {
        return {
          health_status: "redirect_social",
          health_details: {
            http_status: res.status,
            response_ms: elapsed,
            redirect_to: res.url,
          },
          tech_stack: null,
          pain_signals: [
            {
              code: "social_only",
              severity: "high",
              label_hu: "A weboldal social profilra irányít",
              label_en: "Website redirects to social profile",
            },
          ],
        };
      }
    } catch {
      /* ignore */
    }

    if (res.status >= 400) {
      return {
        health_status: "broken",
        health_details: {
          http_status: res.status,
          response_ms: elapsed,
          reason: `HTTP ${res.status}`,
        },
        tech_stack: null,
        pain_signals: [
          {
            code: "site_broken",
            severity: "high",
            label_hu: `Weboldal hibás (HTTP ${res.status})`,
            label_en: `Website broken (HTTP ${res.status})`,
          },
        ],
      };
    }

    // Read HTML up to MAX_HTML_READ
    const html = await readBoundedText(res, MAX_HTML_READ);
    const bodyBytes = html.length;
    const lastModifiedHeader = res.headers.get("last-modified");

    let staleByDate = false;
    if (lastModifiedHeader) {
      const lm = new Date(lastModifiedHeader);
      if (!isNaN(lm.getTime())) {
        const ageDays = (Date.now() - lm.getTime()) / 86_400_000;
        if (ageDays > STALE_LAST_MODIFIED_DAYS) staleByDate = true;
      }
    }

    const tech = detectTechStack(html, res, url);
    const pains = derivePainSignals({
      tech,
      bodyBytes,
      staleByDate,
      responseMs: elapsed,
    });

    let healthStatus: WebsiteHealthStatus = "healthy";
    if (bodyBytes < TINY_BODY_THRESHOLD) healthStatus = "tiny";
    else if (staleByDate) healthStatus = "stale";

    return {
      health_status: healthStatus,
      health_details: {
        http_status: res.status,
        response_ms: elapsed,
        body_size: bodyBytes,
        last_modified: lastModifiedHeader ?? undefined,
      },
      tech_stack: tech,
      pain_signals: pains,
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      health_status: "broken",
      health_details: {
        response_ms: Date.now() - start,
        reason: aborted ? "Timeout" : err instanceof Error ? err.message : "Network error",
      },
      tech_stack: null,
      pain_signals: [
        {
          code: aborted ? "site_slow" : "site_broken",
          severity: "high",
          label_hu: aborted
            ? "A weboldal nagyon lassú vagy nem válaszol"
            : "Weboldal nem elérhető",
          label_en: aborted ? "Website very slow or unresponsive" : "Website unreachable",
        },
      ],
    };
  } finally {
    clearTimeout(timer);
  }
}

async function readBoundedText(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
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
  // Concatenate then decode
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c.subarray(0, Math.min(c.length, maxBytes - offset)), offset);
    offset += c.length;
    if (offset >= maxBytes) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

// ---------------------------------------------------------------------
// Tech stack detection — single-pass regex over HTML
// ---------------------------------------------------------------------
function detectTechStack(html: string, res: Response, url: URL): TechStack {
  const lower = html.toLowerCase();
  const headers = res.headers;
  const tech: TechStack = { ...EMPTY_TECH_STACK, analytics: [] };

  tech.has_https = url.protocol === "https:";

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
// Each signal is a concrete, sales-relevant finding that we can pitch on.
// ---------------------------------------------------------------------
function derivePainSignals({
  tech,
  bodyBytes,
  staleByDate,
  responseMs,
}: {
  tech: TechStack;
  bodyBytes: number;
  staleByDate: boolean;
  responseMs: number;
}): PainSignal[] {
  const signals: PainSignal[] = [];

  if (bodyBytes < TINY_BODY_THRESHOLD) {
    signals.push({
      code: "tiny_page",
      severity: "high",
      label_hu: "Mini placeholder oldal, alig van tartalom",
      label_en: "Tiny placeholder page, almost no content",
    });
  }

  if (staleByDate) {
    signals.push({
      code: "stale_site",
      severity: "medium",
      label_hu: "A weboldalt 3+ éve nem frissítették",
      label_en: "Website not updated in 3+ years",
    });
  }

  if (!tech.has_https) {
    signals.push({
      code: "no_https",
      severity: "high",
      label_hu: "Nincs HTTPS — Google büntet, böngészők figyelmeztetnek",
      label_en: "No HTTPS — Google penalises, browsers warn users",
    });
  }

  if (!tech.has_viewport_meta) {
    signals.push({
      code: "no_mobile_viewport",
      severity: "high",
      label_hu: "Hiányzik a mobil viewport — telefonon olvashatatlan",
      label_en: "No mobile viewport — unreadable on phones",
    });
  }

  if (tech.analytics.length === 0) {
    signals.push({
      code: "no_analytics",
      severity: "high",
      label_hu: "Nincs analitika — nem méri, honnan jönnek a látogatók",
      label_en: "No analytics — they cannot measure traffic",
    });
  } else if (!tech.analytics.includes("ga4") && !tech.analytics.includes("gtm")) {
    signals.push({
      code: "no_ga4",
      severity: "medium",
      label_hu: "Régi tracking, GA4 nélkül — hiányos adatok",
      label_en: "Old tracking, no GA4 — incomplete data",
    });
  }

  if (!tech.has_schema_org) {
    signals.push({
      code: "no_schema",
      severity: "high",
      label_hu: "Nincs schema.org strukturált adat — AI keresőkben láthatatlan",
      label_en: "No schema.org structured data — invisible to AI search",
    });
  }

  if (!tech.has_open_graph) {
    signals.push({
      code: "no_open_graph",
      severity: "medium",
      label_hu: "Nincs Open Graph — link megosztáskor nem jelenik meg kép",
      label_en: "No Open Graph — link previews look broken",
    });
  }

  if (tech.cms === "wix" || tech.cms === "squarespace") {
    signals.push({
      code: "drag_drop_cms",
      severity: "medium",
      label_hu: `${tech.cms === "wix" ? "Wix" : "Squarespace"} platform — limitált SEO és sebesség`,
      label_en: `${tech.cms === "wix" ? "Wix" : "Squarespace"} platform — limited SEO and speed`,
    });
  }

  if (!tech.booking && !tech.ecommerce) {
    // Only flag if it's clearly a service business with no booking
    // (we can't reliably detect this without context — leave the AI to decide)
  }

  if (responseMs > 5000) {
    signals.push({
      code: "site_slow",
      severity: "high",
      label_hu: `Lassú oldal (${(responseMs / 1000).toFixed(1)}s) — látogatók elhagyják`,
      label_en: `Slow site (${(responseMs / 1000).toFixed(1)}s) — visitors bounce`,
    });
  }

  if (!tech.has_contact_form) {
    signals.push({
      code: "no_contact_form",
      severity: "medium",
      label_hu: "Nincs kapcsolatfelvételi űrlap — leadek elvesznek",
      label_en: "No contact form — leads slip away",
    });
  }

  return signals;
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
