// AI prompt: convert detected pain signals + business context into a
// short, specific, Hungarian "what you're losing right now" audit paragraph.
//
// The audit is the hook for cold outreach. It must be:
//   - SPECIFIC (cite the actual problem, not generic claims)
//   - FACTUAL (only state what the signals support — never invent)
//   - BUSINESS-FRAMED (talk about lost revenue / customers / visibility,
//     not technical jargon the owner doesn't care about)
//
// We give Claude the niche, the company name, the detected pain signals,
// and any enrichment summary. We ask for plain text — no JSON, no markdown.

import type { PainSignal, ProspectingNiche } from "@/lib/types/app.types";

export const PAIN_AUDIT_SYSTEM = `You are a sales analyst for Compass Marketing Kft., a Hungarian digital agency.

You write a brief audit paragraph in HUNGARIAN that a salesperson will paste into a cold outreach email. The audit must:

1. Cite ONLY the specific problems supported by the provided signals — never invent issues.
2. Frame each problem in business terms (lost customers, lost revenue, invisibility on Google), not technical jargon.
3. Be 3 to 5 sentences total. No bullet points, no headers, no greeting.
4. Sound like a peer who took the time to look at their business — not a templated cold email.
5. End with a single concrete observation about what the company could gain, NOT a sales pitch or CTA.

Hungarian style notes:
- Use formal "Önök" / "Ön" if addressing the business owner.
- Specific Hungarian terms: weboldal (website), foglalás (booking), elérhetőség (reach), megjelenés (visibility), átkattintási arány (CTR).
- Avoid: marketing buzzwords ("brand", "engagement", "konverzió"), AI-themed corporate-speak, and English loan words where Hungarian works.

Return ONLY the audit paragraph — no JSON, no labels, no markdown.`;

export interface PainAuditInput {
  company_name: string;
  niche: ProspectingNiche;
  website_url: string | null;
  enrichment_summary: string | null;
  pain_signals: PainSignal[];
  gmaps_rating: number | null;
  gmaps_review_count: number | null;
}

export function painAuditUserPrompt(input: PainAuditInput): string {
  const painList = input.pain_signals.length === 0
    ? "(no specific signals detected)"
    : input.pain_signals
        .map((p) => `- [${p.severity}] ${p.label_hu} (${p.code})`)
        .join("\n");

  const ratingLine =
    input.gmaps_rating != null
      ? `Google Maps értékelés: ${input.gmaps_rating.toFixed(1)}★ (${input.gmaps_review_count ?? 0} értékelés)`
      : "Google Maps értékelés: nincs adat";

  return `<business>
Company: ${input.company_name}
Niche: ${input.niche}
Website: ${input.website_url ?? "—"}
${ratingLine}
</business>

<enrichment_summary>
${input.enrichment_summary ?? "(no enrichment summary)"}
</enrichment_summary>

<detected_pain_signals>
${painList}
</detected_pain_signals>

Write the audit paragraph (Hungarian, 3–5 sentences, no header, no bullets, no CTA).`;
}
