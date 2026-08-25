// Generate one AI outreach draft payload for a lead — the shared core behind
// both the single "generate + persist" route and the batch generator. Resolves
// the applicable Voice Profile, composes the immutable structural rules with
// its trainable voice, grounds the upgrade pitch in verified signals, expands
// spintax, and returns a row ready to insert into outreach_drafts.
//
// Never sends. Persistence + human approval happen at the call site.

import type { SupabaseClient } from "@supabase/supabase-js";
import { callOpenAIStructured } from "@/lib/openai/client";
import {
  ColdOutreachJsonSchema,
  ColdOutreachSchema,
  coldFollowupUserPrompt,
  coldOutreachUserPrompt,
  composeColdFollowupSystem,
  composeColdOutreachSystem,
} from "@/lib/ai/prompts/cold-outreach";
import { renderDraftBody, verifiedSignalLabels } from "@/lib/outreach/draft-content";
import { resolveVoiceProfile } from "@/lib/email-studio/resolve-voice-profile";
import type { OfferTrack, PainSignal, ProspectingNiche } from "@/lib/types/app.types";

export interface GenerateDraftOptions {
  /** 1 = first cold email; 2/3 = follow-up touches. */
  touchNumber?: number;
  /** Links the draft to its re_engagement_sequences row. */
  sequenceId?: string | null;
  /** Stamped onto the draft when generated through a Campaign's batch push. */
  campaignId?: string | null;
}

export interface DraftLeadInput {
  id: string;
  company_name: string;
  contact_name: string | null;
  niche: string | null;
  gmaps_city: string | null;
  gmaps_category: string | null;
  website_url: string | null;
  pain_audit: string | null;
  enrichment_summary: string | null;
  offer_track: string | null;
  pain_signals: unknown;
}

export interface OutreachDraftInsert {
  lead_id: string;
  track: OfferTrack;
  subject: string;
  body_html: string;
  body_text: string;
  visual_urls: string[];
  visual_concept: string;
  spintax_variant: string | null;
  touch_number: number;
  sequence_id: string | null;
  campaign_id: string | null;
  voice_profile_id: string;
  status: "draft";
  ai_meta: {
    primary_pain_point_used: string;
    personalization_hook: string;
    tone_notes: string;
  };
}

export async function generateDraftPayload(
  supabase: SupabaseClient,
  lead: DraftLeadInput,
  opts: GenerateDraftOptions = {},
): Promise<OutreachDraftInsert> {
  const track = ((lead.offer_track as OfferTrack | null) ?? "needs_site") as OfferTrack;
  const touchNumber = opts.touchNumber ?? 1;
  const isFollowup = touchNumber > 1;
  const verified = verifiedSignalLabels(
    Array.isArray(lead.pain_signals) ? (lead.pain_signals as unknown as PainSignal[]) : [],
  );

  const profile = await resolveVoiceProfile(supabase, {
    situation: isFollowup ? "cold_followup" : "cold_first_touch",
    niche: lead.niche,
    offerTrack: isFollowup ? null : track,
  });

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
    system: isFollowup ? composeColdFollowupSystem(profile) : composeColdOutreachSystem(track, profile),
    user: isFollowup
      ? coldFollowupUserPrompt({ ...promptInput, touch_number: touchNumber })
      : coldOutreachUserPrompt(promptInput),
    maxTokens: isFollowup ? 800 : 1400,
    schemaName: "cold_outreach_email",
    jsonSchema: ColdOutreachJsonSchema,
    zodSchema: ColdOutreachSchema,
  });

  const rendered = renderDraftBody(result.email_body_html, result.email_body_text);

  return {
    lead_id: lead.id,
    track,
    subject: result.email_subject,
    body_html: rendered.body_html,
    body_text: rendered.body_text,
    visual_urls: [],
    visual_concept: result.visual_concept,
    spintax_variant: rendered.spintax_variant,
    touch_number: touchNumber,
    sequence_id: opts.sequenceId ?? null,
    campaign_id: opts.campaignId ?? null,
    voice_profile_id: profile.id,
    status: "draft",
    ai_meta: {
      primary_pain_point_used: result.primary_pain_point_used,
      personalization_hook: result.personalization_hook,
      tone_notes: result.tone_notes,
    },
  };
}

// Columns to select from `leads` to satisfy DraftLeadInput. Keeps the two
// call-site queries in sync (no select *).
export const DRAFT_LEAD_COLUMNS =
  "id, company_name, contact_name, niche, gmaps_city, gmaps_category, website_url, pain_audit, enrichment_summary, offer_track, pain_signals";
