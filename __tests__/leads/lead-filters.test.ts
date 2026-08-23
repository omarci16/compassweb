import { describe, expect, it } from "vitest";
import {
  EMPTY_CRITERIA,
  collectNiches,
  filterLeads,
  hasActiveFilters,
  matchesDatePreset,
} from "@/lib/leads/lead-filters";
import type { Lead } from "@/lib/types/app.types";

const NOW = new Date("2026-08-10T14:00:00Z");

const lead = (over: Partial<Lead> = {}): Lead =>
  ({
    id: "l1",
    created_at: NOW.toISOString(),
    company_name: "Kovács Fogászat",
    contact_name: null,
    email: null,
    email_status: null,
    phone: null,
    niche: "dental",
    source: "cold_outreach",
    status: "new",
    social_links: null,
    contact_source: null,
    ...over,
  }) as unknown as Lead;

describe("matchesDatePreset", () => {
  it("'all' lets everything through, including a missing date", () => {
    expect(matchesDatePreset("2020-01-01T00:00:00Z", "all", NOW)).toBe(true);
    expect(matchesDatePreset(null, "all", NOW)).toBe(true);
  });

  it("'today' means since local midnight, not the trailing 24 hours", () => {
    const midnightIsh = new Date(NOW);
    midnightIsh.setHours(1, 0, 0, 0);
    expect(matchesDatePreset(midnightIsh.toISOString(), "today", NOW)).toBe(true);

    const yesterdayEvening = new Date(NOW);
    yesterdayEvening.setDate(yesterdayEvening.getDate() - 1);
    yesterdayEvening.setHours(23, 0, 0, 0);
    expect(matchesDatePreset(yesterdayEvening.toISOString(), "today", NOW)).toBe(false);
  });

  it("rolling windows include the edge and exclude beyond it", () => {
    const sixDays = new Date(NOW.getTime() - 6 * 86_400_000).toISOString();
    const eightDays = new Date(NOW.getTime() - 8 * 86_400_000).toISOString();
    expect(matchesDatePreset(sixDays, "7d", NOW)).toBe(true);
    expect(matchesDatePreset(eightDays, "7d", NOW)).toBe(false);
    expect(matchesDatePreset(eightDays, "30d", NOW)).toBe(true);
    expect(matchesDatePreset(eightDays, "90d", NOW)).toBe(true);
  });

  it("keeps a future-dated row visible under 'today' rather than hiding it", () => {
    const future = new Date(NOW.getTime() + 3_600_000).toISOString();
    expect(matchesDatePreset(future, "today", NOW)).toBe(true);
    expect(matchesDatePreset(future, "7d", NOW)).toBe(false);
  });

  it("treats a missing or unparseable date as no match", () => {
    expect(matchesDatePreset(null, "7d", NOW)).toBe(false);
    expect(matchesDatePreset("not-a-date", "7d", NOW)).toBe(false);
  });
});

describe("collectNiches", () => {
  it("returns the distinct, trimmed, sorted niches present", () => {
    const list = collectNiches([
      lead({ niche: "dental" }),
      lead({ niche: "beauty" }),
      lead({ niche: "dental" }),
      lead({ niche: null }),
      lead({ niche: "   " }),
    ]);
    expect(list).toEqual(["beauty", "dental"]);
  });

  it("is empty for an empty list", () => {
    expect(collectNiches([])).toEqual([]);
  });
});

describe("filterLeads", () => {
  const leads = [
    lead({ id: "a", company_name: "Kovács Fogászat", niche: "dental", status: "new" }),
    lead({ id: "b", company_name: "Szépség Szalon", niche: "beauty", status: "qualified" }),
    lead({
      id: "c",
      company_name: "Régi Ügyfél",
      niche: "legal",
      status: "won",
      created_at: new Date(NOW.getTime() - 60 * 86_400_000).toISOString(),
    }),
  ];

  it("returns everything with empty criteria", () => {
    expect(filterLeads(leads, EMPTY_CRITERIA, NOW)).toHaveLength(3);
  });

  it("filters by niche", () => {
    const out = filterLeads(leads, { ...EMPTY_CRITERIA, niche: "dental" }, NOW);
    expect(out.map((l) => l.id)).toEqual(["a"]);
  });

  it("filters by date window", () => {
    const out = filterLeads(leads, { ...EMPTY_CRITERIA, date: "7d" }, NOW);
    expect(out.map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("combines filters as AND", () => {
    const out = filterLeads(
      leads,
      { ...EMPTY_CRITERIA, niche: "legal", date: "7d" },
      NOW,
    );
    expect(out).toHaveLength(0);
  });

  it("searches company, contact, niche and email", () => {
    const withEmail = [lead({ id: "z", company_name: "X", email: "iroda@ceg.hu" })];
    expect(filterLeads(withEmail, { ...EMPTY_CRITERIA, q: "iroda@" }, NOW)).toHaveLength(1);
    expect(filterLeads(leads, { ...EMPTY_CRITERIA, q: "szépség" }, NOW)).toHaveLength(1);
    expect(filterLeads(leads, { ...EMPTY_CRITERIA, q: "  " }, NOW)).toHaveLength(3);
  });

  it("filters by status and source", () => {
    expect(filterLeads(leads, { ...EMPTY_CRITERIA, status: "won" }, NOW)).toHaveLength(1);
    expect(
      filterLeads(leads, { ...EMPTY_CRITERIA, source: "referral" }, NOW),
    ).toHaveLength(0);
  });

  it("filters by contactability", () => {
    const mixed = [
      lead({ id: "r", email: "a@b.hu", email_status: "valid" }),
      lead({ id: "u" }),
    ];
    expect(filterLeads(mixed, { ...EMPTY_CRITERIA, reach: "reachable" }, NOW).map((l) => l.id)).toEqual(["r"]);
    expect(filterLeads(mixed, { ...EMPTY_CRITERIA, reach: "unreachable" }, NOW).map((l) => l.id)).toEqual(["u"]);
  });
});

describe("hasActiveFilters", () => {
  it("is false only when nothing narrows the list", () => {
    expect(hasActiveFilters(EMPTY_CRITERIA)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_CRITERIA, q: "  " })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_CRITERIA, niche: "dental" })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_CRITERIA, date: "today" })).toBe(true);
  });
});
