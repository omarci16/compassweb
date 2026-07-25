// Optional buying signal: does this business currently run paid ads?
// Source: Meta Ad Library API (free; EU/Hungary covered by the DSA transparency
// rules). A business already buying ads has a marketing budget and a growth
// intent — it will pay to convert that traffic better.
//
// OPTIONAL by design: with no META_AD_LIBRARY_TOKEN this no-ops to `null`
// (mirrors how runPagespeed degrades without PAGESPEED_API_KEY). Never throws —
// a failed lookup is "we don't know", never a false positive.

import type { AdsSignal } from "@/lib/types/app.types";

const AD_LIBRARY_ENDPOINT = "https://graph.facebook.com/v19.0/ads_archive";

/**
 * Look up whether `companyName` has active ads in the Meta Ad Library (Hungary).
 * Returns null when the token is absent or the lookup fails — callers treat
 * null as "unknown" (no score delta, no route change).
 */
export async function detectAdsSignal(
  companyName: string | null | undefined,
): Promise<AdsSignal | null> {
  const token = process.env.META_AD_LIBRARY_TOKEN;
  if (!token) return null; // graceful no-op — feature simply off
  const name = (companyName ?? "").trim();
  if (!name) return null;

  const params = new URLSearchParams({
    search_terms: name,
    ad_reached_countries: JSON.stringify(["HU"]),
    ad_active_status: "ACTIVE",
    ad_type: "ALL",
    fields: "id",
    limit: "10",
    access_token: token,
  });

  try {
    const res = await fetch(`${AD_LIBRARY_ENDPOINT}?${params.toString()}`, {
      method: "GET",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: unknown[] };
    const adCount = Array.isArray(data.data) ? data.data.length : 0;
    return {
      runs_ads: adCount > 0,
      source: "meta_ad_library",
      ad_count: adCount,
      checked_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
