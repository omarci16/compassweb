// Win probability — deterministic rule-based base score, then an optional AI adjustment.
//
// Signals + weights:
//   budget_confirmed                          +25
//   decision_maker_confirmed                  +15
//   has_existing_website                      +10
//   timeline_weeks <= 4                       +10
//   timeline_weeks <= 2                       +5  (additional)
//   package_interest = "landing"              -5
//   source = "referral"                       +15
//   source = "instagram_dm"                   -10
//   niche has historical win rate > 60%       +10
//
// Base value: 30. Final = clamp(0, base + signals + ai_adjustment, 100).
//
// AI adjustment is bounded to ±20. The AI sees the enrichment summary
// and qualitative context the rules can't capture.

import type { Lead } from "@/lib/types/app.types";
import { clamp } from "@/lib/utils/format";

export interface WinProbabilityInput {
  lead: Pick<
    Lead,
    | "budget_confirmed"
    | "decision_maker_confirmed"
    | "has_existing_website"
    | "timeline_weeks"
    | "package_interest"
    | "source"
    | "niche"
  >;
  historical_niche_win_rates?: Record<string, number>;
}

export interface BaseScoreBreakdown {
  base: number;
  signals: { label: string; delta: number }[];
  total: number;
}

const BASE = 30;

export function computeBaseScore(input: WinProbabilityInput): BaseScoreBreakdown {
  const signals: { label: string; delta: number }[] = [];
  const { lead } = input;

  if (lead.budget_confirmed) signals.push({ label: "Budget confirmed", delta: 25 });
  if (lead.decision_maker_confirmed)
    signals.push({ label: "Decision maker confirmed", delta: 15 });
  if (lead.has_existing_website)
    signals.push({ label: "Has existing website", delta: 10 });

  if (lead.timeline_weeks != null) {
    if (lead.timeline_weeks <= 4) signals.push({ label: "Timeline ≤ 4 weeks", delta: 10 });
    if (lead.timeline_weeks <= 2) signals.push({ label: "Timeline ≤ 2 weeks", delta: 5 });
  }

  if (lead.package_interest === "landing")
    signals.push({ label: "Smallest package interest", delta: -5 });

  if (lead.source === "referral") signals.push({ label: "Referral source", delta: 15 });
  if (lead.source === "instagram_dm") signals.push({ label: "Cold IG DM source", delta: -10 });

  if (lead.niche && input.historical_niche_win_rates) {
    const rate = input.historical_niche_win_rates[lead.niche];
    if (rate != null && rate > 60)
      signals.push({ label: `Strong niche history (${Math.round(rate)}%)`, delta: 10 });
  }

  const delta = signals.reduce((s, x) => s + x.delta, 0);
  const total = clamp(BASE + delta, 0, 100);
  return { base: BASE, signals, total };
}

export interface CombineWithAiInput {
  baseScore: number;
  aiAdjustment: number;
}

export function combineWithAi({ baseScore, aiAdjustment }: CombineWithAiInput): number {
  const bounded = clamp(aiAdjustment, -20, 20);
  return clamp(baseScore + bounded, 0, 100);
}
