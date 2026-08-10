import { describe, expect, it } from "vitest";
import {
  COLD_OUTREACH_SYSTEM,
  COLD_OUTREACH_UPGRADE_SYSTEM,
  coldOutreachUserPrompt,
  pickColdOutreachSystem,
} from "@/lib/ai/prompts/cold-outreach";

describe("pickColdOutreachSystem", () => {
  it("upgrade track → the upgrade system prompt", () => {
    expect(pickColdOutreachSystem("upgrade")).toBe(COLD_OUTREACH_UPGRADE_SYSTEM);
  });

  it("needs_site / low_priority / null → the default system prompt", () => {
    expect(pickColdOutreachSystem("needs_site")).toBe(COLD_OUTREACH_SYSTEM);
    expect(pickColdOutreachSystem("low_priority")).toBe(COLD_OUTREACH_SYSTEM);
    expect(pickColdOutreachSystem(null)).toBe(COLD_OUTREACH_SYSTEM);
  });
});

describe("coldOutreachUserPrompt", () => {
  const base = {
    company_name: "Teszt Kft.",
    contact_name: null,
    niche: "hospitality" as const,
    city: "Budapest",
    category: "étterem",
    website_url: "https://teszt.hu",
    pain_audit: null,
    enrichment_summary: null,
  };

  it("upgrade prompt exposes verified_signals, not pain_audit", () => {
    const p = coldOutreachUserPrompt({
      ...base,
      offer_track: "upgrade",
      verified_signals: ["Nincs analitika", "Lassú betöltés"],
    });
    expect(p).toContain("<verified_signals>");
    expect(p).toContain("Nincs analitika");
    expect(p).not.toContain("<pain_audit>");
  });

  it("needs_site prompt uses the pain_audit block", () => {
    const p = coldOutreachUserPrompt({ ...base, offer_track: "needs_site" });
    expect(p).toContain("<pain_audit>");
    expect(p).not.toContain("<verified_signals>");
  });
});
