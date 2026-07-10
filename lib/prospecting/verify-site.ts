// Verification layer (Lead Scraping 2.0, Phase 2).
//
// The static probe (site-analyzer.ts) is cheap but guesses about rendered
// content. Before any high-severity claim reaches a pain audit or a cold email,
// we confirm it against the RENDERED final URL:
//   - Google PageSpeed Insights (Lighthouse) gives ground truth on HTTPS,
//     mobile viewport, performance, and a homepage screenshot — free.
//   - An optional rendered Apify crawl (playwright:firefox) gives real content
//     so analytics/schema/OG signals can be measured, not guessed.
//
// mergeVerification is a PURE function (no I/O) so it is unit-tested directly.

import {
  detectJsShell,
  detectTechStack,
  derivePainSignals,
  TINY_BODY_THRESHOLD,
} from "@/lib/prospecting/site-analyzer";
import type {
  PainSignal,
  SignalEvidence,
  TechStack,
  WebsiteHealthStatus,
} from "@/lib/types/app.types";

export interface PsiResult {
  final_url: string;
  https_ok: boolean;
  viewport_ok: boolean;
  performance: number | null; // 0..1 Lighthouse performance score
  /** Base64 JPEG bytes (no `data:` prefix), or null if PSI didn't return one. */
  screenshot_base64: string | null;
}

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

/**
 * Runs Google PageSpeed Insights against a URL. Returns null on any failure —
 * a failed verification means "unknown", never a pain signal.
 */
export async function runPagespeed(url: string): Promise<PsiResult | null> {
  const params = new URLSearchParams({ url, strategy: "mobile" });
  for (const c of ["PERFORMANCE", "SEO", "BEST_PRACTICES"]) params.append("category", c);
  if (process.env.PAGESPEED_API_KEY) params.set("key", process.env.PAGESPEED_API_KEY);
  const endpoint = `${PSI_ENDPOINT}?${params.toString()}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(endpoint, { method: "GET" });
      if (res.status === 429 || res.status >= 500) {
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        return null;
      }
      if (!res.ok) return null;
      const data = (await res.json()) as PsiApiResponse;
      return parsePsi(data, url);
    } catch {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      return null;
    }
  }
  return null;
}

type PsiApiResponse = {
  lighthouseResult?: {
    finalDisplayedUrl?: string;
    finalUrl?: string;
    requestedUrl?: string;
    categories?: { performance?: { score?: number | null } };
    audits?: Record<string, { score?: number | null; details?: { data?: string } }>;
  };
};

function parsePsi(data: PsiApiResponse, requestedUrl: string): PsiResult | null {
  const lh = data.lighthouseResult;
  if (!lh) return null;
  const audits = lh.audits ?? {};
  const screenshot = audits["final-screenshot"]?.details?.data ?? null;
  return {
    final_url: lh.finalDisplayedUrl || lh.finalUrl || requestedUrl,
    https_ok: audits["is-on-https"]?.score === 1,
    viewport_ok: audits["viewport"]?.score === 1,
    performance: lh.categories?.performance?.score ?? null,
    // PSI returns `data:image/jpeg;base64,....` — strip the prefix.
    screenshot_base64: screenshot ? screenshot.replace(/^data:image\/\w+;base64,/, "") : null,
  };
}

export interface MergeInput {
  health_status: WebsiteHealthStatus;
  pain_signals: PainSignal[];
  tech_stack: TechStack | null;
  requested_url: string;
  final_url: string;
}

export interface MergeResult {
  health_status: WebsiteHealthStatus;
  pain_signals: PainSignal[];
  tech_stack: TechStack | null;
}

/**
 * Reconcile the static-probe result with verified ground truth.
 *
 *  - PSI confirms HTTPS / viewport / speed → drop those heuristic pains.
 *  - A rendered crawl gives real content → re-derive content signals as
 *    VERIFIED, and reclassify a js_shell / tiny page from what actually
 *    rendered.
 *
 * Pure: no network, deterministic given its inputs.
 */
export function mergeVerification(
  current: MergeInput,
  psi: PsiResult | null,
  renderedHtml?: string | null,
): MergeResult {
  const finalUrl = psi?.final_url || current.final_url;
  const checkedAt = new Date().toISOString();

  // --- Path A: we have rendered HTML → authoritative content analysis. ---
  if (renderedHtml && renderedHtml.trim().length > 0) {
    const hasHttps = psi?.https_ok ?? current.tech_stack?.has_https ?? true;
    const tech = detectTechStack(renderedHtml, new Headers(), hasHttps);
    const bodyBytes = renderedHtml.length;

    let health: WebsiteHealthStatus;
    if (bodyBytes < TINY_BODY_THRESHOLD && detectJsShell(renderedHtml)) {
      // Even the render is a shell — genuinely empty.
      health = "tiny";
    } else if (bodyBytes < TINY_BODY_THRESHOLD) {
      health = "tiny";
    } else {
      health = "healthy";
    }

    const evidence: SignalEvidence = {
      requested_url: current.requested_url,
      final_url: finalUrl,
      content_bytes: bodyBytes,
      checked_at: checkedAt,
      method: "rendered_crawl",
    };

    // Signals derived from RENDERED content are trustworthy → mark verified.
    let signals: PainSignal[] = derivePainSignals(
      { health, tech, bodyBytes, staleByDate: false, responseMs: 0 },
      evidence,
    ).map((s) => ({ ...s, confidence: "verified" as const }));

    signals = applyPsiOverrides(signals, tech, psi);
    return { health_status: health, pain_signals: signals, tech_stack: tech };
  }

  // --- Path B: PSI only. Drop what PSI contradicts; don't invent content. ---
  const tech = current.tech_stack ? { ...current.tech_stack } : null;
  if (psi?.https_ok && tech) tech.has_https = true;

  let health = current.health_status;
  // PSI successfully rendered and scored the page → it isn't a dead JS shell.
  if (psi && health === "js_shell") health = "healthy";

  const signals = applyPsiOverrides([...current.pain_signals], tech, psi);
  return { health_status: health, pain_signals: signals, tech_stack: tech };
}

/** Remove heuristic signals that verified PSI data contradicts. */
function applyPsiOverrides(
  signals: PainSignal[],
  _tech: TechStack | null,
  psi: PsiResult | null,
): PainSignal[] {
  if (!psi) return signals;
  return signals.filter((s) => {
    if (psi.https_ok && s.code === "no_https") return false;
    if (psi.viewport_ok && s.code === "no_mobile_viewport") return false;
    // A decent Lighthouse performance score refutes our single cold-fetch guess.
    if (psi.performance != null && psi.performance >= 0.5 && s.code === "site_slow") return false;
    return true;
  });
}
