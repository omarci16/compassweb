import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import { inngest } from "@/lib/inngest/client";

const Input = z.object({ url: z.string().url() });

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const parsed = Input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad URL" }, { status: 400 });

  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, demo: true });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("deals")
    .update({
      vercel_preview_url: parsed.data.url,
      vercel_preview_attached_at: new Date().toISOString(),
      vercel_preview_attached_by: user?.id ?? null,
      stage: "concept_ready",
    })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });

  if (process.env.INNGEST_EVENT_KEY) {
    void inngest.send({
      name: "deal/visual-attached",
      data: { deal_id: params.id },
    });
  }

  return NextResponse.json({ ok: true });
}
