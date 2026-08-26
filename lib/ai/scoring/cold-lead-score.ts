// Cold lead scoring — deterministic, runs on every scraped lead in bulk.
// No AI involved at this stage. The output feeds straight into leads.win_probability
// at import time, so the dashboard immediately shows scraped leads sorted by quality.
//
// Signals are tuned for the buying-signal hierarchy:
//   1. No website on Google Maps                → strongest signal (clear need)
//   2. Site exists but broken                   → very strong (frustrated owner)
//   3. Site redirects to social (Facebook/IG)   → strong (no real site)
//   4. Tiny placeholder page                    → strong
//   5. Site exists, modern, healthy             → weakest (less to sell)
//   6. Niche match + good rating + right size   → modifiers
//
// Final score is clamped 0–100. We deliberately bias *up* because the volume
// of leads is high and we want the leads list to surface the best ones first.

import type {
  PainSignal,
  ProspectingNiche,
  WebsiteHealthStatus,
} from "@/lib/types/app.types";
import { clamp } from "@/lib/utils/format";

export interface ColdLeadInput {
  niche: ProspectingNiche;
  gmaps_rating: number | null;
  gmaps_review_count: number | null;
  website_url: string | null;
  website_health: WebsiteHealthStatus | null;
  social_links_count: number;
  has_email: boolean;
  has_phone: boolean;
  /** Pain signals from site-analyzer. Each high-severity signal adds to score. */
  pain_signals?: PainSignal[];
  historical_niche_win_rates?: Record<string, number>;
  /**
   * True once the site was checked against rendered ground truth (PSI / crawl).
   * A lead with a live website that has NOT been verified is capped below the
   * top tier — a heuristic static probe alone must not create a top-tier lead
   * (this is what let windingatlan.hu score as top on false signals).
   */
  website_verified?: boolean;
  /** Runs paid ads (Meta Ad Library) — has budget + growth intent. */
  runs_ads?: boolean;
  /** Newly opened business (review-velocity heuristic) — good timing. */
  recently_opened?: boolean;
}

export interface ColdScoreBreakdown {
  base: number;
  signals: { label: string; delta: number }[];
  total: number;
  tier: "top" | "high" | "medium" | "low";
}

const BASE = 30;
const TOP_THRESHOLD = 70;
const HIGH_THRESHOLD = 55;
const MEDIUM_THRESHOLD = 40;

/**
 * Niches with proven historical conversion get a small boost.
 * These come from CLAUDE.md's stated niche focus.
 */
const HIGH_VALUE_NICHES: Record<ProspectingNiche, number> = {
  beauty: 10,
  dental: 12,
  real_estate: 8,
  fitness: 10,
  // Legal (ügyvédek): high budget + strong professional-image need — closes like dental.
  legal: 12,
  // Hospitality (éttermek/kávézók): high volume, thinner budgets — a moderate boost.
  hospitality: 6,
  other: 0,
};

