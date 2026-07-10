import { describe, expect, it } from "vitest";
import { mergeVerification, type PsiResult } from "@/lib/prospecting/verify-site";
import type { MergeInput } from "@/lib/prospecting/verify-site";
import type { PainSignal, TechStack } from "@/lib/types/app.types";

const tech = (over: Partial<TechStack> = {}): TechStack => ({
  cms: null,
  ecommerce: null,
  analytics: [],
  booking: null,
  has_blog: false,
  has_schema_org: false,
  has_open_graph: false,
  has_viewport_meta: true,
  has_https: false,
  has_contact_form: true,
  has_sitemap: null,
  ...over,
});

const sig = (code: string, confidence: PainSignal["confidence"]): PainSignal => ({
  code,
  severity: "high",
  label_hu: "",
  label_en: "",
  confidence,
});

const psi = (over: Partial<PsiResult> = {}): PsiResult => ({
  final_url: "https://x.hu",
  https_ok: true,
  viewport_ok: true,
  performance: 0.9,
  screenshot_base64: null,
  ...over,
});

describe("mergeVerification — PSI only (path B)", () => {
  it("drops heuristic signals that PSI contradicts", () => {
    const current: MergeInput = {
      health_status: "healthy",
      pain_signals: [
        sig("no_https", "verified"),
        sig("no_mobile_viewport", "heuristic"),
        sig("no_schema", "heuristic"),
        sig("site_slow", "heuristic"),
      ],
      tech_stack: tech({ has_https: false }),
      requested_url: "https://x.hu",
      final_url: "https://x.hu",
    };

    const r = mergeVerification(current, psi());

    const codes = r.pain_signals.map((s) => s.code);
    expect(codes).not.toContain("no_https"); // https_ok
    expect(codes).not.toContain("no_mobile_viewport"); // viewport_ok
    expect(codes).not.toContain("site_slow"); // performance 0.9
    expect(codes).toContain("no_schema"); // PSI can't refute this — kept
    expect(r.tech_stack?.has_https).toBe(true);
  });

  it("reclassifies a js_shell as healthy once PSI renders it", () => {
    const current: MergeInput = {
      health_status: "js_shell",
      pain_signals: [],
      tech_stack: tech(),
      requested_url: "https://spa.hu",
      final_url: "https://spa.hu",
    };
    const r = mergeVerification(current, psi());
    expect(r.health_status).toBe("healthy");
  });

  it("returns current unchanged when PSI failed (null)", () => {
    const current: MergeInput = {
      health_status: "healthy",
      pain_signals: [sig("no_schema", "heuristic")],
      tech_stack: tech(),
      requested_url: "https://x.hu",
      final_url: "https://x.hu",
    };
    const r = mergeVerification(current, null);
    expect(r.pain_signals.map((s) => s.code)).toEqual(["no_schema"]);
    expect(r.health_status).toBe("healthy");
  });
});

describe("mergeVerification — rendered crawl (path A)", () => {
  const bigRendered =
    `<html><head><meta name="viewport" content="width=device-width">` +
    `<script>gtag('js', new Date());</script></head><body>` +
    "<p>Rendered content. </p>".repeat(500) +
    `<form></form></body></html>`;

  it("a JS shell with rich rendered content becomes healthy, signals verified", () => {
    const current: MergeInput = {
      health_status: "js_shell",
      pain_signals: [],
      tech_stack: null,
      requested_url: "https://spa.hu",
      final_url: "https://spa.hu",
    };

    const r = mergeVerification(current, psi(), bigRendered);

    expect(r.health_status).toBe("healthy");
    // The rendered page has viewport + analytics + form, so no false content
    // pains. Schema/OG are absent → those signals may fire, but VERIFIED.
    for (const s of r.pain_signals) {
      expect(s.confidence).toBe("verified");
    }
    expect(r.pain_signals.map((s) => s.code)).not.toContain("no_mobile_viewport");
    expect(r.pain_signals.map((s) => s.code)).not.toContain("no_analytics");
  });
});
