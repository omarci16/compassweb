// Spintax — light send-time variation for deliverability. Two identical bodies
// sent from a warming domain look like a template blast; small per-send wording
// changes reduce that fingerprint. The AI may emit `{variantA|variantB}` groups
// in low-risk spots (CTA, sign-off); we expand one variant and record which.
//
// Pure + deterministic given its RNG, so it's unit-tested directly.

export interface SpintaxResult {
  text: string;
  /** Chosen option index per group, joined — e.g. "0-1-0". "" = no groups. */
  variant: string;
}

// Matches a single, non-nested {a|b|c} group.
const GROUP_RE = /\{([^{}]*)\}/g;

/**
 * Expand every top-level `{a|b|c}` group by picking one option. `rng` is
 * injectable (defaults to Math.random) so tests are deterministic. Text with no
 * spintax passes through unchanged with an empty variant signature.
 */
export function applySpintax(
  text: string,
  rng: () => number = Math.random,
): SpintaxResult {
  const chosen: number[] = [];
  const out = text.replace(GROUP_RE, (_match, group: string) => {
    const options = group.split("|");
    const idx = Math.min(options.length - 1, Math.floor(rng() * options.length));
    chosen.push(idx);
    return options[idx] ?? "";
  });
  return { text: out, variant: chosen.join("-") };
}

/** True if the text contains at least one spintax group. */
export function hasSpintax(text: string): boolean {
  GROUP_RE.lastIndex = 0;
  return GROUP_RE.test(text);
}
