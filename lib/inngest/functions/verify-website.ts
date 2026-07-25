// Verifies a lead's website against rendered ground truth before any audit or
// outreach (Lead Scraping 2.0, Phase 2).
//
// Flow: PageSpeed Insights (HTTPS / viewport / performance / screenshot) →
// optional rendered crawl for JS shells / tiny pages → merge into the stored
// signals (dropping heuristic false-positives, upgrading survivors to verified)
// → screenshot to storage → deterministic re-score → fire the pain audit only
// if the lead is still top-tier AFTER verification.

import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/server";
import { crawlWebsite, getCrawlResults, waitForCrawl } from "@/lib/apify/client";
import {
  mergeVerification,
  runPagespeed,
  type PsiResult,
} from "@/lib/prospecting/verify-site";
import { TOP_THRESHOLD, scoreColdLead } from "@/lib/ai/scoring/cold-lead-score";
import { deriveOfferTrack, isRecentlyOpened } from "@/lib/prospecting/offer-track";
import { detectAdsSignal } from "@/lib/prospecting/ads-signal";
import type {
  AdsSignal,
  PainSignal,
  ProspectingNiche,
  TechStack,
  WebsiteHealthStatus,
} from "@/lib/types/app.types";

// Health statuses that are "verified by nature" — no live site to render.
const NO_RENDER_NEEDED: WebsiteHealthStatus[] = ["no_website", "redirect_social"];

function extractRenderedHtml(items: Record<string, unknown>[]): string | null {
  for (const it of items) {
    if (typeof it.html === "string" && it.html.length > 0) return it.html;
  }
  for (const it of items) {
    if (typeof it.text === "string" && it.text.length > 0) return it.text;
    if (typeof it.markdown === "string" && it.markdown.length > 0) return it.markdown;
  }
  return null;
}

