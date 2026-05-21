// Generates the AI pain audit for a lead.
// Triggered automatically for top-tier cold leads after prospecting,
// and manually via the lead detail page button.

import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/ai/anthropic";
import {
  PAIN_AUDIT_SYSTEM,
  painAuditUserPrompt,
} from "@/lib/ai/prompts/pain-audit";
import type { PainSignal, ProspectingNiche } from "@/lib/types/app.types";

export const generatePainAudit = inngest.createFunction(
  { id: "generate-pain-audit", retries: 2 },
  { event: "lead/pain-audit" },
  async ({ event, step }) => {
    const { lead_id } = event.data;
    const supabase = createServiceClient();

    const lead = await step.run("fetch", async () => {
      const { data } = await supabase
        .from("leads")
        .select(
          "id, company_name, niche, website_url, enrichment_summary, pain_signals, gmaps_rating, gmaps_review_count, pain_audit",
        )
        .eq("id", lead_id)
        .single();
      return data;
    });
    if (!lead) return { ok: false, reason: "Lead not found" };

    // Idempotency: if an audit already exists, only regenerate if forced
    if (lead.pain_audit && !event.data.force) {
      return { ok: false, reason: "Audit already exists" };
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return { ok: false, reason: "No Anthropic key" };
    }

    const painSignals = Array.isArray(lead.pain_signals)
      ? (lead.pain_signals as unknown as PainSignal[])
      : [];

    // If we have no enrichment AND no signals, there's nothing to audit on
    if (painSignals.length === 0 && !lead.enrichment_summary) {
      return { ok: false, reason: "Nothing to audit" };
    }

    const audit = await step.run("call-claude", async () =>
      callClaude({
        system: PAIN_AUDIT_SYSTEM,
        user: painAuditUserPrompt({
          company_name: lead.company_name,
          niche: (lead.niche as ProspectingNiche) ?? "other",
          website_url: lead.website_url,
          enrichment_summary: lead.enrichment_summary,
          pain_signals: painSignals,
          gmaps_rating: lead.gmaps_rating,
          gmaps_review_count: lead.gmaps_review_count,
        }),
        maxTokens: 600,
        temperature: 0.5,
      }),
    );

    await step.run("persist", async () => {
      await supabase
        .from("leads")
        .update({
          pain_audit: audit.trim(),
          pain_audit_generated_at: new Date().toISOString(),
        })
        .eq("id", lead_id);
    });

    return { ok: true, length: audit.length };
  },
);
