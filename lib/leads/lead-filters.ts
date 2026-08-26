// Lead list filtering — kept pure so the table component stays thin and the
// rules are unit-testable rather than tangled in JSX.

import type { Lead } from "@/lib/types/app.types";
import { isContactable } from "@/lib/prospecting/contactability";

export type DatePreset = "all" | "today" | "7d" | "30d" | "90d";

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  all: "Bármikor",
  today: "Ma",
  "7d": "Elmúlt 7 nap",
  "30d": "Elmúlt 30 nap",
  "90d": "Elmúlt 90 nap",
};

const PRESET_DAYS: Record<Exclude<DatePreset, "all" | "today">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

/**
 * Is `iso` inside the window `preset` describes, relative to `now`?
 *
 * "today" means calendar-day-so-far in the viewer's timezone — someone asking
 * for today's leads means since midnight, not the trailing 24 hours.
 */
export function matchesDatePreset(
  iso: string | null | undefined,
  preset: DatePreset,
  now: Date = new Date(),
): boolean {
  if (preset === "all") return true;
  if (!iso) return false;

  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  // A future-dated row (clock skew on import) should still show under "today".
  if (t > now.getTime()) return preset === "today";

  if (preset === "today") {
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    return t >= midnight.getTime();
  }

  return t >= now.getTime() - PRESET_DAYS[preset] * 86_400_000;
}

export interface LeadFilterCriteria {
  q: string;
  source: string;
  status: string;
  niche: string;
  reach: string;
  date: DatePreset;
}

export const EMPTY_CRITERIA: LeadFilterCriteria = {
  q: "",
  source: "all",
  status: "all",
  niche: "all",
  reach: "all",
  date: "all",
};

/** Niches actually present in the data, so the dropdown never offers an empty result. */
export function collectNiches(leads: Lead[]): string[] {
  const set = new Set<string>();
  for (const l of leads) {
    const n = l.niche?.trim();
    if (n) set.add(n);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "hu"));
}

export function filterLeads(
  leads: Lead[],
  c: LeadFilterCriteria,
  now: Date = new Date(),
): Lead[] {
  const needle = c.q.trim().toLowerCase();

  return leads.filter((l) => {
    if (needle) {
      const hay = `${l.company_name} ${l.contact_name ?? ""} ${l.niche ?? ""} ${l.email ?? ""}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    if (c.source !== "all" && l.source !== c.source) return false;
    if (c.status !== "all" && l.status !== c.status) return false;
    if (c.niche !== "all" && (l.niche ?? "") !== c.niche) return false;
    if (c.reach === "reachable" && !isContactable(l)) return false;
    if (c.reach === "unreachable" && isContactable(l)) return false;
    if (!matchesDatePreset(l.created_at, c.date, now)) return false;
    return true;
  });
}

/** True when anything is narrowing the list — drives the "clear filters" affordance. */
export function hasActiveFilters(c: LeadFilterCriteria): boolean {
  return (
    c.q.trim() !== "" ||
    c.source !== "all" ||
    c.status !== "all" ||
    c.niche !== "all" ||
    c.reach !== "all" ||
    c.date !== "all"
  );
}
