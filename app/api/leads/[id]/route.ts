import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";

const PatchInput = z
  .object({
    status: z
      .enum([
        "new",
        "enriching",
        "qualified",
        "visual_sent",
        "proposal_sent",
        "negotiating",
        "won",
        "lost",
        "archived",
      ])
      .optional(),
    loss_reason: z
      .enum(["price", "timing", "competitor", "no_response", "out_of_scope", "other"])
      .nullable()
      .optional(),
    loss_notes: z.string().nullable().optional(),
    internal_notes: z.string().nullable().optional(),
    first_contact_at: z.string().datetime().nullable().optional(),
  })
  .strict();

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const parsed = PatchInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad input" }, { status: 400 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, demo: true });

  const supabase = createClient();
  const update: Record<string, unknown> = { ...parsed.data };

  // First-time speed-to-lead capture
  if (parsed.data.first_contact_at !== undefined && parsed.data.first_contact_at) {
    const { data: lead } = await supabase
      .from("leads")
      .select("created_at, first_contact_at")
      .eq("id", params.id)
      .single();
    if (lead && !lead.first_contact_at) {
      const minutes = Math.floor(
        (new Date(parsed.data.first_contact_at).getTime() - new Date(lead.created_at).getTime()) / 60_000,
      );
      update.speed_to_lead_minutes = Math.max(0, minutes);
    }
  }

  const { error } = await supabase.from("leads").update(update).eq("id", params.id);
  if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
