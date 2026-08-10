import { describe, expect, it } from "vitest";
import { scoreColdLead } from "@/lib/ai/scoring/cold-lead-score";

const blank = {
  niche: "other" as const,
  gmaps_rating: null,
  gmaps_review_count: null,
  website_url: null,
  website_health: null,
  social_links_count: 0,
  has_email: false,
  has_phone: false,
};

describe("scoreColdLead", () => {
  it("base score for an empty 'other' niche lead with nothing set is 30 + 40 (no website)", () => {
    const r = scoreColdLead({ ...blank });
    // No website still fires the +40 signal because no URL means no_website
    expect(r.total).toBe(70);
    expect(r.tier).toBe("top");
  });

  it("dental + no website + good rating + sweet-spot reviews scores in 'top' tier", () => {
    const r = scoreColdLead({
      ...blank,
      niche: "dental",
      gmaps_rating: 4.6,
      gmaps_review_count: 80,
      has_phone: true,
    });
    // base 30 + no_website 40 + dental 12 + rating 8 + reviews 8 + phone 2 = 100 (clamped)
    expect(r.total).toBe(100);
    expect(r.tier).toBe("top");
  });

  it("beauty business with healthy website scores lower", () => {
    const r = scoreColdLead({
      ...blank,
      niche: "beauty",
      website_url: "https://example.hu",
      website_health: "healthy",
      gmaps_rating: 4.5,
      gmaps_review_count: 50,
      has_email: true,
      has_phone: true,
      social_links_count: 2,
    });
    // base 30 - 5 + 10 + 8 + 8 + 4 + 2 + 3 = 60
    expect(r.total).toBe(60);
    expect(r.tier).toBe("high");
  });

  it("broken website fires the broken signal", () => {
    const r = scoreColdLead({
      ...blank,
      niche: "fitness",
      website_url: "https://example.hu",
      website_health: "broken",
    });
    expect(r.signals.some((s) => s.label.includes("broken"))).toBe(true);
    expect(r.total).toBeGreaterThan(60);
  });

  it("'we couldn't look' statuses contribute ZERO buy signal", () => {
    // A site we couldn't reach / that blocked us / that is a JS shell must not
    // be boosted like 'broken' — it just means we haven't seen the real site.
    for (const status of ["blocked", "unreachable", "js_shell", "unknown"] as const) {
      const r = scoreColdLead({
        ...blank,
        niche: "other",
        website_url: "https://example.hu",
        website_health: status,
      });
      // base 30, URL present so no_website (+40) does NOT fire, status adds 0.
      expect(r.total).toBe(30);
      expect(r.tier).toBe("low");
    }
  });

  it("redirect-to-social is treated as a strong signal", () => {
    const r = scoreColdLead({
      ...blank,
      niche: "beauty",
      website_url: "https://instagram.com/whatever",
      website_health: "redirect_social",
      gmaps_rating: 4.2,
      gmaps_review_count: 25,
    });
    // 30 + 28 + 10 + 8 + 8 = 84
    expect(r.total).toBe(84);
    expect(r.tier).toBe("top");
  });

  it("enterprise with thousands of reviews loses points", () => {
    const r = scoreColdLead({
      ...blank,
      niche: "real_estate",
      gmaps_review_count: 2000,
    });
    expect(r.signals.some((s) => s.label.includes("enterprise"))).toBe(true);
  });

  it("very new business with <3 reviews loses points", () => {
    const r = scoreColdLead({
      ...blank,
      niche: "beauty",
      gmaps_review_count: 1,
    });
    expect(r.signals.some((s) => s.label.includes("Very new"))).toBe(true);
  });

  it("tiers map correctly", () => {
    expect(scoreColdLead({ ...blank }).tier).toBe("top"); // 70 (no_website)

    // Force a low-ish score: healthy site, no niche bonus, low reviews
    const low = scoreColdLead({
      ...blank,
      niche: "other",
      website_url: "https://example.hu",
      website_health: "healthy",
      gmaps_review_count: 1,
    });
    // 30 - 5 - 8 = 17 → low
    expect(low.total).toBeLessThan(40);
    expect(low.tier).toBe("low");
  });

  it("an UNVERIFIED healthy site with heuristic pains is capped below top tier", () => {
    const input = {
      ...blank,
      niche: "beauty" as const,
      website_url: "https://example.hu",
      website_health: "healthy" as const,
      gmaps_rating: 4.3,
      gmaps_review_count: 40,
      has_email: true,
      pain_signals: [
        { code: "no_analytics", severity: "high" as const, label_hu: "", label_en: "" },
        { code: "no_schema", severity: "high" as const, label_hu: "", label_en: "" },
        { code: "no_open_graph", severity: "medium" as const, label_hu: "", label_en: "" },
        { code: "no_mobile_viewport", severity: "high" as const, label_hu: "", label_en: "" },
      ],
    };
    // Raw score would be 73, but an unverified live site is capped to 69.
    const r = scoreColdLead(input);
    expect(r.total).toBe(69);
    expect(r.tier).toBe("high");
    expect(r.signals.some((s) => s.label.includes("Unverified"))).toBe(true);

    // Once verified, the same signals are trusted and it reaches top tier.
    const verified = scoreColdLead({ ...input, website_verified: true });
    expect(verified.total).toBe(73);
    expect(verified.tier).toBe("top");
  });

  it("pain signal contribution is capped at +25", () => {
    const r = scoreColdLead({
      ...blank,
      niche: "other",
      website_url: "https://example.hu",
      website_health: "healthy",
      pain_signals: Array(20).fill({
        code: "no_schema",
        severity: "high",
        label_hu: "",
        label_en: "",
      }),
    });
    // base 30 - 5 healthy + 25 (capped) = 50
    expect(r.total).toBe(50);
  });

  it("pain signals dedupe against website_health to avoid double counting", () => {
    const r = scoreColdLead({
      ...blank,
      niche: "other",
      website_url: null,
      website_health: "no_website",
      pain_signals: [
        // This same finding is already covered by website_health = no_website
        { code: "no_website", severity: "high", label_hu: "", label_en: "" },
      ],
    });
    // base 30 + 40 (no_website) — no double count
    expect(r.total).toBe(70);
  });

  it("legal is a high-value niche (+12), like dental", () => {
    const r = scoreColdLead({
      ...blank,
      niche: "legal",
      website_url: null,
      website_health: "no_website",
    });
    // base 30 + no_website 40 + legal 12 = 82
    expect(r.signals.some((s) => s.label.includes("legal"))).toBe(true);
    expect(r.total).toBe(82);
    expect(r.tier).toBe("top");
  });

  it("hospitality gets a moderate niche boost (+6)", () => {
    const withNiche = scoreColdLead({
      ...blank,
      niche: "hospitality",
      website_url: null,
      website_health: "no_website",
    });
    const otherBaseline = scoreColdLead({
      ...blank,
      niche: "other",
      website_url: null,
      website_health: "no_website",
    });
    // hospitality (+6) sits above 'other' (0) but below dental/legal (+12).
    expect(withNiche.total - otherBaseline.total).toBe(6);
  });

  it("historical niche win rate nudges the score up and down", () => {
    const up = scoreColdLead({
      ...blank,
      niche: "dental",
      website_url: null,
      website_health: "no_website",
      historical_niche_win_rates: { dental: 75 },
    });
    const down = scoreColdLead({
      ...blank,
      niche: "dental",
      website_url: null,
      website_health: "no_website",
      historical_niche_win_rates: { dental: 10 },
    });
    // >60% → +8, <20% → -8, so a 16-point swing.
    expect(up.total - down.total).toBe(16);
  });

  it("runs_ads adds a budget signal (+10)", () => {
    const withAds = scoreColdLead({
      ...blank,
      niche: "other",
      website_url: "https://x.hu",
      website_health: "healthy",
      runs_ads: true,
    });
    const without = scoreColdLead({
      ...blank,
      niche: "other",
      website_url: "https://x.hu",
      website_health: "healthy",
    });
    expect(withAds.total - without.total).toBe(10);
    expect(withAds.signals.some((s) => s.label.includes("ads"))).toBe(true);
  });

  it("recently_opened adds a timing signal (+5)", () => {
    const withNew = scoreColdLead({
      ...blank,
      niche: "other",
      website_url: "https://x.hu",
      website_health: "healthy",
      recently_opened: true,
    });
    const without = scoreColdLead({
      ...blank,
      niche: "other",
      website_url: "https://x.hu",
      website_health: "healthy",
    });
    expect(withNew.total - without.total).toBe(5);
  });

  it("clamps to 0–100", () => {
    const r = scoreColdLead({
      ...blank,
      niche: "dental",
      gmaps_rating: 5,
      gmaps_review_count: 50,
      has_email: true,
      has_phone: true,
      social_links_count: 3,
    });
    expect(r.total).toBeLessThanOrEqual(100);
    expect(r.total).toBeGreaterThanOrEqual(0);
  });
});
