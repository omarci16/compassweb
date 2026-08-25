// Resolves which Voice Profile a drafting call should use. Automatic batch
// generation always lands here (never on a hand-picked non-default profile),
// so behavior stays deterministic: exact scope match → drop offer_track →
// drop niche → the seeded global default for the situation.
//
// A missing global default is a data-integrity bug, not a soft-fail case —
// migration 0014_email_voice_profiles.sql seeds one for every VoiceSituation,
// so reaching the end of this chain with nothing is only possible if that
// seed row was deleted.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailVoiceProfile, VoiceSituation } from "@/lib/types/app.types";

export interface VoiceProfileScope {
  situation: VoiceSituation;
  niche?: string | null;
  offerTrack?: string | null;
}

export const VOICE_PROFILE_COLUMNS =
  "id, created_at, updated_at, name, situation, niche, offer_track, is_default, active, tone_traits, voice_description, few_shot_examples, banned_phrases, required_elements, word_count_min, word_count_max, signature_block, visual_style_prompt, model_override, created_by";

async function findDefault(
  supabase: SupabaseClient,
  situation: VoiceSituation,
  niche: string | null,
  offerTrack: string | null,
): Promise<EmailVoiceProfile | null> {
  let query = supabase
    .from("email_voice_profiles")
    .select(VOICE_PROFILE_COLUMNS)
    .eq("situation", situation)
    .eq("active", true)
    .eq("is_default", true)
    .limit(1);

  query = niche === null ? query.is("niche", null) : query.eq("niche", niche);
  query =
    offerTrack === null ? query.is("offer_track", null) : query.eq("offer_track", offerTrack);

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error("[email-studio] resolveVoiceProfile query failed", error);
    return null;
  }
  return (data as unknown as EmailVoiceProfile) ?? null;
}

/**
 * Pure fallback order for a scope: exact (niche, offer_track) → drop
 * offer_track → drop niche (the seeded global default). Deduplicated, since a
 * scope that's already universal on one or both axes shouldn't repeat a step.
 * Kept separate from the Supabase I/O below so the ordering itself is
 * unit-testable without mocking a query client.
 */
export function scopeFallbackChain(
  scope: VoiceProfileScope,
): Array<{ niche: string | null; offerTrack: string | null }> {
  const niche = scope.niche ?? null;
  const offerTrack = scope.offerTrack ?? null;

  const steps = [
    { niche, offerTrack },
    { niche, offerTrack: null },
    { niche: null, offerTrack: null },
  ];

  const seen = new Set<string>();
  return steps.filter((step) => {
    const key = `${step.niche ?? "\0"}::${step.offerTrack ?? "\0"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function resolveVoiceProfile(
  supabase: SupabaseClient,
  scope: VoiceProfileScope,
): Promise<EmailVoiceProfile> {
  for (const step of scopeFallbackChain(scope)) {
    const found = await findDefault(supabase, scope.situation, step.niche, step.offerTrack);
    if (found) return found;
  }

  throw new Error(
    `[email-studio] No default Voice Profile found for situation="${scope.situation}" — ` +
      `expected migration 0014_email_voice_profiles.sql to have seeded one.`,
  );
}
