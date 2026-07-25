import { Inngest, EventSchemas } from "inngest";

type Events = {
  "lead/created": { data: { lead_id: string; website_url?: string | null } };
  "lead/enriched": { data: { lead_id: string } };
  "lead/score": { data: { lead_id: string } };
  "deal/visual-attached": { data: { deal_id: string } };
  "project/materials-overdue": { data: { project_id: string } };
  "re_engagement/schedule": { data: { lead_id: string } };
  // Prospecting / cold lead sourcing
  "prospecting/run-scrape": { data: { job_id: string } };
  "prospecting/results-ready": { data: { job_id: string } };
  "prospecting/score-cold": { data: { job_id: string; lead_ids: string[] } };
  "lead/pain-audit": { data: { lead_id: string; force?: boolean } };
  // Verify a lead's site against rendered ground truth (PSI + optional crawl)
  // before any audit/outreach. audit_after → fire the pain audit if it stays top-tier.
  "lead/verify-site": { data: { lead_id: string; audit_after?: boolean } };
  // One-off: re-analyse + re-verify existing cold leads that were scored/audited
  // under the old buggy static probe. Self-continues by id cursor.
  "prospecting/backfill-reverify": {
    data: { batch_size?: number; dry_run?: boolean; cursor?: string };
  };
  // Outreach machine (Scraping 2.1)
  // Batch-generate AI drafts into the approval queue for routed cold leads.
  "outreach/generate-drafts": {
    data: { track?: string; limit?: number; min_score?: number };
  };
  // Pull approved drafts and send them via a rotated inbox (throttled).
  "outreach/send-queue": { data: Record<string, never> };
  // Advance a lead's cold follow-up sequence (draft next touch into the queue).
  "outreach/sequence-tick": { data: Record<string, never> };
};

export const inngest = new Inngest({
  id: "compass-erp",
  schemas: new EventSchemas().fromRecord<Events>(),
});
