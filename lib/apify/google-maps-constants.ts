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
  legal: ["ügyvéd", "ügyvédi iroda", "jogi tanácsadás", "közjegyző"],
  hospitality: ["étterem", "kávézó", "panzió", "cukrászda", "bisztró"],
  other: [],
};

// Single source of truth for the city picker, shared by ScrapeLauncher (single)
// and BatchLauncher (multi). Keeping one list here avoids the old drift where
// the launcher offered 7 cities but DEFAULT_CITIES had 2.
export const PROSPECTING_CITIES = [
  "Budapest",
  "Debrecen",
  "Szeged",
  "Miskolc",
  "Pécs",
  "Győr",
  "Nyíregyháza",
  "Kecskemét",
  "Székesfehérvár",
  "Hungary", // whole-country sweep
] as const;

// The two cities we always seed a fresh batch with (kept for callers that
// want a sane default without the whole list).
export const DEFAULT_CITIES = ["Budapest", "Debrecen"] as const;
