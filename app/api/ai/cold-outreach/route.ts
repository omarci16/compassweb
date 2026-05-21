import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import { callClaude, extractJson } from "@/lib/ai/anthropic";
import {
  COLD_OUTREACH_SYSTEM,
  coldOutreachUserPrompt,
  type ColdOutreachResult,
} from "@/lib/ai/prompts/cold-outreach";
import type { ProspectingNiche } from "@/lib/types/app.types";

const Input = z.object({
  lead_id: z.string().uuid(),
});

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
  const { lead_id } = parsed.data;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      demo: true,
      result: {
        email_subject: "Demo subject",
        email_body: "Demo cold outreach body — configure Supabase + Anthropic to generate real emails.",
        personalization_hook: "demo",
      },
    });
  }

  const supabase = createServiceClient();
  const { data: lead, error } = await supabase
    .from("leads")
    .select(
      "id, company_name, contact_name, niche, gmaps_city, gmaps_category, website_url, pain_audit, enrichment_summary",
    )
    .eq("id", lead_id)
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 },
    );
  }

  try {
    const text = await callClaude({
      system: COLD_OUTREACH_SYSTEM,
      user: coldOutreachUserPrompt({
        company_name: lead.company_name,
        contact_name: lead.contact_name,
        niche: (lead.niche as ProspectingNiche) ?? null,
        city: lead.gmaps_city,
        category: lead.gmaps_category,
        website_url: lead.website_url,
        pain_audit: lead.pain_audit,
        enrichment_summary: lead.enrichment_summary,
      }),
      maxTokens: 800,
      temperature: 0.7,
    });

    const result = extractJson<ColdOutreachResult>(text);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("cold outreach drafting failed", err);
    return NextResponse.json(
      { error: "AI request failed" },
      { status: 500 },
    );
  }
}
