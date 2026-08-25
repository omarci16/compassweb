import { describe, expect, it } from "vitest";
import { scopeFallbackChain } from "@/lib/email-studio/resolve-voice-profile";

describe("scopeFallbackChain", () => {
  it("full scope: exact -> drop offer_track -> drop niche", () => {
    expect(
      scopeFallbackChain({ situation: "cold_first_touch", niche: "dental", offerTrack: "upgrade" }),
    ).toEqual([
      { niche: "dental", offerTrack: "upgrade" },
      { niche: "dental", offerTrack: null },
      { niche: null, offerTrack: null },
    ]);
  });

  it("niche only (no offer_track): exact -> global, no duplicate middle step", () => {
    expect(scopeFallbackChain({ situation: "proposal", niche: "dental", offerTrack: null })).toEqual([
      { niche: "dental", offerTrack: null },
      { niche: null, offerTrack: null },
    ]);
  });

  it("fully universal scope collapses to a single global step", () => {
    expect(scopeFallbackChain({ situation: "deal_followup", niche: null, offerTrack: null })).toEqual([
      { niche: null, offerTrack: null },
    ]);
  });

  it("offer_track without niche: exact -> global (niche already null)", () => {
    expect(
      scopeFallbackChain({ situation: "cold_first_touch", niche: null, offerTrack: "needs_site" }),
    ).toEqual([
      { niche: null, offerTrack: "needs_site" },
      { niche: null, offerTrack: null },
    ]);
  });
});
