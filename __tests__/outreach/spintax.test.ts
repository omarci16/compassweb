import { describe, expect, it } from "vitest";
import { applySpintax, hasSpintax } from "@/lib/outreach/spintax";
import { verifiedSignalLabels, renderDraftBody } from "@/lib/outreach/draft-content";
import type { PainSignal } from "@/lib/types/app.types";

describe("applySpintax", () => {
  it("expands a group, deterministic under a fixed rng", () => {
    const r = applySpintax("Kérem, {írjon|jelentkezzen} nálunk.", () => 0);
    expect(r.text).toBe("Kérem, írjon nálunk.");
    expect(r.variant).toBe("0");
    const r2 = applySpintax("Kérem, {írjon|jelentkezzen} nálunk.", () => 0.99);
    expect(r2.text).toBe("Kérem, jelentkezzen nálunk.");
    expect(r2.variant).toBe("1");
  });

  it("handles multiple groups and records the variant signature", () => {
    const r = applySpintax("{A|B} és {C|D|E}", () => 0.99);
    expect(r.text).toBe("B és E");
    expect(r.variant).toBe("1-2");
  });

  it("passes text through unchanged when there is no spintax", () => {
    const r = applySpintax("Nincs itt semmi.");
    expect(r.text).toBe("Nincs itt semmi.");
    expect(r.variant).toBe("");
  });

  it("hasSpintax detects groups reliably across calls", () => {
    expect(hasSpintax("{a|b}")).toBe(true);
    expect(hasSpintax("plain")).toBe(false);
    expect(hasSpintax("{a|b}")).toBe(true); // lastIndex reset — not stateful
  });
});

describe("verifiedSignalLabels", () => {
  const sig = (code: string, confidence: PainSignal["confidence"], label_hu = ""): PainSignal => ({
    code,
    severity: "medium",
    label_hu,
    label_en: `${code}-en`,
    confidence,
  });

  it("keeps only verified signals and prefers the HU label", () => {
    const labels = verifiedSignalLabels([
      sig("no_analytics", "verified", "Nincs analitika"),
      sig("no_schema", "heuristic", "Nincs schema"),
      sig("site_slow", "verified", ""), // empty HU → falls back to EN
    ]);
    expect(labels).toEqual(["Nincs analitika", "site_slow-en"]);
  });

  it("returns [] for null / empty", () => {
    expect(verifiedSignalLabels(null)).toEqual([]);
    expect(verifiedSignalLabels([])).toEqual([]);
  });
});

describe("renderDraftBody", () => {
  it("resolves identical spintax groups the same way in html and text", () => {
    const html = "<p>Kérem, {írjon|jelentkezzen}.</p>";
    const text = "Kérem, {írjon|jelentkezzen}.";
    const r = renderDraftBody(html, text);
    // Whatever variant was picked, both bodies must agree.
    const htmlChoseFirst = r.body_html.includes("írjon");
    const textChoseFirst = r.body_text.includes("írjon");
    expect(htmlChoseFirst).toBe(textChoseFirst);
    expect(r.spintax_variant === "0" || r.spintax_variant === "1").toBe(true);
  });

  it("returns null variant when there is no spintax", () => {
    const r = renderDraftBody("<p>Tiszta.</p>", "Tiszta.");
    expect(r.spintax_variant).toBeNull();
    expect(r.body_html).toBe("<p>Tiszta.</p>");
  });
});
