import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";

const PatchInput = z
  .object({
    blocker: z.string().nullable().optional(),
    blocker_set_at: z.string().datetime().nullable().optional(),
    waiting_on: z.enum(["us", "client"]).optional(),
    internal_notes: z.string().nullable().optional(),
    staging_url: z.string().url().nullable().optional(),
    launch_url: z.string().url().nullable().optional(),
  })
  .strict();

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const parsed = PatchInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad input" }, { status: 400 });

  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, demo: true });

  const supabase = createClient();
  const { error } = await supabase
    .from("projects")
    .update(parsed.data)
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
