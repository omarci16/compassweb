import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import { callClaude, extractJsonWithSchema } from "@/lib/ai/anthropic";
import {
  ColdOutreachSchema,
  coldOutreachUserPrompt,
  pickColdOutreachSystem,
} from "@/lib/ai/prompts/cold-outreach";
import { renderDraftBody, verifiedSignalLabels } from "@/lib/outreach/draft-content";
import type { OfferTrack, PainSignal, ProspectingNiche } from "@/lib/types/app.types";

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
      "id, company_name, contact_name, niche, gmaps_city, gmaps_category, website_url, pain_audit, enrichment_summary, offer_track, pain_signals",
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

  const track = (lead.offer_track as OfferTrack | null) ?? "needs_site";
  const verified = verifiedSignalLabels(
    Array.isArray(lead.pain_signals) ? (lead.pain_signals as unknown as PainSignal[]) : [],
  );

  try {
    const text = await callClaude({
      system: pickColdOutreachSystem(track),
      user: coldOutreachUserPrompt({
        company_name: lead.company_name,
        contact_name: lead.contact_name,
        niche: (lead.niche as ProspectingNiche) ?? null,
        city: lead.gmaps_city,
        category: lead.gmaps_category,
        website_url: lead.website_url,
        pain_audit: lead.pain_audit,
        enrichment_summary: lead.enrichment_summary,
        offer_track: track,
        verified_signals: verified,
      }),
      maxTokens: 1400,
    });

    const result = extractJsonWithSchema(text, ColdOutreachSchema);
    // Expand spintax so the reviewer sees final copy, not {a|b} markup.
    const rendered = renderDraftBody(result.email_body_html, result.email_body_text);
    return NextResponse.json({
      ok: true,
      result: {
        ...result,
        email_body_html: rendered.body_html,
        email_body_text: rendered.body_text,
      },
      offer_track: track,
    });
  } catch (err) {
    console.error("cold outreach drafting failed", err);
    return NextResponse.json(
      { error: "AI request failed" },
      { status: 500 },
    );
  }
}
