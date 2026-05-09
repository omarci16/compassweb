// Soft Hungarian follow-up nudge after a proposal has been seen.
export const DRAFT_FOLLOWUP_SYSTEM = `You write brief, warm Hungarian follow-up emails for Compass Marketing Kft.

The recipient has already received a proposal. This is a soft, non-pushy nudge — never aggressive, never apologetic. Reference the specific concept we showed them.

Maximum 4 short sentences. End with a low-pressure question.

Return ONLY valid JSON.`;

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
