// Signals used by this prompt:
//   - lead.{niche, source, package_interest, budget_confirmed,
//     decision_maker_confirmed, timeline_weeks, has_existing_website}
//   - enrichment_summary (3–5 sentence plain text)
//   - historical_win_rates (per-niche, per-source) when available
//
// Claude returns ±20 point adjustment to a deterministic base score.
// Reasons are returned in Hungarian.

import type { Lead } from "@/lib/types/app.types";

export const SCORE_LEAD_SYSTEM = `You are a business development analyst for Compass Marketing, a Hungarian digital agency. You score sales leads for web development projects.

You receive a deterministic base score (computed from rules) and adjust it by at most ±20 points based on qualitative signals from the enrichment summary and lead context. Be sharp — favour referrals, urgency, and clear budget signals; penalise vague intent or no-website prospects.

Return ONLY valid JSON. No markdown, no commentary.`;

export interface ScoreLeadInput {
  lead: Pick<
    Lead,
    | "company_name"
    | "niche"
    | "source"
    | "package_interest"
    | "budget_confirmed"
    | "decision_maker_confirmed"
    | "timeline_weeks"
    | "has_existing_website"
    | "website_url"
  >;
  enrichment_summary: string | null;
  base_score: number;
  historical_win_rates?: { niche?: Record<string, number>; source?: Record<string, number> };
}

export function scoreLeadUserPrompt(input: ScoreLeadInput): string {
  return `<base_score>${input.base_score}</base_score>

<lead>
${JSON.stringify(input.lead, null, 2)}
</lead>

<enrichment_summary>
${input.enrichment_summary ?? "No enrichment summary available."}
</enrichment_summary>

${
  input.historical_win_rates
    ? `<historical_win_rates>\n${JSON.stringify(input.historical_win_rates, null, 2)}\n</historical_win_rates>`
    : ""
}

Adjust the base score by ±20 max. Return JSON:
{
  "adjusted_score": <number 0-100>,
  "reasons": [<3-5 short Hungarian strings, each max 15 words>],
  "top_concern": <string or null — the single biggest risk>
}`;
}