export function scoreColdLead(input: ColdLeadInput): ColdScoreBreakdown {
  const signals: { label: string; delta: number }[] = [];

  // ----- Website signals (the dominant axis) -----
  // No website at all — the cleanest possible buy signal.
  if (!input.website_url || input.website_health === "no_website") {
    signals.push({ label: "No website listed", delta: 40 });
  } else {
    // We have a URL — quality matters.
    switch (input.website_health) {
      case "broken":
        signals.push({ label: "Website broken / unreachable", delta: 32 });
        break;
      case "redirect_social":
        signals.push({ label: "Only a social profile, no site", delta: 28 });
        break;
      case "tiny":
        signals.push({ label: "Tiny placeholder page", delta: 22 });
        break;
      case "stale":
        signals.push({ label: "Site not updated in 3+ years", delta: 15 });
        break;
      case "healthy":
        // Healthy site = less need. We still score on other signals.
        signals.push({ label: "Has a working website", delta: -5 });
        break;
      case "blocked":
      case "unreachable":
      case "js_shell":
      case "unknown":
      case null:
      default:
        // "We couldn't look" (bot wall, timeout, JS shell) or not probed yet.
        // These must contribute ZERO — never a buy signal — until verified.
        break;
    }
  }

  // ----- Niche match -----
  const nicheBoost = HIGH_VALUE_NICHES[input.niche] ?? 0;
  if (nicheBoost > 0) {
    signals.push({ label: `High-value niche (${input.niche})`, delta: nicheBoost });
  }

  // Historical win-rate override (if we have data)
  if (input.historical_niche_win_rates?.[input.niche] !== undefined) {
    const rate = input.historical_niche_win_rates[input.niche];
    if (rate > 60) {
      signals.push({ label: `Strong win history (${Math.round(rate)}%)`, delta: 8 });
    } else if (rate < 20) {
      signals.push({ label: `Weak win history (${Math.round(rate)}%)`, delta: -8 });
    }
  }

  // ----- Size / quality of the business (rating, reviews) -----
  // Rating 4.0+ = established, takes itself seriously
  if (input.gmaps_rating != null && input.gmaps_rating >= 4.0) {
    signals.push({ label: `Strong rating (${input.gmaps_rating.toFixed(1)}★)`, delta: 8 });
  }

  // Review count: 10–200 is the sweet spot.
  // Too few = brand new, might not have budget. Too many = enterprise, harder sell.
  if (input.gmaps_review_count != null) {
    const rc = input.gmaps_review_count;
    if (rc >= 10 && rc <= 200) {
      signals.push({ label: "Established (10–200 reviews)", delta: 8 });
    } else if (rc > 200 && rc <= 1000) {
      signals.push({ label: "Large business", delta: 4 });
    } else if (rc > 1000) {
      signals.push({ label: "Likely enterprise — harder sell", delta: -5 });
    } else if (rc < 3) {
      signals.push({ label: "Very new / unverified", delta: -8 });
    }
  }

  // ----- Contactability (small bonuses) -----
  if (input.has_email) signals.push({ label: "Email available", delta: 4 });
  if (input.has_phone) signals.push({ label: "Phone available", delta: 2 });
  if (input.social_links_count >= 2) {
    signals.push({ label: "Active on social", delta: 3 });
  }

  // ----- Buying-intent signals (Scraping 2.1) -----
  // Already spends on ads → has a marketing budget and wants growth.
  if (input.runs_ads) {
    signals.push({ label: "Runs paid ads — has budget", delta: 10 });
  }
  // Newly opened → forming their web presence now; good timing to reach out.
  if (input.recently_opened) {
    signals.push({ label: "Recently opened — good timing", delta: 5 });
  }

  // ----- Pain signals: each detected pain is a buying trigger -----
  // We cap the total contribution so a single broken site doesn't dominate
  // — many small pains > one big one is the kind of insight that closes deals.
  if (input.pain_signals && input.pain_signals.length > 0) {
    // Dedupe vs. signals that already fired above via website_health
    // (no_website, broken, redirect_social, tiny, stale). We don't want to
    // double-count the same finding under two names.
    const websiteHealthCovered = new Set([
      "no_website",
      "site_broken",
      "social_only",
      "tiny_page",
      "stale_site",
    ]);
    let painContribution = 0;
    let painCount = 0;
    for (const p of input.pain_signals) {
      if (websiteHealthCovered.has(p.code)) continue;
      const weight = p.severity === "high" ? 5 : p.severity === "medium" ? 3 : 1;
      painContribution += weight;
      painCount += 1;
    }
    if (painContribution > 0) {
      // Cap pain contribution at +25 so it amplifies but doesn't dominate
      const capped = Math.min(25, painContribution);
      signals.push({
        label: `${painCount} pain signal${painCount === 1 ? "" : "s"} detected`,
        delta: capped,
      });
    }
  }

  const delta = signals.reduce((s, x) => s + x.delta, 0);
  let total = clamp(BASE + delta, 0, 100);

  // Top-tier gate: a live website we haven't verified against rendered ground
  // truth can't earn top tier on heuristic signals alone. `no_website` and
  // `redirect_social` are exempt — there is no live site to render.
  const exemptFromVerification =
    !input.website_url ||
    input.website_health === "no_website" ||
    input.website_health === "redirect_social";
  if (!input.website_verified && !exemptFromVerification && total >= TOP_THRESHOLD) {
    total = TOP_THRESHOLD - 1;
    signals.push({ label: "Unverified website — capped below top tier", delta: 0 });
  }

  const tier: ColdScoreBreakdown["tier"] =
    total >= TOP_THRESHOLD
      ? "top"
      : total >= HIGH_THRESHOLD
        ? "high"
        : total >= MEDIUM_THRESHOLD
          ? "medium"
          : "low";

  return { base: BASE, signals, total, tier };
}

export { TOP_THRESHOLD, HIGH_THRESHOLD, MEDIUM_THRESHOLD };
