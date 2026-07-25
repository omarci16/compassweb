// Small pure normalisers shared across the prospecting pipeline.
// Kept dependency-free so they can be unit-tested and imported anywhere
// (server routes, Inngest functions) without pulling in Node-only deps.

/**
 * Reduce a website URL to a canonical host for deduplication.
 *
 *   https://WWW.Example.hu/path?x=1  → "example.hu"
 *   http://example.hu               → "example.hu"
 *   example.hu/                      → "example.hu"
 *
 * Returns null when there is no usable host (empty, tel:/mailto:, garbage).
 * Two leads that resolve to the same host are the same business even if Google
 * Maps hands us http vs https, a trailing slash, or a www prefix.
 */
export function normalizeWebsiteHost(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("tel:") || trimmed.startsWith("mailto:")) return null;
  try {
    const u = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    let host = u.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    return host || null;
  } catch {
    return null;
  }
}
