import { NextResponse } from "next/server";
import { z } from "zod";
import { inngest } from "@/lib/inngest/client";
import { isSupabaseConfigured } from "@/lib/data/queries";

// Fire-and-forget: dispatch a background batch that drafts AI outreach for the
// top routed cold leads into the approval queue. Mirrors the backfill route
// shape (dispatch an Inngest event; the function does the timeout-free work).
const Input = z.object({
  track: z.enum(["needs_site", "upgrade"]).optional(),
  limit: z.number().int().min(1).max(40).optional(),
  min_score: z.number().int().min(0).max(100).optional(),
});

export async function POST(req: Request) {
  const parsed = Input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad input" }, { status: 400 });
  }
  if (!isSupabaseConfigured() || !process.env.INNGEST_EVENT_KEY) {
    return NextResponse.json(
      { error: "Draft generation needs Supabase + Inngest configured." },
      { status: 503 },
    );
  }

  await inngest.send({
    name: "outreach/generate-drafts",
    data: {
      track: parsed.data.track,
      limit: parsed.data.limit,
      min_score: parsed.data.min_score,
    },
  });

  return NextResponse.json({ ok: true, status: "queued" });
}
