import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import { callOpenAIStructured } from "@/lib/openai/client";
import {
  ColdOutreachJsonSchema,
  ColdOutreachSchema,
  coldFollowupUserPrompt,
  coldOutreachUserPrompt,
  composeColdFollowupSystem,
  composeColdOutreachSystem,
} from "@/lib/ai/prompts/cold-outreach";
import {
  DraftProposalJsonSchema,
  DraftProposalSchema,
  composeProposalSystem,
  draftProposalUserPrompt,
} from "@/lib/ai/prompts/draft-proposal";
import {
  DraftFollowupJsonSchema,
  DraftFollowupSchema,
  composeFollowupSystem,
  draftFollowupUserPrompt,
} from "@/lib/ai/prompts/draft-followup";
import { DRAFT_LEAD_COLUMNS, type DraftLeadInput } from "@/lib/outreach/generate-draft";
import { verifiedSignalLabels } from "@/lib/outreach/draft-content";
import { findSampleLead } from "@/lib/email-studio/sample-leads";
import type { EmailVoiceProfile, OfferTrack, PainSignal, ProspectingNiche } from "@/lib/types/app.types";

// Loosened shape for the sandbox: an unsaved, in-progress profile. Every
// field the compose functions actually read must be present; scope/metadata
// fields (id, situation itself, etc.) don't matter for prompt composition.
const ProfileInput = z.object({
  situation: z.enum(["cold_first_touch", "cold_followup", "re_engagement", "proposal", "deal_followup"]),
  tone_traits: z.record(z.string()).optional(),
  voice_description: z.string().nullable().optional(),
  few_shot_examples: z
    .array(z.object({ subject: z.string(), body_html: z.string(), note: z.string().optional() }))
    .optional(),
  banned_phrases: z.array(z.string()).optional(),
  required_elements: z.array(z.string()).optional(),
  word_count_min: z.number().nullable().optional(),
  word_count_max: z.number().nullable().optional(),
  signature_block: z.string().nullable().optional(),
  visual_style_prompt: z.string().nullable().optional(),
});

const Input = z.object({
  profile: ProfileInput,
  lead_id: z.string().uuid().optional(),
  sample_lead_id: z.string().optional(),
});

function toFullProfile(p: z.infer<typeof ProfileInput>): EmailVoiceProfile {
  return {
    id: "sandbox-preview",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    name: "Sandbox preview",
    situation: p.situation,
    niche: null,
    offer_track: null,
    is_default: false,
    active: true,
    tone_traits: p.tone_traits ?? {},
    voice_description: p.voice_description ?? null,
    few_shot_examples: p.few_shot_examples ?? [],
    banned_phrases: p.banned_phrases ?? [],
    required_elements: p.required_elements ?? [],
    word_count_min: p.word_count_min ?? null,
    word_count_max: p.word_count_max ?? null,
    signature_block: p.signature_block ?? null,
    visual_style_prompt: p.visual_style_prompt ?? null,
    model_override: null,
    created_by: null,
  };
}

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
  const { profile: profileInput, lead_id, sample_lead_id } = parsed.data;
  const profile = toFullProfile(profileInput);

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  let lead: DraftLeadInput | null = sample_lead_id ? findSampleLead(sample_lead_id) : null;

  if (!lead && lead_id) {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("leads")
      .select(DRAFT_LEAD_COLUMNS)
      .eq("id", lead_id)
      .single();
    lead = (data as unknown as DraftLeadInput) ?? null;
  }

  if (!lead) {
    return NextResponse.json(
      { error: "Provide either lead_id or sample_lead_id" },
      { status: 400 },
    );
  }

  try {
    if (profileInput.situation === "cold_first_touch" || profileInput.situation === "cold_followup") {
      const track = ((lead.offer_track as OfferTrack | null) ?? "needs_site") as OfferTrack;
      const isFollowup = profileInput.situation === "cold_followup";
      const verified = verifiedSignalLabels(
        Array.isArray(lead.pain_signals) ? (lead.pain_signals as unknown as PainSignal[]) : [],
      );
      const promptInput = {
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
      };
      const result = await callOpenAIStructured({
        system: isFollowup
          ? composeColdFollowupSystem(profile)
          : composeColdOutreachSystem(track, profile),
        user: isFollowup
          ? coldFollowupUserPrompt({ ...promptInput, touch_number: 2 })
          : coldOutreachUserPrompt(promptInput),
        maxTokens: isFollowup ? 800 : 1400,
        schemaName: "cold_outreach_email",
        jsonSchema: ColdOutreachJsonSchema,
        zodSchema: ColdOutreachSchema,
      });
      return NextResponse.json({ ok: true, situation: profileInput.situation, result });
    }

    if (profileInput.situation === "proposal") {
      const result = await callOpenAIStructured({
        system: composeProposalSystem(profile),
        user: draftProposalUserPrompt({
          client_name: lead.contact_name,
          company_name: lead.company_name,
          niche: lead.niche,
          enrichment_summary: lead.enrichment_summary,
          vercel_preview_url: null,
          package_hint: "business",
        }),
        maxTokens: 1500,
        schemaName: "proposal_email",
        jsonSchema: DraftProposalJsonSchema,
        zodSchema: DraftProposalSchema,
      });
      return NextResponse.json({ ok: true, situation: profileInput.situation, result });
    }

    if (profileInput.situation === "deal_followup") {
      const result = await callOpenAIStructured({
        system: composeFollowupSystem(profile),
        user: draftFollowupUserPrompt({
          client_name: lead.contact_name,
          company_name: lead.company_name,
          days_since_proposal: 3,
          followup_count: 0,
          vercel_preview_url: null,
          proposed_package: "business",
        }),
        maxTokens: 400,
        schemaName: "deal_followup_email",
        jsonSchema: DraftFollowupJsonSchema,
        zodSchema: DraftFollowupSchema,
      });
      return NextResponse.json({ ok: true, situation: profileInput.situation, result });
    }

    // re_engagement: no drafting pipeline is wired up yet (the Inngest
    // sequence is still a touch-scheduling stub) — nothing to preview.
    return NextResponse.json(
      {
        error:
          "A re-engagement (30/60/90 nap) piszkozatgenerálás még nincs bekötve — csak a hangnem-profil van előkészítve.",
      },
      { status: 501 },
    );
  } catch (err) {
    console.error("email-studio preview-draft failed", err);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}
