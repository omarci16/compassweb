// Website health probe — lightweight HTTP check, no Apify cost.
//
// Classifies a website into a status that drives lead scoring:
//   healthy          → modern, working site (lower buy signal)
//   broken           → 4xx/5xx/timeout (HIGH buy signal — needs us)
//   redirect_social  → "website" is actually Instagram/Facebook (HIGH signal)
//   tiny             → very small page, likely placeholder (medium-high)
//   stale            → last-modified > 3 years old (medium)
//   no_website       → no URL on Google Maps at all (highest signal)
//   unknown          → probe failed in a way we can't classify
//
// All checks short-circuit on timeout so a bulk run can't hang.

import type {
  WebsiteHealthDetails,
  WebsiteHealthStatus,
} from "@/lib/types/app.types";

const PROBE_TIMEOUT_MS = 8000;
const TINY_BODY_THRESHOLD = 5000;            // <5 KB = probably placeholder
const STALE_LAST_MODIFIED_DAYS = 365 * 3;    // >3 yrs since last update

const SOCIAL_HOSTS = [
  "instagram.com",
  "www.instagram.com",
  "facebook.com",
  "www.facebook.com",
  "fb.com",
  "m.facebook.com",
  "linkedin.com",
  "www.linkedin.com",
  "tiktok.com",
  "www.tiktok.com",
];

export interface ProbeResult {
  status: WebsiteHealthStatus;
  details: WebsiteHealthDetails;
}

/**
 * Probe a single URL. Never throws — failures are returned as 'broken' or 'unknown'.
 *
 * The probe uses GET (not HEAD) because many small business sites return
 * 405/200 mismatches on HEAD. We read a small slice of the body to size-classify.
 */
export async function probeWebsite(rawUrl: string | null | undefined): Promise<ProbeResult> {
  if (!rawUrl) {
    return { status: "no_website", details: { reason: "No URL provided" } };
  }

  // Normalise URL — if scheme missing, assume https
  let url: URL;
  try {
    url = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  } catch {
    return { status: "unknown", details: { reason: "Invalid URL" } };
  }

  // Short-circuit: if Google Maps gave us a social-media URL as the "website"
  if (SOCIAL_HOSTS.includes(url.hostname.toLowerCase())) {
    return {
      status: "redirect_social",
      details: { redirect_to: url.toString(), reason: "Social profile, no real site" },
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
        // Some sites return 403 to default fetch UA
        "user-agent":
          "Mozilla/5.0 (compatible; CompassBot/1.0; +https://compassmarketing.hu)",
      },
    });
    const elapsed = Date.now() - start;

    // If the final URL after redirects lands on a social host → redirect_social
    try {
      const finalHost = new URL(res.url).hostname.toLowerCase();
      if (SOCIAL_HOSTS.includes(finalHost)) {
        return {
          status: "redirect_social",
          details: {
            http_status: res.status,
            response_ms: elapsed,
            redirect_to: res.url,
          },
        };
      }
    } catch {
      /* ignore */
    }

    // 4xx/5xx → broken
    if (res.status >= 400) {
      return {
        status: "broken",
        details: {
          http_status: res.status,
          response_ms: elapsed,
          reason: `HTTP ${res.status}`,
        },
      };
    }

    // Read up to 64KB of body to size-classify
    const reader = res.body?.getReader();
    let bodyBytes = 0;
    let bytesRead = 0;
    const MAX_READ = 65536;
    if (reader) {
      try {
        while (bytesRead < MAX_READ) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            bytesRead += value.length;
            bodyBytes += value.length;
          }
        }
      } catch {
        /* ignore — partial body is fine */
      } finally {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
      }
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

    if (bodyBytes < TINY_BODY_THRESHOLD) {
      return {
        status: "tiny",
        details: {
          http_status: res.status,
          response_ms: elapsed,
          body_size: bodyBytes,
          last_modified: lastModifiedHeader ?? undefined,
          reason: "Very small page, likely placeholder",
        },
      };
    }

    if (staleByDate) {
      return {
        status: "stale",
        details: {
          http_status: res.status,
          response_ms: elapsed,
          body_size: bodyBytes,
          last_modified: lastModifiedHeader ?? undefined,
        },
      };
    }

    return {
      status: "healthy",
      details: {
        http_status: res.status,
        response_ms: elapsed,
        body_size: bodyBytes,
        last_modified: lastModifiedHeader ?? undefined,
      },
    };
  } catch (err) {
    // Aborted → timeout; network error → broken
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      status: "broken",
      details: {
        response_ms: Date.now() - start,
        reason: aborted ? "Timeout" : err instanceof Error ? err.message : "Network error",
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Probe many URLs with limited concurrency.
 * Defaults to 8 in flight — Node can comfortably do more but small business
 * sites are sometimes shared-hosted and we don't want to look hostile.
 */
export async function probeMany(
  urls: (string | null | undefined)[],
  concurrency = 8,
): Promise<ProbeResult[]> {
  const results: ProbeResult[] = new Array(urls.length);
  let i = 0;
  const workers = new Array(Math.min(concurrency, urls.length)).fill(0).map(async () => {
    while (true) {
      const idx = i++;
      if (idx >= urls.length) return;
      results[idx] = await probeWebsite(urls[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}
