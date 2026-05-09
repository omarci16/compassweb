// Signals used:
//   - client/company name, niche, enrichment_summary
//   - vercel preview URL (the visual concept they will receive)
//   - package recommendation context + price ranges
// Output: Hungarian email + structured pricing.

export const DRAFT_PROPOSAL_SYSTEM = `You are writing a sales proposal email in Hungarian for Compass Marketing Kft.

Voice: confident, warm, professional — never corporate-stiff, never casual. The reader is a Hungarian SMB owner. Reference what you know about their business specifically (from the enrichment summary). Keep paragraphs short. End with a clear, soft call to action.

You also recommend a specific package and price. Packages:
- "landing": single landing page, 250–450k Ft
- "business": 5–8 page business site, 600k–1.1M Ft
- "ecommerce": full e-commerce build, 1.2–2.5M Ft
Monthly retainer is always 25 000 Ft unless the brief warrants more.

Return ONLY valid JSON. No markdown, no commentary.`;

export interface DraftProposalInput {
  client_name: string | null;
  company_name: string;
  niche: string | null;
  enrichment_summary: string | null;
  vercel_preview_url: string | null;
  package_hint?: "landing" | "business" | "ecommerce";
  budget_signal?: "low" | "mid" | "premium";
}

export function draftProposalUserPrompt(input: DraftProposalInput): string {
  return `<client>
Contact: ${input.client_name ?? "—"}
Company: ${input.company_name}
Niche: ${input.niche ?? "—"}
${input.package_hint ? `Suggested package: ${input.package_hint}` : ""}
${input.budget_signal ? `Budget signal: ${input.budget_signal}` : ""}
</client>

<enrichment_summary>
${input.enrichment_summary ?? "No enrichment summary."}
</enrichment_summary>

${input.vercel_preview_url ? `<concept_preview_url>${input.vercel_preview_url}</concept_preview_url>` : ""}

Draft a Hungarian proposal email. Return JSON:
{
  "email_subject": "<short Hungarian subject line>",
  "email_body": "<HTML body using only <p> and <strong>, Hungarian, 4–6 short paragraphs>",
  "proposed_package": "landing" | "business" | "ecommerce",
  "proposed_price_huf": <integer>,
  "monthly_fee_huf": <integer>,
  "talking_points": [<exactly 3 short English bullets explaining internally why this package fits this client>]
}`;
}
