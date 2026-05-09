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
  resource?: { id?: string; defaultDatasetId?: string };
  eventData?: { actorRunId?: string };
  // The lead_id is passed via query param when creating the actor run.
}

/**
 * Apify webhook receiver. Configure the webhook in Apify console with:
 *   ?lead_id={lead_id_value}
 * appended to this URL.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const lead_id = url.searchParams.get("lead_id");
  if (!lead_id) return NextResponse.json({ error: "Missing lead_id" }, { status: 400 });

  const payload = (await req.json().catch(() => ({}))) as ApifyWebhookPayload;
  const runId = payload.resource?.id ?? payload.eventData?.actorRunId;
  if (!runId) return NextResponse.json({ error: "Missing run id" }, { status: 400 });

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
