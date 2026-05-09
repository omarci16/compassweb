import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { crawlWebsite } from "@/lib/apify/client";
import { isSupabaseConfigured } from "@/lib/data/queries";

const Input = z.object({ lead_id: z.string().uuid() });

export async function POST(req: Request) {
  const parsed = Input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad input" }, { status: 400 });
  if (!isSupabaseConfigured() || !process.env.APIFY_API_TOKEN) {
    return NextResponse.json({ error: "Apify not configured" }, { status: 503 });
  }

  const supabase = createServiceClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, website_url, enrichment_status")
    .eq("id", parsed.data.lead_id)
    .single();

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (!lead.website_url) {
    await supabase
      .from("leads")
      .update({ enrichment_status: "failed", enrichment_summary: "No website URL provided." })
      .eq("id", lead.id);
    return NextResponse.json({ ok: true, status: "failed" });
  }

  const run = await crawlWebsite(lead.website_url);
  await supabase
    .from("leads")
    .update({ enrichment_status: "running" })
    .eq("id", lead.id);

  return NextResponse.json({ ok: true, run_id: run.id, status: run.status });
}
