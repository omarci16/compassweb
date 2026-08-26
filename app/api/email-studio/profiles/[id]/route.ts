import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import { VOICE_PROFILE_COLUMNS } from "@/lib/email-studio/resolve-voice-profile";

const FewShotExampleInput = z.object({
  subject: z.string(),
  body_html: z.string(),
  note: z.string().optional(),
});

const UpdateInput = z.object({
  name: z.string().min(1).max(200).optional(),
  active: z.boolean().optional(),
  is_default: z.boolean().optional(),
  tone_traits: z.record(z.string()).optional(),
  voice_description: z.string().nullable().optional(),
  few_shot_examples: z.array(FewShotExampleInput).optional(),
  banned_phrases: z.array(z.string()).optional(),
  required_elements: z.array(z.string()).optional(),
  word_count_min: z.number().int().nullable().optional(),
  word_count_max: z.number().int().nullable().optional(),
  signature_block: z.string().nullable().optional(),
  visual_style_prompt: z.string().nullable().optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("email_voice_profiles")
    .select(VOICE_PROFILE_COLUMNS)
    .eq("id", params.id)
    .single();
  if (error || !data) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  return NextResponse.json({ ok: true, profile: data });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = UpdateInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;
  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, demo: true });
  }

  const supabase = createServiceClient();

  // Promoting this profile to the default for its scope: the unique partial
  // index (email_voice_profiles_one_default_per_scope) only allows one active
  // default per (situation, niche, offer_track), so demote any current holder
  // first. Low-concurrency two-person tool — a sequential read+update is fine,
  // no transaction needed.
  if (input.is_default === true) {
    const { data: current } = await supabase
      .from("email_voice_profiles")
      .select("id, situation, niche, offer_track")
      .eq("id", params.id)
      .single();
    if (current) {
      let demote = supabase
        .from("email_voice_profiles")
        .update({ is_default: false })
        .eq("situation", current.situation)
        .eq("is_default", true)
        .neq("id", params.id);
      demote = current.niche === null ? demote.is("niche", null) : demote.eq("niche", current.niche);
      demote =
        current.offer_track === null
          ? demote.is("offer_track", null)
          : demote.eq("offer_track", current.offer_track);
      await demote;
    }
  }

  const { data, error } = await supabase
    .from("email_voice_profiles")
    .update(input)
    .eq("id", params.id)
    .select(VOICE_PROFILE_COLUMNS)
    .single();
  if (error || !data) {
    console.error("update voice profile error", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, profile: data });
}
