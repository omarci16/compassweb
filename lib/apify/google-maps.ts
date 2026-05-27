// Google Maps scraper wrapper — Apify actor `compass/crawler-google-places`.
// Returns structured business records ideal for cold lead sourcing.
//
// Pricing reference: ~$3 per 1,000 results at time of writing.
// Hungarian niche search terms are built into NICHE_SEARCH_TERMS below.

import { getApifyClient } from "./client";
import { GOOGLE_MAPS_ACTOR } from "./google-maps-constants";
import type { ProspectingNiche, SocialLinks } from "@/lib/types/app.types";

// Re-export constants for ergonomics — server modules can import everything from here.
export {
  GOOGLE_MAPS_ACTOR,
  COST_PER_RESULT_USD,
  NICHE_SEARCH_TERMS,
  DEFAULT_CITIES,
} from "./google-maps-constants";

export interface GoogleMapsRun {
  id: string;
  defaultDatasetId: string;
  status: string;
}

export interface StartGoogleMapsScrapeInput {
  searchTerms: string[];   // e.g. ["szépségszalon", "kozmetika"]
  city: string;            // "Budapest" | "Debrecen" | "Hungary" | etc.
  country?: string;        // default "Hungary"
  maxResults: number;      // total across all searches
  /** Where Apify should POST when the run finishes. */
  webhookUrl?: string;
}

/**
 * Kick off a Google Maps scrape. The actor accepts an array of search strings;
 * combining `<term> <city>` for each term casts the widest net.
 *
 * IMPORTANT: this just *starts* the run. We process results via webhook
 * (preferred) or by polling the dataset.
 */
export async function startGoogleMapsScrape(
  input: StartGoogleMapsScrapeInput,
): Promise<GoogleMapsRun> {
  const apify = getApifyClient();
  const country = input.country ?? "Hungary";

  const searchStringsArray = input.searchTerms.map(
    (term) => `${term} ${input.city}`,
  );

  // Per-term cap, so a 3-term run for maxResults=300 = 100 per term
  const perTermLimit = Math.max(20, Math.ceil(input.maxResults / Math.max(1, input.searchTerms.length)));

  const run = await apify.actor(GOOGLE_MAPS_ACTOR).start(
    {
      searchStringsArray,
      locationQuery: input.city === "Hungary" ? country : `${input.city}, ${country}`,
      maxCrawledPlacesPerSearch: perTermLimit,
      language: "hu",
      countryCode: "hu",
      skipClosedPlaces: true,
      scrapeContacts: true,           // emails, social links if present
      deeperCityScrape: false,
      maximumLeadsEnrichmentRecords: 0,
    },
    input.webhookUrl
      ? {
          webhooks: [
            {
              eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.ABORTED"],
              requestUrl: input.webhookUrl,
            },
          ],
        }
      : undefined,
  );

  return {
    id: run.id,
    defaultDatasetId: run.defaultDatasetId,
    status: run.status,
  };
}

/**
 * Fetch all dataset items from a completed run.
 * Apify pages internally — we ask for everything in one call.
 */
export async function getGoogleMapsResults(runId: string): Promise<GoogleMapsRaw[]> {
  const apify = getApifyClient();
  const run = await apify.run(runId).get();
  if (!run) return [];
  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  return items as unknown as GoogleMapsRaw[];
}

// ---------------------------------------------------------------------
// Raw Google Maps actor result shape (partial — only fields we use).
// The actor returns many more fields; we keep this lean.
// ---------------------------------------------------------------------
export interface GoogleMapsRaw {
  title?: string;
  subTitle?: string | null;
  categoryName?: string | null;
  categories?: string[];
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  state?: string | null;
  countryCode?: string | null;
  website?: string | null;
  phone?: string | null;
  phoneUnformatted?: string | null;
  emails?: string[];
  url?: string | null;            // Google Maps URL
  placeId?: string | null;
  totalScore?: number | null;     // Star rating
  reviewsCount?: number | null;
  permanentlyClosed?: boolean;
  temporarilyClosed?: boolean;
  socialMedia?: {
    instagram?: string;
    facebook?: string;
    linkedin?: string;
    tiktok?: string;
    twitter?: string;
    youtube?: string;
  };
  // Some actor versions return social links flat:
  instagrams?: string[];
  facebooks?: string[];
  linkedIns?: string[];
}

// ---------------------------------------------------------------------
// Normalised lead candidate — what we hand to the import pipeline
// ---------------------------------------------------------------------
export interface LeadCandidate {
  company_name: string;
  niche: ProspectingNiche;
  gmaps_category: string | null;
  gmaps_address: string | null;
  gmaps_city: string | null;
  gmaps_rating: number | null;
  gmaps_review_count: number | null;
  gmaps_phone: string | null;
  gmaps_url: string | null;
  gmaps_place_id: string | null;
  website_url: string | null;
  email: string | null;
  social_links: SocialLinks;
}

/**
 * Normalise a raw Apify Google Maps item into our LeadCandidate shape.
 * Returns null if the record is unusable (closed, no name, etc.).
 */
export function normaliseGoogleMapsItem(
  raw: GoogleMapsRaw,
  niche: ProspectingNiche,
): LeadCandidate | null {
  if (!raw.title?.trim()) return null;
  if (raw.permanentlyClosed) return null;

  const social: SocialLinks = {};
  const sm = raw.socialMedia ?? {};
  if (sm.instagram) social.instagram = sm.instagram;
  else if (raw.instagrams?.[0]) social.instagram = raw.instagrams[0];
  if (sm.facebook) social.facebook = sm.facebook;
  else if (raw.facebooks?.[0]) social.facebook = raw.facebooks[0];
  if (sm.linkedin) social.linkedin = sm.linkedin;
  else if (raw.linkedIns?.[0]) social.linkedin = raw.linkedIns[0];
  if (sm.tiktok) social.tiktok = sm.tiktok;

  return {
    company_name: raw.title.trim(),
    niche,
    gmaps_category: raw.categoryName ?? raw.categories?.[0] ?? null,
    gmaps_address: raw.address ?? null,
    gmaps_city: raw.city ?? null,
    gmaps_rating: typeof raw.totalScore === "number" ? raw.totalScore : null,
    gmaps_review_count: typeof raw.reviewsCount === "number" ? raw.reviewsCount : null,
    gmaps_phone: raw.phone ?? raw.phoneUnformatted ?? null,
    gmaps_url: raw.url ?? null,
    gmaps_place_id: raw.placeId ?? null,
    website_url: normaliseUrl(raw.website),
    email: raw.emails?.[0] ?? null,
    social_links: social,
  };
}

function normaliseUrl(u?: string | null): string | null {
  if (!u) return null;
  const trimmed = u.trim();
  if (!trimmed) return null;
  // Filter out non-website "websites" Google sometimes returns
  if (trimmed.startsWith("tel:") || trimmed.startsWith("mailto:")) return null;
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return url.toString();
  } catch {
    return null;
  }
}
