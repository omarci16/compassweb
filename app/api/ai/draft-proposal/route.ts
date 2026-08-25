import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import { callOpenAIStructured } from "@/lib/openai/client";
import {
  DraftProposalJsonSchema,
  DraftProposalSchema,
  composeProposalSystem,
  draftProposalUserPrompt,
} from "@/lib/ai/prompts/draft-proposal";
import { resolveVoiceProfile } from "@/lib/email-studio/resolve-voice-profile";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DraftProposalResult, EmailVoiceProfile } from "@/lib/types/app.types";

const Input = z.object({ deal_id: z.string() });

// Used only when OPENAI_API_KEY is set but Supabase isn't configured (local
// prompt testing without a DB) — there's no email_voice_profiles table to
// resolve against, so this stands in for the seeded "proposal" default.
const FALLBACK_PROPOSAL_VOICE_PROFILE: EmailVoiceProfile = {
  id: "fallback-no-supabase",
  created_at: "1970-01-01T00:00:00Z",
  updated_at: "1970-01-01T00:00:00Z",
  name: "Fallback (no Supabase configured)",
  situation: "proposal",
  niche: null,
  offer_track: null,
  is_default: true,
  active: true,
  tone_traits: {},
  voice_description: "Magabiztos, meleg, professzionális hangnem.",
  few_shot_examples: [],
  banned_phrases: [],
  required_elements: [],
  word_count_min: null,
  word_count_max: null,
  signature_block: "Üdvözlettel,\nCompass Marketing",
  visual_style_prompt: null,
  model_override: null,
  created_by: null,
};

export async function POST(req: Request) {
  const parsed = Input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad input" }, { status: 400 });

  if (!process.env.OPENAI_API_KEY) {
    return demoDraft();
  }

  if (isSupabaseConfigured()) {
    const supabase = createServiceClient();
    const { data: deal } = await supabase
      .from("deals")
      .select("*")
      .eq("id", parsed.data.deal_id)
      .single();
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

    const { data: lead } = deal.lead_id
      ? await supabase.from("leads").select("*").eq("id", deal.lead_id).single()
      : { data: null };

    const result = await draft(supabase, {
      client_name: lead?.contact_name ?? null,
      company_name: lead?.company_name ?? "",
      niche: lead?.niche ?? null,
      enrichment_summary: lead?.enrichment_summary ?? null,
      vercel_preview_url: deal.vercel_preview_url,
      package_hint: (lead?.package_interest ?? "business") as "landing" | "business" | "ecommerce",
    });
    await supabase
      .from("deals")
      .update({ proposal_draft: result.email_body })
      .eq("id", deal.id);
    return NextResponse.json(result);
  }

  // Demo path
  return NextResponse.json(
    await draft(null, {
      client_name: "Dr. Kovács Anna",
      company_name: "Kovács Dental",
      niche: "dentist",
      enrichment_summary:
        "Modern fogászati klinika Budapest belvárosában. Mobil-nézet hibás, online időpontfoglalás hiányzik.",
      vercel_preview_url: "https://kovacsdental-preview.vercel.app",
      package_hint: "business",
    }),
  );
}

async function draft(
  supabase: SupabaseClient | null,
  input: Parameters<typeof draftProposalUserPrompt>[0],
): Promise<DraftProposalResult> {
  const profile = supabase
    ? await resolveVoiceProfile(supabase, { situation: "proposal", niche: input.niche })
    : FALLBACK_PROPOSAL_VOICE_PROFILE;

  return callOpenAIStructured({
    system: composeProposalSystem(profile),
    user: draftProposalUserPrompt(input),
    maxTokens: 1500,
    schemaName: "proposal_email",
    jsonSchema: DraftProposalJsonSchema,
    zodSchema: DraftProposalSchema,
  });
}

function demoDraft() {
  const result: DraftProposalResult = {
    email_subject: "Új weboldal koncepció a Kovács Dental számára",
    email_body:
      "<p>Kedves Dr. Kovács Anna!</p><p>Köszönöm, hogy időt szakított a beszélgetésre. Az elmúlt napokban átnéztem a klinika online jelenlétét, és összeraktam egy koncepciót, ami szerintem jól tükrözi a prémium pozícionálást.</p><p>Az új oldal modern, mobilra optimalizált, és integrált online időpontfoglalási rendszerrel készülne — ez a két dolog, ami a jelenlegi weboldalon a legtöbb beteget elveszti. <strong>A javaslat: Business csomag, 850 000 Ft + 25 000 Ft havi karbantartás.</strong></p><p>Ha tetszik az irány, jövő héten le tudunk ülni egy 30 perces hívásra a részletekért.</p><p>Üdvözlettel,<br/>Richárd</p>",
    proposed_package: "business",
    proposed_price_huf: 850000,
    monthly_fee_huf: 25000,
    talking_points: [
      "Premium positioning matches clinic's aesthetic-treatment focus",
      "Online booking is the biggest visible conversion gap",
      "Mobile-fixed site supports referral patient flow",
    ],
  };
  return NextResponse.json(result);
}
