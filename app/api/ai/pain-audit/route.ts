import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import { callClaude } from "@/lib/ai/anthropic";
import {
  PAIN_AUDIT_SYSTEM,
  painAuditUserPrompt,
} from "@/lib/ai/prompts/pain-audit";
import type { PainSignal, ProspectingNiche } from "@/lib/types/app.types";

const Input = z.object({
  lead_id: z.string().uuid(),
  force: z.boolean().default(false),
});

/**
 * Synchronous pain-audit generation, called from the lead detail page.
 * For bulk runs we still use the Inngest function — this is for the
 * single-lead "Generate audit" button which expects an immediate result.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = Input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { lead_id, force } = parsed.data;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      demo: true,
      audit: "Demo mode — set Supabase + Anthropic keys to generate real audits.",
    });
  }

  const supabase = createServiceClient();
  const { data: lead, error } = await supabase
    .from("leads")
    .select(
      "id, company_name, niche, website_url, enrichment_summary, pain_signals, gmaps_rating, gmaps_review_count, pain_audit",
    )
    .eq("id", lead_id)
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (lead.pain_audit && !force) {
    return NextResponse.json({
      ok: true,
      audit: lead.pain_audit,
      cached: true,
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 },
    );
  }

  const painSignals = Array.isArray(lead.pain_signals)
    ? (lead.pain_signals as unknown as PainSignal[])
    : [];

  if (painSignals.length === 0 && !lead.enrichment_summary) {
    return NextResponse.json(
      { error: "No pain signals or enrichment yet — run enrichment first." },
      { status: 400 },
    );
  }

  try {
    const audit = await callClaude({
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
    });

    const trimmed = audit.trim();
    await supabase
      .from("leads")
      .update({
        pain_audit: trimmed,
        pain_audit_generated_at: new Date().toISOString(),
      })
      .eq("id", lead_id);

    return NextResponse.json({ ok: true, audit: trimmed, cached: false });
  } catch (err) {
    console.error("pain audit failed", err);
    return NextResponse.json(
      { error: "AI request failed" },
      { status: 500 },
    );
  }
}
