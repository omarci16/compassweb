import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import { callClaude, extractJson } from "@/lib/ai/anthropic";
import {
  SCORE_LEAD_SYSTEM,
  scoreLeadUserPrompt,
} from "@/lib/ai/prompts/score-lead";
import {
  combineWithAi,
  computeBaseScore,
} from "@/lib/ai/scoring/win-probability";

const Input = z.object({ lead_id: z.string() });

export async function POST(req: Request) {
  const parsed = Input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad input" }, { status: 400 });

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      demo: true,
      message: "Supabase not configured — score not persisted.",
    });
  }

  const supabase = createServiceClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", parsed.data.lead_id)
    .single();
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

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

  let aiAdjustment = 0;
  let aiReasons: string[] = [];

  if (process.env.ANTHROPIC_API_KEY) {
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
      const result = extractJson<{
        adjusted_score: number;
        reasons: string[];
        top_concern: string | null;
      }>(text);
      aiAdjustment = result.adjusted_score - base.total;
      aiReasons = Array.isArray(result.reasons) ? result.reasons : [];
    } catch (err) {
      console.error("Claude scoring failed", err);
    }
  }

  const final = combineWithAi({ baseScore: base.total, aiAdjustment });
  const reasons = [...base.signals.map((s) => s.label), ...aiReasons];

  await supabase
    .from("leads")
    .update({ win_probability: final, win_probability_reasons: reasons })
    .eq("id", lead.id);

  return NextResponse.json({
    ok: true,
    win_probability: final,
    base_score: base.total,
    ai_adjustment: aiAdjustment,
    reasons,
  });
}
