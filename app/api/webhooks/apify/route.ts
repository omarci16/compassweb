import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCrawlResults } from "@/lib/apify/client";
import { callClaude } from "@/lib/ai/anthropic";
import {
  ENRICH_SUMMARY_SYSTEM,
  enrichSummaryUserPrompt,
} from "@/lib/ai/prompts/enrich-summary";
import { inngest } from "@/lib/inngest/client";

interface ApifyWebhookPayload {
  resource?: { id?: string; defaultDatasetId?: string; status?: string };
  eventData?: { actorRunId?: string };
  eventType?: string;
}

/**
 * Apify webhook receiver.
 *
 * Two flows, distinguished by query string:
 *   1. Lead enrichment (website crawler): ?lead_id=<uuid>
 *      → updates that lead's enrichment_data + fires "lead/enriched"
 *
 *   2. Prospecting (Google Maps): ?type=gmaps&job_id=<uuid>
 *      → fires "prospecting/results-ready" to drive the processing pipeline
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const lead_id = url.searchParams.get("lead_id");
  const job_id = url.searchParams.get("job_id");

  const payload = (await req.json().catch(() => ({}))) as ApifyWebhookPayload;

  // ---------- Google Maps prospecting flow ----------
  if (type === "gmaps") {
    if (!job_id) {
      return NextResponse.json(
        { error: "Missing job_id for gmaps webhook" },
        { status: 400 },
      );
    }

    const eventType = payload.eventType ?? "";
    const runStatus = payload.resource?.status;

    // Apify sends ACTOR.RUN.SUCCEEDED / FAILED / ABORTED
    if (eventType.includes("FAILED") || eventType.includes("ABORTED") || runStatus === "FAILED") {
      const supabase = createServiceClient();
      await supabase
        .from("scraping_jobs")
        .update({
          status: "failed",
          error_message: `Apify run ${runStatus ?? eventType}`,
          finished_at: new Date().toISOString(),
        })
        .eq("id", job_id);
      return NextResponse.json({ ok: true, status: "failed" });
    }

    // Success → fire processing event
    if (process.env.INNGEST_EVENT_KEY) {
      await inngest.send({
        name: "prospecting/results-ready",
        data: { job_id },
      });
    }

    return NextResponse.json({ ok: true, queued: true });
  }

  // ---------- Lead enrichment flow (existing) ----------
  if (!lead_id) {
    return NextResponse.json({ error: "Missing lead_id" }, { status: 400 });
  }

  const runId = payload.resource?.id ?? payload.eventData?.actorRunId;
  if (!runId) {
    return NextResponse.json({ error: "Missing run id" }, { status: 400 });
  }

  const items = await getCrawlResults(runId);

  let summary = "Enrichment data unavailable.";
  if (process.env.ANTHROPIC_API_KEY && items.length > 0) {
    try {
      summary = await callClaude({
        system: ENRICH_SUMMARY_SYSTEM,
        user: enrichSummaryUserPrompt(items.slice(0, 5)),
        maxTokens: 400,
        temperature: 0.3,
      });
    } catch (err) {
      console.error("Enrichment summary failed", err);
    }
  }

  const supabase = createServiceClient();
  await supabase
    .from("leads")
    .update({
      enrichment_data: items,
      enrichment_summary: summary,
      enrichment_status: items.length > 0 ? "complete" : "failed",
    })
    .eq("id", lead_id);

  if (process.env.INNGEST_EVENT_KEY) {
    await inngest.send({ name: "lead/enriched", data: { lead_id } });
  }

  return NextResponse.json({ ok: true });
}
