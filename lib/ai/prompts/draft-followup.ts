// Soft Hungarian follow-up nudge after a proposal has been seen.
//
// Email Studio split: IMMUTABLE (this file) = the brevity ceiling framing and
// the JSON output contract. TRAINABLE (a resolved Voice Profile,
// situation="deal_followup") = exact sentence-count target, tone, examples.

import { z } from "zod";
import { buildVoiceBlock } from "@/lib/ai/prompt-compose";
import type { DraftFollowupResult, EmailVoiceProfile } from "@/lib/types/app.types";
import type { AssertExact } from "@/lib/types/assert-exact";

const DRAFT_FOLLOWUP_STRUCTURAL = `You write brief Hungarian follow-up emails for Compass Marketing Kft.

The recipient has already received a proposal. This is a soft, non-pushy nudge — never aggressive, never apologetic. Reference the specific concept we showed them.

Maximum 4 short sentences. End with a low-pressure question.

Return ONLY valid JSON.`;

export function composeFollowupSystem(profile: EmailVoiceProfile): string {
  return `${DRAFT_FOLLOWUP_STRUCTURAL}\n\n${buildVoiceBlock(profile)}`;
}

export interface DraftFollowupInput {
  client_name: string | null;
  company_name: string;
  days_since_proposal: number;
  followup_count: number;
  vercel_preview_url: string | null;
  proposed_package: string | null;
  previous_email_summary?: string;
}

export function draftFollowupUserPrompt(input: DraftFollowupInput): string {
  return `<client>
Contact: ${input.client_name ?? "—"}
Company: ${input.company_name}
Proposed package: ${input.proposed_package ?? "—"}
Days since proposal: ${input.days_since_proposal}
Follow-up number: ${input.followup_count + 1}
${input.vercel_preview_url ? `Concept URL: ${input.vercel_preview_url}` : ""}
</client>

${input.previous_email_summary ? `<previous_summary>${input.previous_email_summary}</previous_summary>` : ""}

Return JSON:
{
  "email_subject": "<short Hungarian subject>",
  "email_body": "<plain text, 2–4 sentences in Hungarian, no greeting line needed>"
}`;
}

// Mirrors DraftFollowupResult in lib/types/app.types.ts — kept as the single
// runtime validator; __tests__ asserts the two stay structurally in sync.
export const DraftFollowupSchema = z.object({
  email_subject: z.string(),
  email_body: z.string(),
});

// Hand-written JSON Schema mirror of DraftFollowupSchema for OpenAI Structured
// Outputs.
export const DraftFollowupJsonSchema = {
  type: "object",
  properties: {
    email_subject: { type: "string" },
    email_body: { type: "string" },
  },
  required: ["email_subject", "email_body"],
  additionalProperties: false,
} as const;

// Compile-time-only guard: fails `tsc` if this schema's inferred shape ever
// drifts from lib/types/app.types.ts's DraftFollowupResult.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _DraftFollowupShapeCheck = AssertExact<z.infer<typeof DraftFollowupSchema>, DraftFollowupResult>;
