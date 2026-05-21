// Client-safe constants for the prospecting UI.
// Split out from google-maps.ts because that file imports the Node-only
// `apify-client` and cannot be bundled into "use client" components.

import type { ProspectingNiche } from "@/lib/types/app.types";

export const GOOGLE_MAPS_ACTOR = "compass/crawler-google-places";

// Cost estimate per result, in USD. Source: Apify Console pricing.
export const COST_PER_RESULT_USD = 0.003;

export const NICHE_SEARCH_TERMS: Record<ProspectingNiche, string[]> = {
  beauty: ["szépségszalon", "kozmetika", "fodrász", "körmös", "manikűr", "smink"],
  fitness: ["edzőterem", "személyi edző", "jóga stúdió", "pilates stúdió", "crossfit"],
  dental: ["fogorvos", "fogászat", "fogszabályozás", "implantológia"],
  real_estate: ["ingatlaniroda", "ingatlanos", "ingatlan iroda"],
  other: [],
};

export const DEFAULT_CITIES = ["Budapest", "Debrecen"] as const;
