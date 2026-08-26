// Offer routing (Scraping 2.1, Phase C).
//
// 2.0 proved ~81% of scraped leads already have a working site — so a single
// "here's a new website" pitch misses most of the list. deriveOfferTrack splits
// leads into the pitch each one should actually get:
//
//   needs_site   — no usable site → the classic concept-mockup pitch
//   upgrade      — working site + a concrete, groundable hook → "convert more" pitch
//   low_priority — healthy, strong, nothing to say (yet) → don't spend a touch
//
// Pure + deterministic, so it's unit-tested directly and reused at import time
// (static signals) and after verification (rendered-truth signals).

import type {
  OfferTrack,
  PainSignal,
  TechStack,
  WebsiteHealthStatus,
} from "@/lib/types/app.types";

export interface OfferTrackInput {
  website_url: string | null;
  website_health: WebsiteHealthStatus | null;
  pain_signals?: PainSignal[];
  tech_stack?: TechStack | null;
  /** From ads_signal — a business that already buys ads will pay to convert better. */
  runs_ads?: boolean;
}

// Health statuses that mean "there is no usable site to point at".
const NEEDS_SITE_HEALTH: WebsiteHealthStatus[] = [
  "no_website",
  "broken",
  "redirect_social",
  "tiny",
];

// Pain codes that give a healthy site a concrete, honest upgrade hook.
const UPGRADE_HOOK_CODES = new Set([
  "stale_site",
  "drag_drop_cms",
  "no_analytics",
  "no_schema",
  "site_slow",
  "no_mobile_viewport",
  "no_https",
]);

/**
 * Route a lead to the pitch it should get. Runs on static signals at import,
 * then again on verified signals after the site check.
 */
export function deriveOfferTrack(input: OfferTrackInput): OfferTrack {
  const health = input.website_health;

  // 1. No usable site → the concept pitch.
  if (!input.website_url || (health && NEEDS_SITE_HEALTH.includes(health))) {
    return "needs_site";
  }

  // 2. We can only sell an "upgrade" if we can actually see the site. A wall /
  //    timeout / JS shell / not-yet-probed status gives us no honest hook.
  if (
    health === "blocked" ||
    health === "unreachable" ||
    health === "js_shell" ||
    health === "unknown" ||
    health == null
  ) {
    return "low_priority";
  }

  // 3. Healthy or stale site: upgrade only if there's a real hook to ground it.
  if (health === "stale") return "upgrade";
  if (input.runs_ads) return "upgrade";
  const hasHook = (input.pain_signals ?? []).some((p) => UPGRADE_HOOK_CODES.has(p.code));
  if (hasHook) return "upgrade";

  // 4. Healthy, strong, nothing to say → don't waste a touch.
  return "low_priority";
}

/**
 * Heuristic "newly opened business" flag from Google Maps review velocity:
 * very few reviews but already a solid rating ≈ just getting started (good
 * timing — they're forming their web presence now).
 */
export function isRecentlyOpened(
  rating: number | null | undefined,
  reviewCount: number | null | undefined,
): boolean {
  if (reviewCount == null || reviewCount <= 0 || reviewCount > 5) return false;
  return rating != null && rating >= 4.3;
}
