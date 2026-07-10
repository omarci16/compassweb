// AI prompt: convert detected pain signals + business context into a
// short, specific, Hungarian "what you're losing right now" audit paragraph.
//
// The audit is the hook for cold outreach, so it MUST be grounded: it may state
// verified findings as facts, must soften or omit merely heuristic ones, and
// must never invent a problem the signals don't support. A confidently-wrong
// audit (e.g. "no HTTPS, mobile-unreadable" on a site that is actually fine)
// is worse than no audit — it burns the lead and the sender's reputation.

import type {
  PainSignal,
  ProspectingNiche,
  WebsiteHealthStatus,
} from "@/lib/types/app.types";

export const PAIN_AUDIT_SYSTEM = `You are a sales analyst for Compass Marketing Kft., a Hungarian digital agency.

You write a brief audit paragraph in HUNGARIAN that a salesperson will paste into a cold outreach email.

GROUNDING RULES (non-negotiable — a wrong claim burns the lead):
1. Each signal is tagged [verified] or [heuristic].
   - [verified] findings were measured against the real site — you may state them as facts.
   - [heuristic] findings are guesses from a single static-HTML fetch and are often wrong on modern sites — either soften them ("a főoldal alapján úgy tűnik…", "elképzelhető, hogy…") or leave them out. NEVER assert a heuristic finding as a measured fact.
2. Mention ONLY problems present in the signal list. Never invent issues and never extrapolate a consequence the signal doesn't state (e.g. "no analytics tag found" is NOT "they measure nothing").
3. Refer to the exact URL that was inspected when it's natural to.
4. If there are fewer than 2 usable signals, do NOT manufacture pains — write ONE honest sentence saying the site looks solid / there isn't enough to go on, and stop.

STYLE:
- 3 to 5 sentences (or a single sentence per rule 4). No bullet points, no headers, no greeting, no CTA.
- Business framing (lost customers, lost enquiries, visibility), not technical jargon.
- Formal "Önök" / "Ön". Avoid marketing buzzwords and English loan words where Hungarian works.

Return ONLY the audit paragraph — no JSON, no labels, no markdown.`;

export interface PainAuditInput {
  company_name: string;
  niche: ProspectingNiche;
  website_url: string | null;
  final_url?: string | null;
  health_status?: WebsiteHealthStatus | null;
  enrichment_summary: string | null;
  pain_signals: PainSignal[];
  gmaps_rating: number | null;
  gmaps_review_count: number | null;
}

export function painAuditUserPrompt(input: PainAuditInput): string {
  const painList = input.pain_signals.length === 0
    ? "(no specific signals detected)"
    : input.pain_signals
        .map((p) => `- [${p.severity}][${p.confidence ?? "heuristic"}] ${p.label_hu} (${p.code})`)
        .join("\n");

  const ratingLine =
    input.gmaps_rating != null
      ? `Google Maps értékelés: ${input.gmaps_rating.toFixed(1)}★ (${input.gmaps_review_count ?? 0} értékelés)`
      : "Google Maps értékelés: nincs adat";

  const inspectedUrl = input.final_url || input.website_url || "—";

  return `<business>
Company: ${input.company_name}
Niche: ${input.niche}
Website (listed): ${input.website_url ?? "—"}
Website (actually inspected): ${inspectedUrl}
Site status: ${input.health_status ?? "unknown"}
${ratingLine}
</business>

<enrichment_summary>
${input.enrichment_summary ?? "(no enrichment summary)"}
</enrichment_summary>

<detected_pain_signals>
${painList}
</detected_pain_signals>

Write the audit paragraph (Hungarian) following the grounding rules exactly.`;
}
