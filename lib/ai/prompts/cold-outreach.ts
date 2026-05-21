// AI prompt: write a personalised cold outreach email in Hungarian using
// the pain audit as the hook. This is fundamentally different from
// draft-proposal.ts (which assumes a warm lead already engaged with us).
//
// Quality bar for cold outreach:
//   - Subject line that doesn't smell like a template
//   - First sentence must reference something SPECIFIC about their business
//   - Body weaves in 1–2 concrete pain findings (not the full audit dump)
//   - Soft CTA — invite a 15-minute conversation, not a sales pitch
//   - Under 120 words total

import type { ProspectingNiche } from "@/lib/types/app.types";

export const COLD_OUTREACH_SYSTEM = `You write personalised cold outreach emails in HUNGARIAN for Compass Marketing Kft., a small digital agency.

Rules (non-negotiable):
1. Reference something SPECIFIC about the recipient's business in the first sentence — the niche, the city, what they do. Never use "I noticed your business..." or other generic openers.
2. Weave in 1–2 concrete findings from the pain audit. Pick the ones with the highest business impact. Do NOT dump the whole audit.
3. Frame findings as observations, not accusations. ("Észrevettük, hogy a weboldal mobilon..." is good. "A weboldaluk rossz" is bad.)
4. Soft CTA: invite a 15-minute, no-obligation conversation. Never "demo", never "sales call".
5. Total body length: 80–120 words. No more.
6. No corporate filler ("Reméljük levelünk jó egészségben találja Önöket"). Get to the point in sentence 1.
7. Sign-off: simple "Üdvözlettel, Compass Marketing" — no titles, no "marketing team".

Return ONLY valid JSON, no preamble, no markdown fences.`;

export interface ColdOutreachInput {
  company_name: string;
  contact_name: string | null;
  niche: ProspectingNiche | null;
  city: string | null;
  category: string | null;
  website_url: string | null;
  pain_audit: string | null;
  enrichment_summary: string | null;
}

export function coldOutreachUserPrompt(input: ColdOutreachInput): string {
  return `<recipient>
Company: ${input.company_name}
${input.contact_name ? `Contact: ${input.contact_name}` : "Contact: unknown — address the business, not a person"}
Niche: ${input.niche ?? "unknown"}
City: ${input.city ?? "unknown"}
Google Maps category: ${input.category ?? "unknown"}
Website: ${input.website_url ?? "no website found"}
</recipient>

<pain_audit>
${input.pain_audit ?? "(no audit yet — write a softer opener referencing their niche only)"}
</pain_audit>

<enrichment_summary>
${input.enrichment_summary ?? "(no enrichment)"}
</enrichment_summary>

Return JSON:
{
  "email_subject": "<short Hungarian subject, max 60 chars, no emojis, no clickbait>",
  "email_body": "<plain text email body, no greeting line — start straight into the specific reference, 80–120 words, sign with 'Üdvözlettel, Compass Marketing'>",
  "personalization_hook": "<one short English sentence describing which specific finding the email leads with — for internal logging>"
}`;
}

export interface ColdOutreachResult {
  email_subject: string;
  email_body: string;
  personalization_hook: string;
}
