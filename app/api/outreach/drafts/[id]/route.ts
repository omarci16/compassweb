import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";

// Update a draft's status (approve / skip / edit) in the approval queue.
// A human approving here is the ONLY thing that makes a draft sendable
// (CLAUDE.md rule #1). Approving does NOT send — Phase E's queue does, and
// only for status='approved'.
const Input = z.object({
  status: z.enum(["draft", "approved", "scheduled", "sent", "skipped"]).optional(),
  subject: z.string().min(1).max(200).optional(),
  body_html: z.string().min(1).optional(),
  body_text: z.string().min(1).optional(),
  visual_urls: z.array(z.string().url()).max(4).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
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
    return NextResponse.json({ ok: true, demo: true });
  }

  const update: Record<string, unknown> = {};
  if (input.subject !== undefined) update.subject = input.subject;
  if (input.body_html !== undefined) update.body_html = input.body_html;
  if (input.body_text !== undefined) update.body_text = input.body_text;
  if (input.visual_urls !== undefined) update.visual_urls = input.visual_urls;
  if (input.status !== undefined) {
    update.status = input.status;
    update.approved_at = input.status === "approved" ? new Date().toISOString() : null;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("outreach_drafts")
    .update(update)
    .eq("id", params.id)
    .select("id, status")
    .single();
  if (error || !data) {
    console.error("update outreach draft error", error);
    return NextResponse.json({ error: "Failed to update draft" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, draft: data });
}
