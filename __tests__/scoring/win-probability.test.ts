import { describe, expect, it } from "vitest";
import {
  combineWithAi,
  computeBaseScore,
} from "@/lib/ai/scoring/win-probability";

describe("computeBaseScore", () => {
  const blankLead = {
    budget_confirmed: false,
    decision_maker_confirmed: false,
    has_existing_website: false,
    timeline_weeks: null,
    package_interest: null,
    source: "other",
    niche: null,
  } as const;

  it("returns base when no signals fire", () => {
    const r = computeBaseScore({ lead: { ...blankLead } });
    expect(r.total).toBe(30);
    expect(r.signals).toHaveLength(0);
  });

  it("adds budget + decision-maker signals", () => {
    const r = computeBaseScore({
      lead: { ...blankLead, budget_confirmed: true, decision_maker_confirmed: true },
    });
    expect(r.total).toBe(70); // 30 + 25 + 15
  });

  it("clamps at 100 when many positive signals fire", () => {
    const r = computeBaseScore({
      lead: {
        ...blankLead,
        budget_confirmed: true,
        decision_maker_confirmed: true,
        has_existing_website: true,
        timeline_weeks: 2,
        source: "referral",
        niche: "dental",
      },
      historical_niche_win_rates: { dental: 75 },
    });
    expect(r.total).toBe(100);
  });

  it("penalises Instagram cold DM source", () => {
    const r = computeBaseScore({ lead: { ...blankLead, source: "instagram_dm" } });
    expect(r.total).toBe(20); // 30 - 10
  });

  it("penalises landing-only interest", () => {
    const r = computeBaseScore({ lead: { ...blankLead, package_interest: "landing" } });
    expect(r.total).toBe(25); // 30 - 5
  });

  it("does not double-count timeline tiers (≤2 adds 10+5)", () => {
    const r = computeBaseScore({ lead: { ...blankLead, timeline_weeks: 1 } });
    expect(r.total).toBe(45); // 30 + 10 + 5
  });

  it("ignores niche history under threshold", () => {
    const r = computeBaseScore({
      lead: { ...blankLead, niche: "weak_niche" },
      historical_niche_win_rates: { weak_niche: 40 },
    });
    expect(r.total).toBe(30);
  });

  it("clamps at 0 with all negative signals", () => {
    const r = computeBaseScore({
      lead: { ...blankLead, source: "instagram_dm", package_interest: "landing" },
    });
    expect(r.total).toBe(15); // 30 - 10 - 5
  });
});

describe("combineWithAi", () => {
  it("respects ±20 bound", () => {
    expect(combineWithAi({ baseScore: 50, aiAdjustment: 100 })).toBe(70);
    expect(combineWithAi({ baseScore: 50, aiAdjustment: -100 })).toBe(30);
  });

  it("clamps final to 0–100", () => {
    expect(combineWithAi({ baseScore: 95, aiAdjustment: 20 })).toBe(100);
    expect(combineWithAi({ baseScore: 5, aiAdjustment: -20 })).toBe(0);
  });

  it("applies in-range adjustment exactly", () => {
    expect(combineWithAi({ baseScore: 60, aiAdjustment: -15 })).toBe(45);
  });
});
