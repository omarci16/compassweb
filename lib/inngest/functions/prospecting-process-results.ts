// Processes a completed Apify Google Maps run:
//   1. Pulls all dataset items
//   2. Normalises into LeadCandidate shape
//   3. Dedupes against existing leads (gmaps_place_id, phone, website)
//   4. Probes website health in parallel for each candidate
//   5. Harvests contacts from the HTML that probe already downloaded, and
//      promotes the best discovered email when Maps gave us none (Phase I)
//   6. Verifies whichever email we ended up with (syntax + MX)
//   7. Computes cold-lead score
//   8. Inserts as `leads` rows (source='cold_outreach', status='new')
//   9. Updates scraping_job metrics
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
import { normalizeWebsiteHost } from "@/lib/prospecting/normalize";
import { verifyManyEmails } from "@/lib/prospecting/email-verify";
import { bestEmail, mergeContacts } from "@/lib/prospecting/contact-extract";
import {
  FOGORVOSKERESO_KEY,
  fetchFogorvoskeresoCandidates,
} from "@/lib/prospecting/sources/fogorvoskereso";
import { deriveOfferTrack, isRecentlyOpened } from "@/lib/prospecting/offer-track";
import {
  HIGH_THRESHOLD,
  TOP_THRESHOLD,
  scoreColdLead,
} from "@/lib/ai/scoring/cold-lead-score";
import { computeNicheWinRates } from "@/lib/data/queries";
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
    const isDirectory = job?.source_type === "directory";
    if (!job || (!isDirectory && !job.apify_run_id)) {
      return { ok: false, reason: "Job missing or has no Apify run" };
    }

    await step.run("mark-processing", async () => {
      await supabase
        .from("scraping_jobs")
        .update({ status: "processing" })
        .eq("id", job_id);
    });

    // ----- Pull and normalise raw items -----
    // Only the SOURCE of candidates differs between a Google Maps run and a
    // directory run; everything below (dedup → contact harvest → email verify →
    // score → offer routing → insert) is shared.
    const niche = job.niche as ProspectingNiche;
    const candidates = await step.run("collect-and-normalise", async () => {
      if (isDirectory) {
        if (job.source_key !== FOGORVOSKERESO_KEY) return [] as LeadCandidate[];
        return fetchFogorvoskeresoCandidates(niche, {
          city: job.city && job.city !== "Hungary" ? job.city : null,
          maxResults: job.max_results ?? 200,
        });
      }
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
      hosts: string[];
    }> => {
      const [byPlace, byPhone, byHost] = await Promise.all([
        placeIds.length > 0
          ? supabase
              .from("leads")
              .select("gmaps_place_id")
              .in("gmaps_place_id", placeIds)
          : Promise.resolve({ data: [] as { gmaps_place_id: string | null }[] }),
        phones.length > 0
          ? supabase.from("leads").select("phone").in("phone", phones)
          : Promise.resolve({ data: [] as { phone: string | null }[] }),
        // Website host can't be matched with an `.in()` (we store full URLs), so
        // pull existing cold-lead URLs and normalise in code. Bounded to the
        // cold-lead corpus — fine for a two-person ops tool (see queries.ts).
        supabase
          .from("leads")
          .select("website_url")
          .not("website_url", "is", null)
          .limit(10000),
      ]);
      return {
        placeIds: ((byPlace.data ?? []) as { gmaps_place_id: string | null }[])
          .map((r) => r.gmaps_place_id)
          .filter((x): x is string => !!x),
        phones: ((byPhone.data ?? []) as { phone: string | null }[])
          .map((r) => r.phone)
          .filter((x): x is string => !!x),
        hosts: ((byHost.data ?? []) as { website_url: string | null }[])
          .map((r) => normalizeWebsiteHost(r.website_url))
          .filter((x): x is string => !!x),
      };
    });

    const placeSet = new Set(existing.placeIds);
    const phoneSet = new Set(existing.phones);
    const hostSet = new Set(existing.hosts);

    // Dedupe against existing leads (place_id, phone, website host) AND within
    // the incoming batch itself (two search terms can return the same place).
    const seenHosts = new Set<string>();
    const novel = candidates.filter((c) => {
      if (c.gmaps_place_id && placeSet.has(c.gmaps_place_id)) return false;
      if (c.gmaps_phone && phoneSet.has(c.gmaps_phone)) return false;
      const host = normalizeWebsiteHost(c.website_url);
      if (host) {
        if (hostSet.has(host) || seenHosts.has(host)) return false;
        seenHosts.add(host);
      }
      return true;
    });
    const duplicates = totalScraped - novel.length;

    // ----- Deep site analysis: health + tech stack + pain signals (parallel) -----
    const analyses = await step.run("analyze-sites", async () => {
      const urls = novel.map((c) => c.website_url);
      return analyzeMany(urls, 6);
    });

    // ----- Contact harvesting (Phase I) -----
    // The probe above already downloaded each homepage; `analysis.contacts` is
    // what was in it. Google Maps frequently has no email, so promote the
    // best-ranked discovered address — BEFORE verification below, so the
    // promoted address gets MX-checked in the same pass rather than shipping
    // unverified. Aligned to `novel` by index.
    const contactPromotions = novel.map((c, idx) => {
      const found = analyses[idx]?.contacts ?? null;
      const promoted = c.email ? null : bestEmail(found);
      return {
        email: c.email ?? promoted,
        contact_source: c.email ? ("gmaps" as const) : promoted ? ("website" as const) : null,
        discovered_emails: found?.emails.length ? found.emails : null,
        discovered_phones: found?.phones.length ? found.phones : null,
        // Merge harvested profiles over the Maps ones (Maps wins ties), so
        // social_links_count in the scorer sees everything we know.
        social_links: mergeContacts(
          { emails: [], phones: [], socials: c.social_links },
          found,
        ).socials,
      };
    });

    // ----- Free email verification (syntax + MX + disposable/role) -----
    // Gates hard bounces before they can touch the sending domain. Aligned to
    // `novel` by index.
    const emailChecks = await step.run("verify-emails", async () => {
      return verifyManyEmails(contactPromotions.map((p) => p.email), 8);
    });

    // Historical niche win rates (deterministic scorer input) — computed once
    // per run from the closed-lead corpus via the service client.
    const nicheWinRates = await step.run("niche-win-rates", async () => {
      const { data } = await supabase
        .from("leads")
        .select("niche, status")
        .in("status", ["won", "lost"])
        .limit(5000);
      return computeNicheWinRates(
        (data ?? []) as { niche: string | null; status: string }[],
      );
    });

    // ----- Score + insert in batches -----
    let imported = 0;
    let topTier = 0;
    // { id, score, health } for every inserted lead — used to decide which
    // leads get verified (and, post-verification, audited).
    const insertedMeta: { id: string; score: number; health: string | null }[] = [];

    for (let i = 0; i < novel.length; i += BATCH_SIZE) {
      const batch = novel.slice(i, i + BATCH_SIZE);
      const batchAnalyses = analyses.slice(i, i + BATCH_SIZE);

      const batchEmailChecks = emailChecks.slice(i, i + BATCH_SIZE);
      const batchContacts = contactPromotions.slice(i, i + BATCH_SIZE);

      const stepResult = await step.run(`insert-batch-${i}`, async () => {
        const rows = batch.map((c, idx) => {
          const analysis = batchAnalyses[idx];
          const emailCheck = batchEmailChecks[idx];
          const contact = batchContacts[idx];
          const recentlyOpened = isRecentlyOpened(c.gmaps_rating, c.gmaps_review_count);
          const score = scoreColdLead({
            niche: c.niche,
            gmaps_rating: c.gmaps_rating,
            gmaps_review_count: c.gmaps_review_count,
            website_url: c.website_url,
            website_health: analysis.health_status,
            social_links_count: Object.keys(contact.social_links).length,
            has_email: !!contact.email,
            has_phone: !!c.gmaps_phone,
            pain_signals: analysis.pain_signals,
            historical_niche_win_rates: nicheWinRates,
            recently_opened: recentlyOpened,
          });
          // Static offer route (ads unknown at import — verify refines it).
          const offerTrack = deriveOfferTrack({
            website_url: c.website_url,
            website_health: analysis.health_status,
            pain_signals: analysis.pain_signals,
            tech_stack: analysis.tech_stack,
          });
          return {
            company_name: c.company_name,
            email: contact.email,
            phone: c.gmaps_phone ?? contact.discovered_phones?.[0] ?? null,
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
            social_links: contact.social_links,
            has_existing_website: !!c.website_url,
            website_health_status: analysis.health_status,
            website_health_checked_at: new Date().toISOString(),
            website_health_details: analysis.health_details,
            tech_stack: analysis.tech_stack,
            pain_signals: analysis.pain_signals,
            win_probability: score.total,
            win_probability_reasons: score.signals.map((s) => s.label),
            enrichment_status: "pending" as const,
            email_status: emailCheck?.email_status ?? "unknown",
            email_verified: emailCheck ? emailCheck.email_status !== "unknown" : false,
            email_checked_at: emailCheck ? new Date().toISOString() : null,
            recently_opened: recentlyOpened,
            offer_track: offerTrack,
            discovered_emails: contact.discovered_emails,
            discovered_phones: contact.discovered_phones,
            contact_source: contact.contact_source,
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
          .select("id, win_probability, website_health_status");

        if (error) {
          console.error("[prospecting] insert batch failed", error);
          return { inserted: 0, meta: [] as { id: string; score: number; health: string | null }[] };
        }
        const insertedRows = data ?? [];
        return {
          inserted: insertedRows.length,
          meta: insertedRows.map((r) => ({
            id: r.id as string,
            score: r.win_probability ?? 0,
            health: (r.website_health_status as string | null) ?? null,
          })),
        };
      });

      imported += stepResult.inserted;
      insertedMeta.push(...stepResult.meta);
    }

    topTier = insertedMeta.filter((m) => m.score >= TOP_THRESHOLD).length;

    // ----- Fan out: VERIFY before auditing -----
    // We no longer audit straight off the cheap static probe (that produced the
    // windingatlan false positive). Instead we verify the promising leads
    // against rendered ground truth (PSI + optional crawl); verify-website fires
    // the pain audit only for leads that remain top-tier once verified.
    //
    // Targets: anything scoring in the high tier or above (worth a free PSI
    // check), plus every JS shell / tiny page (needs a rendered crawl to know
    // whether it's really a placeholder). Capped to control crawl cost.
    const VERIFY_CAP = 50;
    const verifyTargets = insertedMeta
      .filter(
        (m) =>
          m.score >= HIGH_THRESHOLD ||
          m.health === "js_shell" ||
          m.health === "tiny",
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, VERIFY_CAP)
      .map((m) => m.id);

    if (verifyTargets.length > 0) {
      await step.sendEvent(
        "fan-out-verify",
        verifyTargets.map((lead_id) => ({
          name: "lead/verify-site" as const,
          data: { lead_id, audit_after: true },
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
