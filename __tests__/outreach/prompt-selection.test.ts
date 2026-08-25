import { describe, expect, it } from "vitest";
import {
  coldOutreachUserPrompt,
  composeColdFollowupSystem,
  composeColdOutreachSystem,
} from "@/lib/ai/prompts/cold-outreach";
import type { EmailVoiceProfile } from "@/lib/types/app.types";

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

function mockProfile(overrides: Partial<EmailVoiceProfile> = {}): EmailVoiceProfile {
  return {
    id: "profile-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    name: "Test profile",
    situation: "cold_first_touch",
    niche: null,
    offer_track: null,
    is_default: true,
    active: true,
    tone_traits: { register: "tegezes", warmth: "playful" },
    voice_description: "Laza, játékos, fiatalos hangnem.",
    few_shot_examples: [],
    banned_phrases: ["MOCK_BANNED_PHRASE"],
    required_elements: [],
    word_count_min: 50,
    word_count_max: 80,
    signature_block: "Üdv,\nMock Signature",
    visual_style_prompt: null,
    model_override: null,
    created_by: null,
    ...overrides,
  };
}

describe("composeColdOutreachSystem", () => {
  it("upgrade vs needs_site tracks compose different immutable structural rules", () => {
    const profile = mockProfile();
    const needsSite = composeColdOutreachSystem("needs_site", profile);
    const upgrade = composeColdOutreachSystem("upgrade", profile);
    expect(needsSite).not.toBe(upgrade);
    expect(upgrade).toContain("GROUNDING — EZ SZENT, NEM ALKUKÉPES");
    expect(needsSite).not.toContain("GROUNDING — EZ SZENT, NEM ALKUKÉPES");
  });

  it("low_priority falls back to the needs_site structural rules (softest, no strong hook)", () => {
    const profile = mockProfile();
    expect(composeColdOutreachSystem("low_priority", profile)).toBe(
      composeColdOutreachSystem("needs_site", profile),
    );
  });

  it("upgrade track: the verified-signals grounding rule survives regardless of profile content", () => {
    const composed = composeColdOutreachSystem("upgrade", mockProfile());
    expect(composed).toContain("GROUNDING — EZ SZENT, NEM ALKUKÉPES");
    expect(composed).toContain("<verified_signals>");
  });

  it("needs_site track: profile-supplied banned phrases and tone land in the composed prompt", () => {
    const composed = composeColdOutreachSystem("needs_site", mockProfile());
    expect(composed).toContain("MOCK_BANNED_PHRASE");
    expect(composed).toContain("Laza, játékos, fiatalos hangnem.");
    expect(composed).toContain("Mock Signature");
    expect(composed).toContain("50–80 szó");
  });

  it("the immutable structural rules are always present, independent of the profile", () => {
    const composed = composeColdOutreachSystem("needs_site", mockProfile());
    expect(composed).toContain("PAIN POINT KEZELÉS");
    expect(composed).toContain("SPINTAX");
  });
});

describe("composeColdFollowupSystem", () => {
  it("appends the trainable voice block after the immutable follow-up rules", () => {
    const composed = composeColdFollowupSystem(mockProfile({ situation: "cold_followup" }));
    expect(composed).toContain("KÖVETŐ (follow-up)");
    expect(composed).toContain("MOCK_BANNED_PHRASE");
  });
});
