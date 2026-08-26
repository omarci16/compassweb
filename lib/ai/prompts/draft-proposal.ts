// Signals used:
//   - client/company name, niche, enrichment_summary
//   - vercel preview URL (the visual concept they will receive)
//   - package recommendation context + price ranges
// Output: Hungarian email + structured pricing.
//
// Email Studio split: IMMUTABLE (this file) = the package/pricing-band rule
// (reading from lib/config/packages.ts — CLAUDE.md §16.8, never hardcode HUF
// amounts) and the JSON output contract. TRAINABLE (a resolved Voice Profile,
// situation="proposal") = tone, paragraph count, examples, signature.

import { z } from "zod";
import { formatPackageBandsForPrompt, DEFAULT_MONTHLY_RETAINER_HUF } from "@/lib/config/packages";
import { buildVoiceBlock } from "@/lib/ai/prompt-compose";
import type { DraftProposalResult, EmailVoiceProfile } from "@/lib/types/app.types";
import type { AssertExact } from "@/lib/types/assert-exact";

const DRAFT_PROPOSAL_STRUCTURAL = `You are writing a sales proposal email in Hungarian for Compass Marketing Kft.

You recommend a specific package and price. Packages:
${formatPackageBandsForPrompt()}
Monthly retainer is ${DEFAULT_MONTHLY_RETAINER_HUF.toLocaleString("hu-HU")} Ft unless the brief warrants more.

Reference what you know about their business specifically (from the enrichment summary).

Return ONLY valid JSON. No markdown, no commentary.`;

export function composeProposalSystem(profile: EmailVoiceProfile): string {
  return `${DRAFT_PROPOSAL_STRUCTURAL}\n\n${buildVoiceBlock(profile)}`;
}

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
  "email_body": "<HTML body using only <p> and <strong>, Hungarian>",
  "proposed_package": "landing" | "business" | "ecommerce",
  "proposed_price_huf": <integer>,
  "monthly_fee_huf": <integer>,
  "talking_points": [<exactly 3 short English bullets explaining internally why this package fits this client>]
}`;
}

// Mirrors DraftProposalResult in lib/types/app.types.ts — kept as the single
// runtime validator; __tests__ asserts the two stay structurally in sync.
export const DraftProposalSchema = z.object({
  email_subject: z.string(),
  email_body: z.string(),
  proposed_package: z.enum(["landing", "business", "ecommerce"]),
  proposed_price_huf: z.number(),
  monthly_fee_huf: z.number(),
  talking_points: z.array(z.string()),
});

// Hand-written JSON Schema mirror of DraftProposalSchema for OpenAI Structured
// Outputs. talking_points is fixed-length in practice (exactly 3, per the
// prompt) but modeled as a plain string array here — OpenAI strict mode
// doesn't support minItems/maxItems enforcement, so length is prompt-enforced
// and re-validated by DraftProposalSchema at the call site if desired.
export const DraftProposalJsonSchema = {
  type: "object",
  properties: {
    email_subject: { type: "string" },
    email_body: { type: "string" },
    proposed_package: { type: "string", enum: ["landing", "business", "ecommerce"] },
    proposed_price_huf: { type: "number" },
    monthly_fee_huf: { type: "number" },
    talking_points: { type: "array", items: { type: "string" } },
  },
  required: [
    "email_subject",
    "email_body",
    "proposed_package",
    "proposed_price_huf",
    "monthly_fee_huf",
    "talking_points",
  ],
  additionalProperties: false,
} as const;

// Compile-time-only guard: fails `tsc` if this schema's inferred shape ever
// drifts from lib/types/app.types.ts's DraftProposalResult.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _DraftProposalShapeCheck = AssertExact<z.infer<typeof DraftProposalSchema>, DraftProposalResult>;
