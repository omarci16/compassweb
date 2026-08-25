import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import {
  DRAFT_LEAD_COLUMNS,
  generateDraftPayload,
} from "@/lib/outreach/generate-draft";
import type { OfferTrack } from "@/lib/types/app.types";

// Create a persisted outreach draft (status='draft') for the approval queue.
// Two modes:
//   - persist-as-is: subject + bodies supplied (from the modal, human-curated)
//   - generate:      only lead_id → the AI drafts it, then we persist
const Input = z.object({
  lead_id: z.string().uuid(),
  subject: z.string().min(1).max(200).optional(),
  body_html: z.string().min(1).optional(),
  body_text: z.string().min(1).optional(),
  track: z.enum(["needs_site", "upgrade", "low_priority"]).optional(),
  visual_urls: z.array(z.string().url()).max(4).optional(),
  visual_concept: z.string().optional(),
});

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
  const input = parsed.data;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, demo: true, message: "No-op in demo mode." });
  }

  const supabase = createServiceClient();
  const persistAsIs = input.subject && input.body_html && input.body_text;

  let row: Record<string, unknown>;
  if (persistAsIs) {
    row = {
      lead_id: input.lead_id,
      track: (input.track ?? "needs_site") as OfferTrack,
      subject: input.subject,
      body_html: input.body_html,
      body_text: input.body_text,
      visual_urls: input.visual_urls ?? [],
      visual_concept: input.visual_concept ?? null,
      touch_number: 1,
      status: "draft",
    };
  } else {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 });
    }
    const { data: lead, error } = await supabase
      .from("leads")
      .select(DRAFT_LEAD_COLUMNS)
      .eq("id", input.lead_id)
      .single();
    if (error || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    try {
      row = { ...(await generateDraftPayload(supabase, lead as never)) };
    } catch (err) {
      console.error("draft generation failed", err);
      return NextResponse.json({ error: "AI request failed" }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from("outreach_drafts")
    .insert(row)
    .select("id, lead_id, track, subject, status")
    .single();
  if (error || !data) {
    console.error("insert outreach draft error", error);
    return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, draft: data });
}
