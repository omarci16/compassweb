import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { getVoiceProfiles, isSupabaseConfigured } from "@/lib/data/queries";
import { VOICE_PROFILE_COLUMNS } from "@/lib/email-studio/resolve-voice-profile";

const VOICE_SITUATIONS = [
  "cold_first_touch",
  "cold_followup",
  "re_engagement",
  "proposal",
  "deal_followup",
] as const;

const FewShotExampleInput = z.object({
  subject: z.string(),
  body_html: z.string(),
  note: z.string().optional(),
});

const CreateInput = z.object({
  name: z.string().min(1).max(200),
  situation: z.enum(VOICE_SITUATIONS),
  niche: z.string().nullable().optional(),
  offer_track: z.enum(["needs_site", "upgrade", "low_priority"]).nullable().optional(),
  is_default: z.boolean().optional(),
  active: z.boolean().optional(),
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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const situation = url.searchParams.get("situation") as (typeof VOICE_SITUATIONS)[number] | null;
  const profiles = await getVoiceProfiles({ situation: situation ?? undefined });
  return NextResponse.json({ ok: true, profiles });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = CreateInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, demo: true, message: "No-op in demo mode." });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("email_voice_profiles")
    .insert({ ...parsed.data, is_default: false }) // new profiles are never auto-default
    .select(VOICE_PROFILE_COLUMNS)
    .single();
  if (error || !data) {
    console.error("create voice profile error", error);
    return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, profile: data });
}
