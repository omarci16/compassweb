import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";

const Input = z.object({
  stage: z.enum([
    "concept_pending",
    "concept_ready",
    "visual_sent",
    "proposal_sent",
    "negotiating",
    "closed_won",
    "closed_lost",
  ]),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const parsed = Input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad input" }, { status: 400 });

  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, demo: true });

  const supabase = createClient();
  const { error } = await supabase
    .from("deals")
    .update({ stage: parsed.data.stage })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
