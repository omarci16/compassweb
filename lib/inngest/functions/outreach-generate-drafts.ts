// Batch-generate AI outreach drafts into the approval queue (Scraping 2.1,
// Phase D). Runs in the background (no route timeout) — the route just fires the
// event. NEVER sends: it only creates status='draft' rows for a human to review.
//
// Eligibility: cold leads that are routed (needs_site / upgrade), have an email
// that isn't `invalid`, and don't already have an open draft.

import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/server";
import {
  DRAFT_LEAD_COLUMNS,
  generateDraftPayload,
  type DraftLeadInput,
} from "@/lib/outreach/generate-draft";

export const outreachGenerateDrafts = inngest.createFunction(
  { id: "outreach-generate-drafts", retries: 1 },
  { event: "outreach/generate-drafts" },
  async ({ event, step }) => {
    const track = event.data.track ?? null;
    const limit = Math.min(Math.max(event.data.limit ?? 10, 1), 40);
    const minScore = event.data.min_score ?? 55;
    const supabase = createServiceClient();

    // Leads already carrying an open draft — don't double-queue them.
    const existingDraftLeadIds = await step.run("existing-drafts", async () => {
      const { data } = await supabase
        .from("outreach_drafts")
        .select("lead_id")
        .in("status", ["draft", "approved", "scheduled"]);
      return ((data ?? []) as { lead_id: string }[]).map((r) => r.lead_id);
    });
    const skip = new Set(existingDraftLeadIds);

    const leads = await step.run("eligible-leads", async () => {
      let q = supabase
        .from("leads")
        .select(DRAFT_LEAD_COLUMNS + ", email, email_status, win_probability")
        .eq("source", "cold_outreach")
        .not("email", "is", null)
        .neq("email_status", "invalid")
        .gte("win_probability", minScore)
        .order("win_probability", { ascending: false, nullsFirst: false })
        .limit(limit * 3); // over-fetch; we filter out already-drafted + low_priority
      if (track) q = q.eq("offer_track", track);
      else q = q.in("offer_track", ["needs_site", "upgrade"]);
      const { data } = await q;
      return (data ?? []) as unknown as (DraftLeadInput & { email_status: string | null })[];
    });

    const targets = leads.filter((l) => !skip.has(l.id)).slice(0, limit);

    let generated = 0;
    for (const lead of targets) {
      // One step per lead so a single AI failure doesn't lose the whole batch.
      const ok = await step.run(`draft-${lead.id}`, async () => {
        try {
          const payload = await generateDraftPayload(supabase, lead);
          const { error } = await supabase.from("outreach_drafts").insert(payload);
          if (error) {
            console.error("[outreach] insert draft failed", error);
            return false;
          }
          return true;
        } catch (err) {
          console.error("[outreach] draft generation failed", err);
          return false;
        }
      });
      if (ok) generated += 1;
    }

    return { ok: true, eligible: targets.length, generated };
  },
);
