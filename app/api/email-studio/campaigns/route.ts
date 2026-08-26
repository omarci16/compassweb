import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { getEmailCampaigns, isSupabaseConfigured } from "@/lib/data/queries";

const CreateInput = z.object({
  name: z.string().min(1).max(200),
  situation: z.enum(["cold_first_touch", "cold_followup", "re_engagement", "proposal", "deal_followup"]),
  niche: z.string().nullable().optional(),
  offer_track: z.enum(["needs_site", "upgrade", "low_priority"]).nullable().optional(),
  voice_profile_id: z.string().uuid(),
  target_count: z.number().int().nullable().optional(),
  lead_filter: z.record(z.unknown()).optional(),
});

export async function GET() {
  const campaigns = await getEmailCampaigns();
  return NextResponse.json({ ok: true, campaigns });
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
    .from("email_campaigns")
    .insert({ ...parsed.data, status: "draft" })
    .select(
      "id, created_at, updated_at, name, situation, niche, offer_track, voice_profile_id, status, lead_filter, target_count, created_by",
    )
    .single();
  if (error || !data) {
    console.error("create campaign error", error);
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, campaign: data });
}
