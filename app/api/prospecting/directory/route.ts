import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import { inngest } from "@/lib/inngest/client";
import { FOGORVOSKERESO_KEY } from "@/lib/prospecting/sources/fogorvoskereso";

// Directory scrape launcher (Phase K). Unlike the Google Maps route there is
// no Apify run to start — the directory reader fetches inline — so this
// dispatches `prospecting/results-ready` directly and the shared import path
// takes over from there.
const DirectoryInput = z.object({
  source: z.enum([FOGORVOSKERESO_KEY]).default(FOGORVOSKERESO_KEY),
  // fogorvoskereso is a dentist registry; the niche is fixed but kept explicit
  // so a second directory can reuse this route.
  niche: z.enum(["dental"]).default("dental"),
  city: z.string().min(1).nullish(),
  max_results: z.number().int().min(20).max(2000).default(200),
  notes: z.string().nullish(),
});

export async function POST(req: Request) {
  let body: unknown = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = DirectoryInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      demo: true,
      message: "Supabase not configured — directory scraping is a no-op in demo mode.",
    });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("scraping_jobs")
    .insert({
      niche: input.niche,
      city: input.city ?? "Hungary",
      country: "Hungary",
      max_results: input.max_results,
      // No Apify search terms — the directory is enumerated, not searched.
      search_terms: [input.source],
      source_type: "directory",
      source_key: input.source,
      apify_actor_id: input.source,
      status: "queued",
      notes: input.notes ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("create directory scraping job error", error);
    return NextResponse.json({ error: "Failed to create scraping job" }, { status: 500 });
  }

  if (!process.env.INNGEST_EVENT_KEY) {
    // Job stays queued and is surfaced in the UI as "needs configuration",
    // mirroring the Google Maps routes.
    return NextResponse.json({ ok: true, job_id: data.id, dispatched: false });
  }

  try {
    await inngest.send({
      name: "prospecting/results-ready" as const,
      data: { job_id: data.id },
    });
  } catch (err) {
    console.error("failed to send prospecting/results-ready event", err);
    return NextResponse.json(
      { error: "Job created but failed to start — retry", job_id: data.id },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, job_id: data.id, dispatched: true });
}
