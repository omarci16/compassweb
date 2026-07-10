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
import type {
  PainSignal,
  ProspectingNiche,
  WebsiteHealthStatus,
} from "@/lib/types/app.types";

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
          "id, company_name, niche, website_url, enrichment_summary, pain_signals, gmaps_rating, gmaps_review_count, pain_audit, website_health_status, website_health_details, website_verified_at",
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

    // "We couldn't look" must never become an audit. A bot wall, a timeout, an
    // invalid URL, or an un-rendered JS shell tell us nothing about the site —
    // auditing on them produces confidently-wrong claims (the windingatlan bug).
    const health = lead.website_health_status as WebsiteHealthStatus | null;
    if (health && ["blocked", "unreachable", "unknown", "js_shell"].includes(health)) {
      return { ok: false, reason: `Site unverifiable (${health})` };
    }

    // Hard gate: a live website must be VERIFIED (PSI / rendered crawl) before we
    // audit it. `no_website` / `redirect_social` are verifiable without rendering.
    const verifiedByNature = health === "no_website" || health === "redirect_social";
    if (!verifiedByNature && !lead.website_verified_at && !event.data.force) {
      return { ok: false, reason: "Site not verified yet" };
    }

    const allSignals = Array.isArray(lead.pain_signals)
      ? (lead.pain_signals as unknown as PainSignal[])
      : [];
    // Only VERIFIED signals may inform the audit. Heuristic guesses (and legacy
    // rows with no confidence tag) are excluded so the audit can't state them
    // as facts. no_website/social short-circuits above carry verified signals.
    const painSignals = allSignals.filter((s) => s.confidence === "verified");

    if (painSignals.length === 0 && !lead.enrichment_summary) {
      return { ok: false, reason: "No verified signals to audit on" };
    }

    const finalUrl =
      lead.website_health_details &&
      typeof lead.website_health_details === "object" &&
      "final_url" in lead.website_health_details
        ? ((lead.website_health_details as { final_url?: string }).final_url ?? null)
        : null;

    const audit = await step.run("call-claude", async () =>
      callClaude({
        system: PAIN_AUDIT_SYSTEM,
        user: painAuditUserPrompt({
          company_name: lead.company_name,
          niche: (lead.niche as ProspectingNiche) ?? "other",
          website_url: lead.website_url,
          final_url: finalUrl,
          health_status: health,
          enrichment_summary: lead.enrichment_summary,
          pain_signals: painSignals,
          gmaps_rating: lead.gmaps_rating,
          gmaps_review_count: lead.gmaps_review_count,
        }),
        maxTokens: 600,
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
