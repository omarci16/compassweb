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

  it("pain signals lift a healthy-site lead into the high tier", () => {
    const r = scoreColdLead({
      ...blank,
      niche: "beauty",
      website_url: "https://example.hu",
      website_health: "healthy",
      gmaps_rating: 4.3,
      gmaps_review_count: 40,
      has_email: true,
      pain_signals: [
        { code: "no_analytics", severity: "high", label_hu: "", label_en: "" },
        { code: "no_schema", severity: "high", label_hu: "", label_en: "" },
        { code: "no_open_graph", severity: "medium", label_hu: "", label_en: "" },
        { code: "no_mobile_viewport", severity: "high", label_hu: "", label_en: "" },
      ],
    });
    // base 30 - 5 (healthy) + 10 (beauty) + 8 (rating) + 8 (reviews) + 4 (email)
    // + min(25, 5+5+3+5=18) = 18 → 73
    expect(r.total).toBe(73);
    expect(r.tier).toBe("top");
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
