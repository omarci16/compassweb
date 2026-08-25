import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import { DRAFT_LEAD_COLUMNS, generateDraftPayload } from "@/lib/outreach/generate-draft";

const Input = z.object({
  lead_id: z.string().uuid(),
});

// Thin wrapper around the shared generateDraftPayload core (also used by the
// batch/sequence Inngest jobs) so the single-lead UI flow and the batch flow
// can never drift into two different prompt-selection implementations.
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
          "<p>Kedves Demo!</p><p>Konfiguráld a Supabase és OpenAI kulcsokat ahhoz, hogy valódi, személyre szabott levelet generálj.</p><p>Üdvözlettel,<br/>Compass Marketing</p>",
        email_body_text:
          "Kedves Demo!\n\nKonfiguráld a Supabase és OpenAI kulcsokat ahhoz, hogy valódi, személyre szabott levelet generálj.\n\nÜdvözlettel,\nCompass Marketing",
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
    .select(DRAFT_LEAD_COLUMNS)
    .eq("id", lead_id)
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 500 },
    );
  }

  try {
    const draft = await generateDraftPayload(supabase, lead);
    return NextResponse.json({
      ok: true,
      result: {
        email_subject: draft.subject,
        email_body_html: draft.body_html,
        email_body_text: draft.body_text,
        visual_concept: draft.visual_concept,
        primary_pain_point_used: draft.ai_meta.primary_pain_point_used,
        personalization_hook: draft.ai_meta.personalization_hook,
        tone_notes: draft.ai_meta.tone_notes,
      },
      offer_track: draft.track,
    });
  } catch (err) {
    console.error("cold outreach drafting failed", err);
    return NextResponse.json(
      { error: "AI request failed" },
      { status: 500 },
    );
  }
}