export const verifyWebsite = inngest.createFunction(
  { id: "verify-website", retries: 2 },
  { event: "lead/verify-site" },
  async ({ event, step }) => {
    const { lead_id, audit_after } = event.data;
    const supabase = createServiceClient();

    const lead = await step.run("fetch", async () => {
      const { data } = await supabase
        .from("leads")
        .select(
          "id, company_name, niche, website_url, website_health_status, website_health_details, pain_signals, tech_stack, social_links, email, gmaps_phone, gmaps_rating, gmaps_review_count",
        )
        .eq("id", lead_id)
        .single();
      return data;
    });
    if (!lead) return { ok: false, reason: "Lead not found" };

    const health = (lead.website_health_status as WebsiteHealthStatus | null) ?? "unknown";

    // No live site to verify (no URL, or already-known social/no-website).
    // These are verifiable without rendering — proceed straight to the audit.
    if (!lead.website_url || NO_RENDER_NEEDED.includes(health)) {
      if (audit_after) {
        await step.sendEvent("audit", { name: "lead/pain-audit", data: { lead_id } });
      }
      return { ok: true, verified: false, reason: "No render needed" };
    }

    const details =
      lead.website_health_details && typeof lead.website_health_details === "object"
        ? (lead.website_health_details as { final_url?: string })
        : {};
    const probeUrl = details.final_url || lead.website_url;

    // ----- 1. PageSpeed Insights (free ground truth) -----
    const psi = await step.run("psi", async (): Promise<PsiResult | null> =>
      runPagespeed(probeUrl),
    );

    // Preliminary offer route from the (pre-verification) signals. Upgrade leads
    // — a working site with a real hook — get the rendered crawl too, so the
    // "convert more" audit is grounded in real content, not the static probe.
    const preTrack = deriveOfferTrack({
      website_url: lead.website_url,
      website_health: health,
      pain_signals: Array.isArray(lead.pain_signals)
        ? (lead.pain_signals as unknown as PainSignal[])
        : [],
      tech_stack: (lead.tech_stack as unknown as TechStack | null) ?? null,
    });

    // ----- 2. Rendered crawl, when content classification is in doubt OR upgrade -----
    let rendered: { html: string | null; runId: string | null } = { html: null, runId: null };
    if (health === "js_shell" || health === "tiny" || preTrack === "upgrade") {
      rendered = await step.run("render-crawl", async () => {
        try {
          const run = await crawlWebsite(psi?.final_url || probeUrl, {
            // Upgrade audits want more than the homepage to ground the pitch.
            maxCrawlPages: preTrack === "upgrade" ? 2 : 1,
            crawlerType: "playwright:firefox",
            saveHtml: true,
          });
          const finished = await waitForCrawl(run.id, 120);
          if (finished?.status !== "SUCCEEDED") return { html: null, runId: run.id };
          const items = await getCrawlResults(run.id);
          return { html: extractRenderedHtml(items), runId: run.id };
        } catch (err) {
          console.error("[verify] render crawl failed", err);
          return { html: null, runId: null };
        }
      });
    }

    // ----- 2b. Optional buying signal: are they running paid ads? -----
    // No-ops to null without META_AD_LIBRARY_TOKEN (see ads-signal.ts).
    const ads = await step.run("detect-ads", async (): Promise<AdsSignal | null> =>
      detectAdsSignal(lead.company_name),
    );
    const recentlyOpened = isRecentlyOpened(lead.gmaps_rating, lead.gmaps_review_count);

    // ----- 3. Merge verified truth into the stored signals -----
    const currentSignals = Array.isArray(lead.pain_signals)
      ? (lead.pain_signals as unknown as PainSignal[])
      : [];
    const currentTech = (lead.tech_stack as unknown as TechStack | null) ?? null;

    const merged = mergeVerification(
      {
        health_status: health,
        pain_signals: currentSignals,
        tech_stack: currentTech,
        requested_url: lead.website_url,
        final_url: psi?.final_url || probeUrl,
      },
      psi,
      rendered.html,
    );

    // ----- 4. Screenshot → storage -----
    const screenshotUrl = await step.run("upload-screenshot", async () => {
      if (!psi?.screenshot_base64) return null;
      const buf = Buffer.from(psi.screenshot_base64, "base64");
      const path = `${lead_id}.jpg`;
      const { error } = await supabase.storage
        .from("site-screenshots")
        .upload(path, buf, { contentType: "image/jpeg", upsert: true });
      if (error) {
        console.error("[verify] screenshot upload failed", error);
        return null;
      }
      return supabase.storage.from("site-screenshots").getPublicUrl(path).data.publicUrl;
    });

    // ----- 5. Deterministic re-score on verified signals -----
    const score = scoreColdLead({
      niche: (lead.niche as ProspectingNiche) ?? "other",
      gmaps_rating: lead.gmaps_rating,
      gmaps_review_count: lead.gmaps_review_count,
      website_url: lead.website_url,
      website_health: merged.health_status,
      social_links_count: lead.social_links
        ? Object.keys(lead.social_links as Record<string, unknown>).length
        : 0,
      has_email: !!lead.email,
      has_phone: !!lead.gmaps_phone,
      pain_signals: merged.pain_signals,
      website_verified: true,
      runs_ads: ads?.runs_ads ?? false,
      recently_opened: recentlyOpened,
    });

    // Final offer route on verified truth (+ ads signal).
    const offerTrack = deriveOfferTrack({
      website_url: lead.website_url,
      website_health: merged.health_status,
      pain_signals: merged.pain_signals,
      tech_stack: merged.tech_stack,
      runs_ads: ads?.runs_ads ?? false,
    });

    // ----- 6. Persist -----
    await step.run("persist", async () => {
      await supabase
        .from("leads")
        .update({
          website_health_status: merged.health_status,
          pain_signals: merged.pain_signals,
          tech_stack: merged.tech_stack,
          website_screenshot_url: screenshotUrl,
          website_verified_at: new Date().toISOString(),
          website_verification: {
            method: rendered.html ? "rendered_crawl" : "psi",
            final_url: psi?.final_url || probeUrl,
            psi_performance: psi?.performance ?? null,
            psi_https_ok: psi?.https_ok ?? null,
            psi_viewport_ok: psi?.viewport_ok ?? null,
            crawl_run_id: rendered.runId,
            checked_at: new Date().toISOString(),
          },
          win_probability: score.total,
          win_probability_reasons: score.signals.map((s) => s.label),
          ads_signal: ads,
          recently_opened: recentlyOpened,
          offer_track: offerTrack,
        })
        .eq("id", lead_id);
    });

    // ----- 7. Audit only if still top-tier on verified data -----
    if (audit_after && score.total >= TOP_THRESHOLD) {
      await step.sendEvent("audit", { name: "lead/pain-audit", data: { lead_id } });
    }

    return { ok: true, verified: true, score: score.total };
  },
);
