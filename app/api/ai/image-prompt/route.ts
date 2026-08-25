import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import { callOpenAI } from "@/lib/openai/client";
import {
  composeImagePromptSystem,
  imagePromptUserPrompt,
} from "@/lib/ai/prompts/image-prompt";
import { resolveVoiceProfile } from "@/lib/email-studio/resolve-voice-profile";
import type { ProspectingNiche } from "@/lib/types/app.types";

const Input = z.object({
  lead_id: z.string().uuid(),
  visual_concept: z.string().min(10),
});

/**
 * Generates an English image-generation prompt the user pastes into
 * ChatGPT Image Gen (or comparable). The output is plain text, ready to copy.
 */
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
  const { lead_id, visual_concept } = parsed.data;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      demo: true,
      prompt:
        "Demo mode — configure Supabase + OpenAI to generate a real image prompt.",
    });
  }

  const supabase = createServiceClient();
  const { data: lead, error } = await supabase
    .from("leads")
    .select(
      "id, company_name, niche, gmaps_city, gmaps_category, website_url, enrichment_summary, package_interest, offer_track",
    )
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
    const profile = await resolveVoiceProfile(supabase, {
      situation: "cold_first_touch",
      niche: lead.niche,
      offerTrack: lead.offer_track,
    });

    const text = await callOpenAI({
      system: composeImagePromptSystem(profile),
      user: imagePromptUserPrompt({
        company_name: lead.company_name,
        niche: (lead.niche as ProspectingNiche) ?? null,
        city: lead.gmaps_city,
        category: lead.gmaps_category,
        website_url: lead.website_url,
        enrichment_summary: lead.enrichment_summary,
        visual_concept,
        package_hint: lead.package_interest,
      }),
      maxTokens: 700,
    });

    return NextResponse.json({ ok: true, prompt: text.trim() });
  } catch (err) {
    console.error("image-prompt generation failed", err);
    return NextResponse.json(
      { error: "AI request failed" },
      { status: 500 },
    );
  }
}
