// Kicks off the Apify Google Maps scrape for a queued scraping_job.
// Once Apify finishes, the webhook at /api/webhooks/apify (with type=gmaps)
// fires the "prospecting/results-ready" event which drives processing.

import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/server";
import {
  COST_PER_RESULT_USD,
  NICHE_SEARCH_TERMS,
  startGoogleMapsScrape,
} from "@/lib/apify/google-maps";
import type { ProspectingNiche } from "@/lib/types/app.types";

export const prospectingRunScrape = inngest.createFunction(
  { id: "prospecting-run-scrape", retries: 2 },
  { event: "prospecting/run-scrape" },
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
    if (!job) return { ok: false, reason: "Job not found" };

    // Idempotency: don't restart a job that's already running or done
    if (job.status !== "queued") {
      return { ok: false, reason: `Job already in status ${job.status}` };
    }

    // Validate we have an Apify token before doing anything destructive
    if (!process.env.APIFY_API_TOKEN) {
      await step.run("mark-failed-no-token", async () => {
        await supabase
          .from("scraping_jobs")
          .update({
            status: "failed",
            error_message: "APIFY_API_TOKEN not configured",
            finished_at: new Date().toISOString(),
          })
          .eq("id", job_id);
      });
      return { ok: false, reason: "No Apify token" };
    }

    await step.run("mark-running", async () => {
      await supabase
        .from("scraping_jobs")
        .update({
          status: "running",
          started_at: new Date().toISOString(),
        })
        .eq("id", job_id);
    });

    // Resolve search terms: explicit terms in row, else niche default
    const niche = job.niche as ProspectingNiche;
    const searchTerms =
      Array.isArray(job.search_terms) && job.search_terms.length > 0
        ? job.search_terms
        : (NICHE_SEARCH_TERMS[niche] ?? []);

    if (searchTerms.length === 0) {
      await step.run("mark-failed-no-terms", async () => {
        await supabase
          .from("scraping_jobs")
          .update({
            status: "failed",
            error_message: "No search terms resolved for niche",
            finished_at: new Date().toISOString(),
          })
          .eq("id", job_id);
      });
      return { ok: false };
    }

    const webhookUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/apify?type=gmaps&job_id=${job_id}`
      : undefined;

    const run = await step.run("start-apify", async () =>
      startGoogleMapsScrape({
        searchTerms,
        city: job.city,
        country: job.country,
        maxResults: job.max_results,
        webhookUrl,
      }),
    );

    await step.run("persist-run-id", async () => {
      await supabase
        .from("scraping_jobs")
        .update({
          apify_run_id: run.id,
          apify_dataset_id: run.defaultDatasetId,
          status: "collecting",
          estimated_cost_usd: Number(
            (job.max_results * COST_PER_RESULT_USD).toFixed(4),
          ),
        })
        .eq("id", job_id);
    });

    return { ok: true, apify_run_id: run.id };
  },
);
