import type { VoiceSituation } from "@/lib/types/app.types";

export const SITUATION_LABELS_HU: Record<VoiceSituation, string> = {
  cold_first_touch: "Első hideg megkeresés",
  cold_followup: "Hideg követő levél",
  re_engagement: "Re-engagement (30/60/90 nap)",
  proposal: "Ajánlat",
  deal_followup: "Üzlet utáni követés",
};

export const SITUATION_ORDER: VoiceSituation[] = [
  "cold_first_touch",
  "cold_followup",
  "re_engagement",
  "proposal",
  "deal_followup",
];
