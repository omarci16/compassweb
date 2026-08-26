// Pure helpers for turning an AI outreach result into a persisted/renderable
// draft: pull the VERIFIED grounding for the upgrade pitch, and expand spintax
// once so the HTML and plaintext bodies pick the same variant.

import { applySpintax } from "./spintax";
import type { PainSignal } from "@/lib/types/app.types";

/**
 * VERIFIED pain-signal labels (Hungarian) — the ONLY grounding the upgrade
 * pitch is allowed to use. Heuristic (unverified) signals are excluded so the
 * "convert more" email can't cite something we didn't actually measure.
 */
export function verifiedSignalLabels(
  painSignals: PainSignal[] | null | undefined,
): string[] {
  if (!Array.isArray(painSignals)) return [];
  return painSignals
    .filter((s) => s.confidence === "verified")
    .map((s) => s.label_hu || s.label_en)
    .filter((l): l is string => Boolean(l));
}

export interface RenderedBody {
  body_html: string;
  body_text: string;
  spintax_variant: string | null;
}

/**
 * Expand spintax in the HTML + text bodies. A single shared seed means the same
 * `{a|b}` group resolves identically in both representations. No-op when the AI
 * didn't emit spintax (variant becomes null).
 */
export function renderDraftBody(bodyHtml: string, bodyText: string): RenderedBody {
  const seed = Math.floor(Math.random() * 2 ** 31);
  const html = applySpintax(bodyHtml, seededRng(seed));
  const text = applySpintax(bodyText, seededRng(seed));
  return {
    body_html: html.text,
    body_text: text.text,
    spintax_variant: html.variant || null,
  };
}

// Small deterministic RNG (mulberry32) so both bodies share the same choices.
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
