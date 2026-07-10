import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import { callClaude, extractJsonWithSchema } from "@/lib/ai/anthropic";
import {
  COLD_OUTREACH_SYSTEM,
  coldOutreachUserPrompt,
} from "@/lib/ai/prompts/cold-outreach";
import type { ProspectingNiche } from "@/lib/types/app.types";

const Input = z.object({
  lead_id: z.string().uuid(),
});

const ColdOutreachSchema = z.object({
  email_subject: z.string(),
  email_body_html: z.string(),
  email_body_text: z.string(),
  visual_concept: z.string(),
  primary_pain_point_used: z.string(),
  personalization_hook: z.string(),
  tone_notes: z.string(),
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
        email_subject: "Egy gyors koncepció a vállalkozásnak",
        email_body_html:
          "<p>Kedves Demo!</p><p>Konfiguráld a Supabase és Anthropic kulcsokat ahhoz, hogy valódi, személyre szabott levelet generálj.</p><p>Üdvözlettel,<br/>Compass Marketing</p>",
        email_body_text:
          "Kedves Demo!\n\nKonfiguráld a Supabase és Anthropic kulcsokat ahhoz, hogy valódi, személyre szabott levelet generálj.\n\nÜdvözlettel,\nCompass Marketing",
        visual_concept:
          "Demo módban nem generálunk vizuális koncepciót. Állítsd be a kulcsokat.",
        primary_pain_point_used: "demo",
        personalization_hook: "demo",
        tone_notes: "demo",
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
      maxTokens: 1400,
    });

    const result = extractJsonWithSchema(text, ColdOutreachSchema);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("cold outreach drafting failed", err);
    return NextResponse.json(
      { error: "AI request failed" },
      { status: 500 },
    );
  }
}
