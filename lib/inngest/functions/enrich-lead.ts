import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/server";
import { crawlWebsite, getCrawlResults, getRunStatus } from "@/lib/apify/client";
import { callClaude } from "@/lib/ai/anthropic";
import {
  ENRICH_SUMMARY_SYSTEM,
  enrichSummaryUserPrompt,
  looksLikeBlockedPage,
  type EnrichPage,
} from "@/lib/ai/prompts/enrich-summary";
import type { EnrichmentStatus } from "@/lib/types/app.types";

const TERMINAL = ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT", "TIMING-OUT"];

function toPages(items: Record<string, unknown>[]): EnrichPage[] {
  return items.map((it) => ({
    url: typeof it.url === "string" ? it.url : "",
    title: typeof it.title === "string" ? it.title : undefined,
    text:
      (typeof it.text === "string" && it.text) ||
      (typeof it.markdown === "string" && it.markdown) ||
      "",
  }));
}

export const enrichLead = inngest.createFunction(
  { id: "enrich-lead", retries: 2 },
  { event: "lead/created" },
  async ({ event, step }) => {
    const { lead_id, website_url } = event.data;

    const persist = (status: EnrichmentStatus, summary: string, items: unknown[]) =>
      step.run(`persist-${status}`, async () => {
        const supabase = createServiceClient();
        await supabase
          .from("leads")
          .update({
            enrichment_data: items,
            enrichment_summary: summary,
            enrichment_status: status,
          })
          .eq("id", lead_id);
      });

    if (!website_url) {
      await persist("crawl_failed", "No website URL provided.", []);
      await step.sendEvent("score", { name: "lead/enriched", data: { lead_id } });
      return { ok: true, status: "crawl_failed" };
    }

    const run = await step.run("crawl-start", async () => crawlWebsite(website_url));

    // Poll RUN STATUS to completion (not "first item lands") so we distinguish a
    // failed/blocked crawl from a genuinely thin site.
    const collected = await step.run("crawl-collect", async () => {
      let status: string | undefined;
      for (let i = 0; i < 30; i++) {
        status = await getRunStatus(run.id);
        if (status && TERMINAL.includes(status)) break;
        await new Promise((res) => setTimeout(res, 4000));
      }
      if (status !== "SUCCEEDED") {
        return { ok: false as const, items: [] as Record<string, unknown>[] };
      }
      const items = await getCrawlResults(run.id);
      return { ok: true as const, items };
    });

    if (!collected.ok) {
      await persist("crawl_failed", "A crawl nem fejeződött be sikeresen.", []);
      await step.sendEvent("score", { name: "lead/enriched", data: { lead_id } });
      return { ok: true, status: "crawl_failed" };
    }

    const pages = toPages(collected.items);
    const usable = pages.filter((p) => p.text.trim().length > 0 && !looksLikeBlockedPage(p.text));
    const anyBlocked = pages.some((p) => looksLikeBlockedPage(p.text));

    if (usable.length === 0) {
      const status: EnrichmentStatus = anyBlocked ? "blocked" : "empty_site";
      const summary = anyBlocked
        ? "A crawl bot-védelembe / cookie-falba ütközött — nem a valós tartalom."
        : "Alig van tartalom az oldalon.";
      await persist(status, summary, collected.items);
      await step.sendEvent("score", { name: "lead/enriched", data: { lead_id } });
      return { ok: true, status };
    }

    const summary = await step.run("summarize", async () => {
      if (!process.env.ANTHROPIC_API_KEY) return "Enrichment data unavailable.";
      const text = await callClaude({
        system: ENRICH_SUMMARY_SYSTEM,
        user: enrichSummaryUserPrompt(usable),
        maxTokens: 400,
      });
      return text.trim();
    });

    // The model itself flags a non-representative crawl.
    const blockedByModel = summary.includes("CRAWL_BLOCKED");
    const finalStatus: EnrichmentStatus = blockedByModel ? "blocked" : "complete";
    const finalSummary = blockedByModel
      ? "A crawl nem valós tartalmat töltött be (bot-védelem / consent)."
      : summary;

    await persist(finalStatus, finalSummary, collected.items);
    await step.sendEvent("score", { name: "lead/enriched", data: { lead_id } });
    return { ok: true, status: finalStatus };
  },
);
