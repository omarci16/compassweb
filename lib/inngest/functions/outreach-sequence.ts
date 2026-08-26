// Cold follow-up sequence tick (Scraping 2.1, Phase F). Daily cron: for each
// active cold_followup sequence that's due, either STOP it (reply / unsubscribe
// / bounce / lead worked) or AI-draft the next touch into the approval queue.
//
// Never sends. Never auto-advances past a draft that's still awaiting approval —
// so a human staying silent simply pauses the cadence, it doesn't pile up.

import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/server";
import {
  DRAFT_LEAD_COLUMNS,
  generateDraftPayload,
  type DraftLeadInput,
} from "@/lib/outreach/generate-draft";
import { isSuppressed } from "@/lib/outreach/suppression";
import { planNextTouch, stopReason, stopStatusFor } from "@/lib/outreach/sequence";

interface Seq {
  id: string;
  lead_id: string;
  touch_count: number;
}

export const outreachSequenceTick = inngest.createFunction(
  { id: "outreach-sequence-tick", retries: 1 },
  [
    { event: "outreach/sequence-tick" },
    { cron: "TZ=Europe/Budapest 0 10 * * *" },
  ],
  async ({ step }) => {
    const supabase = createServiceClient();
    const nowIso = new Date().toISOString();

    const due = await step.run("due-sequences", async () => {
      const { data } = await supabase
        .from("re_engagement_sequences")
        .select("id, lead_id, touch_count")
        .eq("kind", "cold_followup")
        .eq("status", "active")
        .lte("next_touch_at", nowIso)
        .limit(50);
      return (data ?? []) as Seq[];
    });

    let drafted = 0;
    let stopped = 0;

    for (const seq of due) {
      const outcome = await step.run(`tick-${seq.id}`, async () => {
        // ----- Lead + stop signals -----
        const { data } = await supabase
          .from("leads")
          .select(DRAFT_LEAD_COLUMNS + ", email, email_status, status")
          .eq("id", seq.lead_id)
          .single();
        const lead = data as unknown as
          | (DraftLeadInput & { email: string | null; email_status: string | null; status: string })
          | null;
        if (!lead) {
          await supabase
            .from("re_engagement_sequences")
            .update({ status: "paused" })
            .eq("id", seq.id);
          return "stopped";
        }

        const email = lead.email;
        const leadStatus = lead.status;

        const [suppressed, replied, bounced] = await Promise.all([
          email ? isSuppressed(supabase, email) : Promise.resolve(true),
          // A reply = any inbound email logged against this lead.
          supabase
            .from("email_log")
            .select("id", { count: "exact", head: true })
            .eq("lead_id", seq.lead_id)
            .eq("direction", "inbound")
            .then((r) => (r.count ?? 0) > 0),
          supabase
            .from("outreach_sends")
            .select("id", { count: "exact", head: true })
            .eq("lead_id", seq.lead_id)
            .in("status", ["bounced", "complained"])
            .then((r) => (r.count ?? 0) > 0),
        ]);

        const leadClosed = ["won", "lost", "qualified", "negotiating", "archived"].includes(
          leadStatus,
        );

        const reason = stopReason({ suppressed, bounced, replied, leadClosed });
        if (reason) {
          await supabase
            .from("re_engagement_sequences")
            .update({ status: stopStatusFor(reason) })
            .eq("id", seq.id);
          return "stopped";
        }

        // ----- Don't draft the next touch while one is still open -----
        const { count: openCount } = await supabase
          .from("outreach_drafts")
          .select("id", { count: "exact", head: true })
          .eq("lead_id", seq.lead_id)
          .in("status", ["draft", "approved", "scheduled"]);
        if ((openCount ?? 0) > 0) {
          // Nudge next_touch_at forward a day so we re-check tomorrow.
          await supabase
            .from("re_engagement_sequences")
            .update({ next_touch_at: new Date(Date.now() + 86_400_000).toISOString() })
            .eq("id", seq.id);
          return "waiting";
        }

        // ----- Plan + draft the next touch -----
        const plan = planNextTouch(seq.touch_count, new Date());
        if (!plan) {
          await supabase
            .from("re_engagement_sequences")
            .update({ status: "paused" })
            .eq("id", seq.id);
          return "stopped";
        }

        try {
          const payload = await generateDraftPayload(supabase, lead, {
            touchNumber: plan.touchNumber,
            sequenceId: seq.id,
          });
          const { error } = await supabase.from("outreach_drafts").insert(payload);
          if (error) {
            console.error("[sequence] insert draft failed", error);
            return "error";
          }
        } catch (err) {
          console.error("[sequence] draft generation failed", err);
          return "error";
        }

        await supabase
          .from("re_engagement_sequences")
          .update({
            touch_count: plan.touchNumber,
            last_touch_at: nowIso,
            last_touch_type: `cold_${plan.touchNumber}`,
            next_touch_at: plan.nextTouchAt,
            status: plan.isFinal ? "paused" : "active",
          })
          .eq("id", seq.id);
        return "drafted";
      });

      if (outcome === "drafted") drafted += 1;
      if (outcome === "stopped") stopped += 1;
    }

    return { ok: true, due: due.length, drafted, stopped };
  },
);
