// Processes a completed Apify Google Maps run:
//   1. Pulls all dataset items
//   2. Normalises into LeadCandidate shape
//   3. Dedupes against existing leads (gmaps_place_id, phone, website)
//   4. Probes website health in parallel for each candidate
//   5. Computes cold-lead score
//   6. Inserts as `leads` rows (source='cold_outreach', status='new')
//   7. Updates scraping_job metrics
//
// Idempotent: re-running on the same job will skip rows already imported,
// thanks to the unique index on leads.gmaps_place_id.

import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/server";
import {
  getGoogleMapsResults,
  normaliseGoogleMapsItem,
  type LeadCandidate,
} from "@/lib/apify/google-maps";
import { analyzeMany } from "@/lib/prospecting/site-analyzer";
import {
  TOP_THRESHOLD,
  scoreColdLead,
} from "@/lib/ai/scoring/cold-lead-score";
import type { ProspectingNiche } from "@/lib/types/app.types";

const BATCH_SIZE = 50;

export const prospectingProcessResults = inngest.createFunction(
  { id: "prospecting-process-results", retries: 2 },
  { event: "prospecting/results-ready" },
  async ({ event, step }) => {
    const { job_id } = event.data;
    const supabase = createServiceClient();

    const job = await step.run("fetch-job", async () => {
      const { data } = await supabase
        .from("scraping_jobs")
        .select("*")
        .eq("id", job_id)
        .single();
      return data;
    });
    if (!job || !job.apify_run_id) {
      return { ok: false, reason: "Job missing or has no Apify run" };
    }

    await step.run("mark-processing", async () => {
      await supabase
        .from("scraping_jobs")
        .update({ status: "processing" })
        .eq("id", job_id);
    });

    // ----- Pull and normalise raw items -----
    const niche = job.niche as ProspectingNiche;
    const candidates = await step.run("collect-and-normalise", async () => {
      const raws = await getGoogleMapsResults(job.apify_run_id as string);
      return raws
        .map((r) => normaliseGoogleMapsItem(r, niche))
        .filter((c): c is LeadCandidate => c !== null);
    });

    const totalScraped = candidates.length;

    // ----- Dedupe against existing leads -----
    const placeIds = candidates.map((c) => c.gmaps_place_id).filter((x): x is string => !!x);
    const phones = candidates.map((c) => c.gmaps_phone).filter((x): x is string => !!x);

    const existing = await step.run("fetch-existing", async (): Promise<{
      placeIds: string[];
      phones: string[];
    }> => {
      const [byPlace, byPhone] = await Promise.all([
        placeIds.length > 0
          ? supabase
              .from("leads")
              .select("gmaps_place_id")
              .in("gmaps_place_id", placeIds)
          : Promise.resolve({ data: [] as { gmaps_place_id: string | null }[] }),
        phones.length > 0
          ? supabase.from("leads").select("phone").in("phone", phones)
          : Promise.resolve({ data: [] as { phone: string | null }[] }),
      ]);
      return {
        placeIds: ((byPlace.data ?? []) as { gmaps_place_id: string | null }[])
          .map((r) => r.gmaps_place_id)
          .filter((x): x is string => !!x),
        phones: ((byPhone.data ?? []) as { phone: string | null }[])
          .map((r) => r.phone)
          .filter((x): x is string => !!x),
      };
    });

    const placeSet = new Set(existing.placeIds);
    const phoneSet = new Set(existing.phones);

    const novel = candidates.filter(
      (c) =>
        !(c.gmaps_place_id && placeSet.has(c.gmaps_place_id)) &&
        !(c.gmaps_phone && phoneSet.has(c.gmaps_phone)),
    );
    const duplicates = totalScraped - novel.length;

    // ----- Deep site analysis: health + tech stack + pain signals (parallel) -----
    const analyses = await step.run("analyze-sites", async () => {
      const urls = novel.map((c) => c.website_url);
      return analyzeMany(urls, 6);
    });

    // ----- Score + insert in batches -----
    let imported = 0;
    let topTier = 0;
    const topTierIds: string[] = [];

    for (let i = 0; i < novel.length; i += BATCH_SIZE) {
      const batch = novel.slice(i, i + BATCH_SIZE);
      const batchAnalyses = analyses.slice(i, i + BATCH_SIZE);

      const stepResult = await step.run(`insert-batch-${i}`, async () => {
        const rows = batch.map((c, idx) => {
          const analysis = batchAnalyses[idx];
          const score = scoreColdLead({
            niche: c.niche,
            gmaps_rating: c.gmaps_rating,
            gmaps_review_count: c.gmaps_review_count,
            website_url: c.website_url,
            website_health: analysis.health_status,
            social_links_count: Object.keys(c.social_links).length,
            has_email: !!c.email,
            has_phone: !!c.gmaps_phone,
            pain_signals: analysis.pain_signals,
          });
          return {
            company_name: c.company_name,
            email: c.email,
            phone: c.gmaps_phone,
            website_url: c.website_url,
            source: "cold_outreach" as const,
            niche: c.niche,
            status: "new" as const,
            scraping_job_id: job_id,
            gmaps_place_id: c.gmaps_place_id,
            gmaps_category: c.gmaps_category,
            gmaps_address: c.gmaps_address,
            gmaps_city: c.gmaps_city,
            gmaps_rating: c.gmaps_rating,
            gmaps_review_count: c.gmaps_review_count,
            gmaps_phone: c.gmaps_phone,
            gmaps_url: c.gmaps_url,
            social_links: c.social_links,
            has_existing_website: !!c.website_url,
            website_health_status: analysis.health_status,
            website_health_checked_at: new Date().toISOString(),
            website_health_details: analysis.health_details,
            tech_stack: analysis.tech_stack,
            pain_signals: analysis.pain_signals,
            win_probability: score.total,
            win_probability_reasons: score.signals.map((s) => s.label),
            enrichment_status: "pending" as const,
          };
        });

        // Use upsert with ignoreDuplicates to survive race conditions
        // (the unique index on gmaps_place_id would otherwise throw).
        const { data, error } = await supabase
          .from("leads")
          .upsert(rows, {
            onConflict: "gmaps_place_id",
            ignoreDuplicates: true,
          })
          .select("id, win_probability");

        if (error) {
          console.error("[prospecting] insert batch failed", error);
          return { inserted: 0, top: 0, topIds: [] as string[] };
        }
        const insertedRows = data ?? [];
        const topIds = insertedRows
          .filter((r) => (r.win_probability ?? 0) >= TOP_THRESHOLD)
          .map((r) => r.id as string);
        return {
          inserted: insertedRows.length,
          top: topIds.length,
          topIds,
        };
      });

      imported += stepResult.inserted;
      topTier += stepResult.top;
      topTierIds.push(...stepResult.topIds);
    }

    // ----- Fan out: generate pain audit for each top-tier new lead -----
    // We cap at 50 audits per scrape to control AI cost. Top-tier means
    // win_probability >= 70, which already filters aggressively.
    const AUDIT_CAP = 50;
    const auditTargets = topTierIds.slice(0, AUDIT_CAP);
    if (auditTargets.length > 0) {
      await step.sendEvent(
        "fan-out-audits",
        auditTargets.map((lead_id) => ({
          name: "lead/pain-audit" as const,
          data: { lead_id },
        })),
      );
    }

    // ----- Final job metrics -----
    await step.run("finalize", async () => {
      await supabase
        .from("scraping_jobs")
        .update({
          status: "complete",
          finished_at: new Date().toISOString(),
          total_scraped: totalScraped,
          total_duplicates: duplicates,
          total_imported: imported,
          total_top_tier: topTier,
        })
        .eq("id", job_id);
    });

    return {
      ok: true,
      total_scraped: totalScraped,
      duplicates,
      imported,
      top_tier: topTier,
    };
  },
);
