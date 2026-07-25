import { describe, expect, it } from "vitest";
import { deriveOfferTrack, isRecentlyOpened } from "@/lib/prospecting/offer-track";
import type { PainSignal } from "@/lib/types/app.types";

const sig = (code: string, severity: PainSignal["severity"] = "medium"): PainSignal => ({
  code,
  severity,
  label_hu: "",
  label_en: "",
});

describe("deriveOfferTrack", () => {
  it("needs_site when there is no usable site", () => {
    for (const health of ["no_website", "broken", "redirect_social", "tiny"] as const) {
      expect(
        deriveOfferTrack({ website_url: health === "no_website" ? null : "https://x.hu", website_health: health }),
      ).toBe("needs_site");
    }
    // No URL at all → needs_site regardless of health.
    expect(deriveOfferTrack({ website_url: null, website_health: "healthy" })).toBe("needs_site");
  });

  it("upgrade for a stale site", () => {
    expect(
      deriveOfferTrack({ website_url: "https://x.hu", website_health: "stale" }),
    ).toBe("upgrade");
  });

  it("upgrade when a healthy site has a concrete hook", () => {
    expect(
      deriveOfferTrack({
        website_url: "https://x.hu",
        website_health: "healthy",
        pain_signals: [sig("no_analytics")],
      }),
    ).toBe("upgrade");
    expect(
      deriveOfferTrack({
        website_url: "https://x.hu",
        website_health: "healthy",
        pain_signals: [sig("drag_drop_cms", "low")],
      }),
    ).toBe("upgrade");
  });

  it("upgrade when the business runs ads, even without a site hook", () => {
    expect(
      deriveOfferTrack({
        website_url: "https://x.hu",
        website_health: "healthy",
        pain_signals: [],
        runs_ads: true,
      }),
    ).toBe("upgrade");
  });

  it("low_priority for a healthy site with no hook", () => {
    expect(
      deriveOfferTrack({
        website_url: "https://x.hu",
        website_health: "healthy",
        pain_signals: [sig("no_open_graph", "low")],
      }),
    ).toBe("low_priority");
  });

  it("low_priority when we can't actually see the site", () => {
    for (const health of ["blocked", "unreachable", "js_shell", "unknown"] as const) {
      expect(
        deriveOfferTrack({ website_url: "https://x.hu", website_health: health }),
      ).toBe("low_priority");
    }
    // Not probed yet → don't manufacture an upgrade hook.
    expect(deriveOfferTrack({ website_url: "https://x.hu", website_health: null })).toBe(
      "low_priority",
    );
  });
});

describe("isRecentlyOpened", () => {
  it("true for few reviews + strong rating", () => {
    expect(isRecentlyOpened(4.8, 3)).toBe(true);
    expect(isRecentlyOpened(4.3, 5)).toBe(true);
  });
  it("false when reviews are high or rating weak or data missing", () => {
    expect(isRecentlyOpened(4.9, 40)).toBe(false);
    expect(isRecentlyOpened(3.5, 2)).toBe(false);
    expect(isRecentlyOpened(null, 2)).toBe(false);
    expect(isRecentlyOpened(4.8, null)).toBe(false);
    expect(isRecentlyOpened(4.8, 0)).toBe(false);
  });
});
