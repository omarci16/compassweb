import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import { callOpenAIStructured } from "@/lib/openai/client";
import {
  DraftFollowupJsonSchema,
  DraftFollowupSchema,
  composeFollowupSystem,
  draftFollowupUserPrompt,
} from "@/lib/ai/prompts/draft-followup";
import { resolveVoiceProfile } from "@/lib/email-studio/resolve-voice-profile";
import { differenceInDays } from "date-fns";
import type { DraftFollowupResult } from "@/lib/types/app.types";

const Input = z.object({ deal_id: z.string() });

export async function POST(req: Request) {
  const parsed = Input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad input" }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      email_subject: "Egy gyors követés a koncepcióval kapcsolatban",
      email_body:
        "Csak egy gyors üzenet — látták a múlt heti koncepciót? Bármilyen visszajelzés érdekel, akár az is, ha most nem aktuális. Köszönöm!",
    } satisfies DraftFollowupResult);
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

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

  const days = deal.proposal_sent_at
    ? differenceInDays(new Date(), new Date(deal.proposal_sent_at))
    : 0;

  const profile = await resolveVoiceProfile(supabase, {
    situation: "deal_followup",
    niche: lead?.niche ?? null,
  });

  const result = await callOpenAIStructured({
    system: composeFollowupSystem(profile),
    user: draftFollowupUserPrompt({
      client_name: lead?.contact_name ?? null,
      company_name: lead?.company_name ?? "",
      days_since_proposal: days,
      followup_count: deal.followup_count,
      vercel_preview_url: deal.vercel_preview_url,
      proposed_package: deal.proposed_package,
    }),
    maxTokens: 400,
    schemaName: "deal_followup_email",
    jsonSchema: DraftFollowupJsonSchema,
    zodSchema: DraftFollowupSchema,
  });
  return NextResponse.json(result);
}
