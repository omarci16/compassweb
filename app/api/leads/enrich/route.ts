import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";
import { isSupabaseConfigured } from "@/lib/data/queries";

const Input = z.object({ lead_id: z.string().uuid() });

/**
 * Manual "re-enrich this lead" trigger. Delegates to the enrich-lead Inngest
 * function (which owns crawl → collect → summarize) instead of starting a crawl
 * with no collector — the old direct-crawl path left leads stuck in "running".
 */
export async function POST(req: Request) {
  const parsed = Input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad input" }, { status: 400 });
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  if (!process.env.INNGEST_EVENT_KEY) {
    return NextResponse.json(
      { error: "Enrichment needs Inngest configured (INNGEST_EVENT_KEY)." },
      { status: 503 },
    );
  }

  const supabase = createServiceClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, website_url")
    .eq("id", parsed.data.lead_id)
    .single();

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  await supabase
    .from("leads")
    .update({ enrichment_status: "running" })
    .eq("id", lead.id);

  await inngest.send({
    name: "lead/created",
    data: { lead_id: lead.id, website_url: lead.website_url },
  });

  return NextResponse.json({ ok: true, status: "running" });
}
