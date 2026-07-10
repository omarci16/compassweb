// One-off backfill: re-analyse and re-verify cold leads that were scored /
// audited under the old static probe (which misread http stubs, bot walls, and
// JS shells — the windingatlan bug). Walks the cold-lead table by id cursor,
// re-runs the fixed analyzeSite, nulls stale audits when the classification
// changed, and re-verifies the still-promising leads.
//
// Run `dry_run: true` first to see would_downgrade / would_null_audit counts
// without writing anything.

import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/server";
import { analyzeMany } from "@/lib/prospecting/site-analyzer";
import { HIGH_THRESHOLD, scoreColdLead } from "@/lib/ai/scoring/cold-lead-score";
import type { ProspectingNiche } from "@/lib/types/app.types";

// Health statuses worth re-checking (the old probe was most wrong on these).
const SUSPECT = ["broken", "tiny", "stale", "redirect_social"];

type BackfillLead = {
  id: string;
  website_url: string | null;
  niche: string | null;
  gmaps_rating: number | null;
  gmaps_review_count: number | null;
  social_links: Record<string, unknown> | null;
  email: string | null;
  gmaps_phone: string | null;
  website_health_status: string | null;
  pain_audit: string | null;
  win_probability: number | null;
};

export const prospectingBackfillReverify = inngest.createFunction(
  { id: "prospecting-backfill-reverify", retries: 1 },
  { event: "prospecting/backfill-reverify" },
  async ({ event, step }) => {
    const batchSize = Math.min(event.data.batch_size ?? 50, 100);
    const dryRun = !!event.data.dry_run;
    const cursor = event.data.cursor ?? "";
    const supabase = createServiceClient();

    const leads = await step.run("select", async (): Promise<BackfillLead[]> => {
      let q = supabase
        .from("leads")
        .select(
          "id, website_url, niche, gmaps_rating, gmaps_review_count, social_links, email, gmaps_phone, website_health_status, pain_audit, win_probability",
        )
        .eq("source", "cold_outreach")
        .not("website_url", "is", null)
        .is("website_verified_at", null)
        .order("id", { ascending: true })
        .limit(batchSize);
      if (cursor) q = q.gt("id", cursor);
      const { data } = await q;
      return (data ?? []) as BackfillLead[];
    });

    if (leads.length === 0) {
      return { ok: true, done: true };
    }

    const targets = leads.filter(
      (l) =>
        (l.website_health_status && SUSPECT.includes(l.website_health_status)) ||
        (l.win_probability ?? 0) >= HIGH_THRESHOLD ||
        !!l.pain_audit,
    );

    const analyses = await step.run("reanalyze", async () =>
      analyzeMany(targets.map((t) => t.website_url), 6),
    );

    let downgraded = 0;
    let nulledAudits = 0;
    const verifyIds: string[] = [];

    const outcome = await step.run("apply", async () => {
      let dg = 0;
      let na = 0;
      const vIds: string[] = [];
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        const a = analyses[i];
        const changed = a.health_status !== t.website_health_status;

        const score = scoreColdLead({
          niche: (t.niche as ProspectingNiche) ?? "other",
          gmaps_rating: t.gmaps_rating,
          gmaps_review_count: t.gmaps_review_count,
          website_url: t.website_url,
          website_health: a.health_status,
          social_links_count: t.social_links ? Object.keys(t.social_links).length : 0,
          has_email: !!t.email,
          has_phone: !!t.gmaps_phone,
          pain_signals: a.pain_signals,
          website_verified: false,
        });

        if (changed) dg++;
        const wantsReverify =
          score.total >= HIGH_THRESHOLD ||
          a.health_status === "js_shell" ||
          a.health_status === "tiny";
        if (wantsReverify) vIds.push(t.id);

        if (dryRun) {
          if (changed && t.pain_audit) na++;
          continue;
        }

        const update: Record<string, unknown> = {
          website_health_status: a.health_status,
          website_health_checked_at: new Date().toISOString(),
          website_health_details: a.health_details,
          tech_stack: a.tech_stack,
          pain_signals: a.pain_signals,
          win_probability: score.total,
          win_probability_reasons: score.signals.map((s) => s.label),
        };
        // A re-classified site invalidates any audit written off the old signals.
        if (changed && t.pain_audit) {
          update.pain_audit = null;
          update.pain_audit_generated_at = null;
          na++;
        }
        await supabase.from("leads").update(update).eq("id", t.id);
      }
      return { dg, na, vIds };
    });

    downgraded = outcome.dg;
    nulledAudits = outcome.na;
    verifyIds.push(...outcome.vIds);

    if (!dryRun && verifyIds.length > 0) {
      await step.sendEvent(
        "reverify",
        verifyIds.map((lead_id) => ({
          name: "lead/verify-site" as const,
          data: { lead_id, audit_after: true },
        })),
      );
    }

    const nextCursor = leads[leads.length - 1].id;
    await step.sleep("politeness", "30s");
    await step.sendEvent("continue", {
      name: "prospecting/backfill-reverify",
      data: { batch_size: batchSize, dry_run: dryRun, cursor: nextCursor },
    });

    return {
      ok: true,
      dry_run: dryRun,
      processed: leads.length,
      targets: targets.length,
      would_downgrade: downgraded,
      would_null_audit: nulledAudits,
      cursor: nextCursor,
    };
  },
);
