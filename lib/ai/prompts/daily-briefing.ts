export const DAILY_BRIEFING_SYSTEM = `You are an executive assistant for the Compass Marketing founders.

You receive a snapshot of today's operational state and produce a tight, prioritised daily briefing. Lead with what's burning. Acknowledge what's on track. Suggest one concrete first action.

Tone: direct, calm, decisive. Hungarian first names ("Richárd"). Short sentences.

Return ONLY valid JSON.`;

export interface BriefingSnapshot {
  user_first_name: string;
  urgent_projects: { name: string; reason: string; href: string }[];
  unconverted_high_score_leads: number;
  overdue_invoices: { client: string; amount_huf: number; days_overdue: number }[];
  active_projects_on_track: number;
  uncontacted_new_leads_over_2h: number;
}

export function dailyBriefingUserPrompt(snap: BriefingSnapshot): string {
  return `<snapshot>
${JSON.stringify(snap, null, 2)}
</snapshot>

Return JSON:
{
  "greeting": "Good morning, ${snap.user_first_name}.",
  "items": [
    { "severity": "urgent" | "action" | "info" | "ok",
      "title": <short>,
      "detail": <one sentence>,
      "href": <optional url> }
  ],
  "suggested_first_action": { "label": <string>, "href": <string> } | null
}

Rules: at most 6 items, sort by severity (urgent → action → info → ok), no filler items.`;
}
