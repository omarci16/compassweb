import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import { inngest } from "@/lib/inngest/client";
import { NICHE_SEARCH_TERMS } from "@/lib/apify/google-maps";
import type { ProspectingNiche } from "@/lib/types/app.types";

const StartJobInput = z.object({
  niche: z.enum(["beauty", "fitness", "dental", "real_estate", "legal", "hospitality", "other"]),
  city: z.string().min(1),
  max_results: z.number().int().min(20).max(2000).default(200),
  // Optional override; if omitted we use the niche defaults
  search_terms: z.array(z.string().min(1)).optional(),
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

  const parsed = StartJobInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Resolve search terms
  const niche = input.niche as ProspectingNiche;
  const searchTerms =
    input.search_terms && input.search_terms.length > 0
      ? input.search_terms
      : NICHE_SEARCH_TERMS[niche];

  if (searchTerms.length === 0) {
    return NextResponse.json(
      { error: "No search terms — provide some explicitly for the 'other' niche" },
      { status: 400 },
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      demo: true,
      message: "Supabase not configured — scraping is a no-op in demo mode.",
    });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("scraping_jobs")
    .insert({
      niche: input.niche,
      city: input.city,
      country: input.country,
      max_results: input.max_results,
      search_terms: searchTerms,
      status: "queued",
      notes: input.notes ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("create scraping job error", error);
    return NextResponse.json(
      { error: "Failed to create scraping job" },
      { status: 500 },
    );
  }

  // Trigger the scrape via Inngest. If Inngest isn't configured, the job
  // stays queued — surfaces clearly in the UI as "needs configuration".
  if (process.env.INNGEST_EVENT_KEY) {
    try {
      await inngest.send({
        name: "prospecting/run-scrape",
        data: { job_id: data.id },
      });
    } catch (err) {
      console.error("failed to send prospecting/run-scrape event", err);
      return NextResponse.json(
        { error: "Job created but failed to start scrape — retry" },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ ok: true, job_id: data.id });
}

export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ jobs: [] });
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scraping_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("list scraping jobs error", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
  return NextResponse.json({ jobs: data });
}
