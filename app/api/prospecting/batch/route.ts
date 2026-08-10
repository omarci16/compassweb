import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import { inngest } from "@/lib/inngest/client";
import { NICHE_SEARCH_TERMS } from "@/lib/apify/google-maps";
import type { ProspectingNiche } from "@/lib/types/app.types";

// One-click BATCH launcher: fan a single click into (niches × cities) scraping
// jobs. Manual-trigger still, but produces volume. Reuses the exact insert +
// prospecting/run-scrape dispatch as the single-job route.
const BatchInput = z.object({
  // 'other' is excluded: it has no built-in search terms, so it can't be batched.
  niches: z
    .array(z.enum(["beauty", "fitness", "dental", "real_estate", "legal", "hospitality"]))
    .min(1),
  cities: z.array(z.string().min(1)).min(1),
  max_results: z.number().int().min(20).max(2000).default(200),
  country: z.string().default("Hungary"),
  notes: z.string().nullish(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BatchInput.safeParse(body);
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
      message: "Supabase not configured — batch scraping is a no-op in demo mode.",
      planned_jobs: input.niches.length * input.cities.length,
    });
  }

  // Build one row per (niche × city).
  const rows = input.niches.flatMap((niche) => {
    const searchTerms = NICHE_SEARCH_TERMS[niche as ProspectingNiche];
    if (!searchTerms || searchTerms.length === 0) return [];
    return input.cities.map((city) => ({
      niche,
      city,
      country: input.country,
      max_results: input.max_results,
      search_terms: searchTerms,
      status: "queued" as const,
      notes: input.notes ?? null,
    }));
  });

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No jobs to create — check niches/cities." },
      { status: 400 },
    );
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("scraping_jobs")
    .insert(rows)
    .select("id");

  if (error || !data) {
    console.error("create batch scraping jobs error", error);
    return NextResponse.json(
      { error: "Failed to create scraping jobs" },
      { status: 500 },
    );
  }

  // Dispatch each job. If Inngest isn't configured, jobs stay queued (surfaced
  // in the UI as "needs configuration"), mirroring the single-job route.
  let dispatched = 0;
  if (process.env.INNGEST_EVENT_KEY) {
    try {
      await inngest.send(
        data.map((j) => ({
          name: "prospecting/run-scrape" as const,
          data: { job_id: j.id },
        })),
      );
      dispatched = data.length;
    } catch (err) {
      console.error("failed to send batch prospecting/run-scrape events", err);
      return NextResponse.json(
        { error: "Jobs created but failed to start scrapes — retry", created: data.length },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ ok: true, created: data.length, dispatched });
}
