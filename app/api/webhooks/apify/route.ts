import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";

interface ApifyWebhookPayload {
  resource?: { id?: string; defaultDatasetId?: string; status?: string };
  eventData?: { actorRunId?: string };
  eventType?: string;
}

/**
 * Apify webhook receiver — Google Maps prospecting only (?type=gmaps&job_id=…).
 *
 * The website-content-crawler enrichment path is NOT here: crawlWebsite never
 * registers a webhook, so enrich-lead owns its own crawl→collect loop. The old
 * ?lead_id enrichment branch was unreachable and has been removed.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const job_id = url.searchParams.get("job_id");

  const payload = (await req.json().catch(() => ({}))) as ApifyWebhookPayload;

  if (type !== "gmaps" || !job_id) {
    return NextResponse.json(
      { error: "Missing type=gmaps or job_id" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const eventType = payload.eventType ?? "";
  const runStatus = payload.resource?.status;

  // Apify sends ACTOR.RUN.SUCCEEDED / FAILED / ABORTED
  if (eventType.includes("FAILED") || eventType.includes("ABORTED") || runStatus === "FAILED") {
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

  // Success → hand off to the processing pipeline. Without Inngest configured
  // there is no collector, so fail loudly instead of leaving the job stuck in
  // "collecting" forever.
  if (!process.env.INNGEST_EVENT_KEY) {
    await supabase
      .from("scraping_jobs")
      .update({
        status: "failed",
        error_message: "INNGEST_EVENT_KEY not configured — results not processed.",
        finished_at: new Date().toISOString(),
      })
      .eq("id", job_id);
    return NextResponse.json({ ok: false, error: "Inngest not configured" }, { status: 503 });
  }

  await inngest.send({ name: "prospecting/results-ready", data: { job_id } });
  return NextResponse.json({ ok: true, queued: true });
}
