import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/server";
import { crawlWebsite, getCrawlResults } from "@/lib/apify/client";
import { callClaude } from "@/lib/ai/anthropic";
import {
  ENRICH_SUMMARY_SYSTEM,
  enrichSummaryUserPrompt,
} from "@/lib/ai/prompts/enrich-summary";

export const enrichLead = inngest.createFunction(
  { id: "enrich-lead", retries: 2 },
  { event: "lead/created" },
  async ({ event, step }) => {
    const { lead_id, website_url } = event.data;
    if (!website_url) {
      await step.run("mark-failed", async () => {
        const supabase = createServiceClient();
        await supabase
          .from("leads")
          .update({
            enrichment_status: "failed",
            enrichment_summary: "No website URL provided.",
          })
          .eq("id", lead_id);
      });
      await step.sendEvent("score", { name: "lead/enriched", data: { lead_id } });
      return;
    }

    const run = await step.run("crawl-start", async () => crawlWebsite(website_url));

    // Wait for crawl to finish (Apify usually completes in <60s for 5 pages)
    const items = await step.run("crawl-collect", async () => {
      let attempts = 0;
      while (attempts < 30) {
        const r = await getCrawlResults(run.id);
        if (r.length > 0) return r;
        await new Promise((res) => setTimeout(res, 4000));
        attempts++;
      }
      return [] as unknown[];
    });

    const summary = await step.run("summarize", async () => {
      if (!process.env.ANTHROPIC_API_KEY || items.length === 0)
        return "Enrichment data unavailable.";
      return callClaude({
        system: ENRICH_SUMMARY_SYSTEM,
        user: enrichSummaryUserPrompt(items.slice(0, 5)),
        maxTokens: 400,
        temperature: 0.3,
      });
    });

    await step.run("persist", async () => {
      const supabase = createServiceClient();
      await supabase
        .from("leads")
        .update({
          enrichment_data: items,
          enrichment_summary: summary,
          enrichment_status: items.length > 0 ? "complete" : "failed",
        })
        .eq("id", lead_id);
    });

    await step.sendEvent("score", { name: "lead/enriched", data: { lead_id } });
  },
);
