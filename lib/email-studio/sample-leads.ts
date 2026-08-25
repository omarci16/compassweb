// Synthetic fixture leads for the Email Studio sandbox — lets founders
// preview a Voice Profile's output before saving, even with no real lead
// picked. One representative lead per niche, covering both offer tracks.

import type { ProspectingNiche } from "@/lib/types/app.types";
import type { DraftLeadInput } from "@/lib/outreach/generate-draft";

export interface SampleLead extends DraftLeadInput {
  label: string;
}

export const SAMPLE_LEADS: SampleLead[] = [
  {
    id: "sample-dental-needs-site",
    label: "Fogászat — nincs oldal",
    company_name: "Kovács Fogászat",
    contact_name: "Kovács Anna",
    niche: "dental" satisfies ProspectingNiche,
    gmaps_city: "Budapest",
    gmaps_category: "fogorvos",
    website_url: null,
    pain_audit:
      "A Kovács Fogászatnak jelenleg nincs saját weboldala, csak egy Facebook-oldala él. Az érdeklődők így nem tudnak online tájékozódni a kezelésekről vagy időpontot kérni, ami különösen a mobilon keresők körében okoz elveszett érdeklődőket.",
    enrichment_summary: null,
    offer_track: "needs_site",
    pain_signals: [],
  },
  {
    id: "sample-hospitality-upgrade",
    label: "Étterem — van oldal (upgrade)",
    company_name: "Bistro Buda",
    contact_name: "Nagy Péter",
    niche: "hospitality" satisfies ProspectingNiche,
    gmaps_city: "Budapest",
    gmaps_category: "étterem",
    website_url: "https://bistrobuda.hu",
    pain_audit: null,
    enrichment_summary: "Népszerű budai bisztró napi menüvel, aktív Instagram jelenléttel.",
    offer_track: "upgrade",
    pain_signals: [
      {
        code: "no_analytics",
        severity: "medium",
        label_hu: "Nincs látogatottság-mérés",
        label_en: "No analytics",
        confidence: "verified",
      },
      {
        code: "no_contact_form",
        severity: "low",
        label_hu: "Nincs online asztalfoglalás",
        label_en: "No booking form",
        confidence: "verified",
        evidence: "No booking widget or contact form detected.",
      },
    ],
  },
  {
    id: "sample-legal-needs-site",
    label: "Ügyvédi iroda — nincs oldal",
    company_name: "Horváth Ügyvédi Iroda",
    contact_name: null,
    niche: "legal" satisfies ProspectingNiche,
    gmaps_city: "Debrecen",
    gmaps_category: "ügyvédi iroda",
    website_url: null,
    pain_audit:
      "A Horváth Ügyvédi Irodának nincs önálló weboldala, csak egy céginfó-oldalon szerepel elérhetősége. Ez különösen bizalmi szakmában (jogi tanácsadás) gyengíti a professzionális megjelenést.",
    enrichment_summary: null,
    offer_track: "needs_site",
    pain_signals: [],
  },
];

export function findSampleLead(id: string): SampleLead | null {
  return SAMPLE_LEADS.find((l) => l.id === id) ?? null;
}
