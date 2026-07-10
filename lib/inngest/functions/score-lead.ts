import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/server";
import { z } from "zod";
import { callClaude, extractJsonWithSchema } from "@/lib/ai/anthropic";
import {
  SCORE_LEAD_SYSTEM,
  scoreLeadUserPrompt,
} from "@/lib/ai/prompts/score-lead";
import {
  combineWithAi,
  computeBaseScore,
} from "@/lib/ai/scoring/win-probability";

export const scoreLead = inngest.createFunction(
  { id: "score-lead", retries: 2 },
  { event: "lead/enriched" },
  async ({ event, step }) => {
    const supabase = createServiceClient();
    const { lead_id } = event.data;

    const lead = await step.run("fetch", async () => {
      const { data } = await supabase.from("leads").select("*").eq("id", lead_id).single();
      return data;
    });
    if (!lead) return;

    const base = computeBaseScore({
      lead: {
        budget_confirmed: lead.budget_confirmed,
        decision_maker_confirmed: lead.decision_maker_confirmed,
        has_existing_website: lead.has_existing_website ?? false,
        timeline_weeks: lead.timeline_weeks,
        package_interest: lead.package_interest as never,
        source: lead.source,
        niche: lead.niche,
      },
    });

    const aiResult = await step.run("ai-score", async () => {
      if (!process.env.ANTHROPIC_API_KEY) return { adjustment: 0, reasons: [] as string[] };
      try {
        const text = await callClaude({
          system: SCORE_LEAD_SYSTEM,
          user: scoreLeadUserPrompt({
            lead: {
              company_name: lead.company_name,
              niche: lead.niche,
              source: lead.source as never,
              package_interest: lead.package_interest as never,
              budget_confirmed: lead.budget_confirmed,
              decision_maker_confirmed: lead.decision_maker_confirmed,
              timeline_weeks: lead.timeline_weeks,
              has_existing_website: lead.has_existing_website,
              website_url: lead.website_url,
            },
            enrichment_summary: lead.enrichment_summary,
            base_score: base.total,
          }),
          maxTokens: 600,
        });
        const parsed = extractJsonWithSchema(
          text,
          z.object({
            adjusted_score: z.number().min(0).max(100),
            reasons: z.array(z.string()),
          }),
        );
        return {
          adjustment: parsed.adjusted_score - base.total,
          reasons: parsed.reasons,
        };
      } catch {
        return { adjustment: 0, reasons: [] };
      }
    });

    const final = combineWithAi({ baseScore: base.total, aiAdjustment: aiResult.adjustment });
    const reasons = [...base.signals.map((s) => s.label), ...aiResult.reasons];

    await step.run("persist", async () => {
      await supabase
        .from("leads")
        .update({
          win_probability: final,
          win_probability_reasons: reasons,
          status: lead.status === "new" || lead.status === "enriching" ? "qualified" : lead.status,
        })
        .eq("id", lead_id);
    });
  },
);
