import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import { isSupabaseConfigured } from "@/lib/data/queries";

// Kick the send queue: drains APPROVED drafts through rotated inboxes. The
// actual sending (caps, spacing, suppression) happens in the Inngest function;
// this route just fires the event. Never sends anything itself.
export async function POST() {
  if (!isSupabaseConfigured() || !process.env.INNGEST_EVENT_KEY) {
    return NextResponse.json(
      { error: "Sending needs Supabase + Inngest configured." },
      { status: 503 },
    );
  }
  await inngest.send({ name: "outreach/send-queue", data: {} });
  return NextResponse.json({ ok: true, status: "queued" });
}
