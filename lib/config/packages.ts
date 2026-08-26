// Package price bands (HUF). Single source of truth — CLAUDE.md §16.8
// forbids hardcoding these; they used to live directly in
// lib/ai/prompts/draft-proposal.ts's prompt string. Read from here anywhere
// a package price range needs to be shown, prompted, or reasoned about.

import type { Package } from "@/lib/types/app.types";

export interface PackagePriceBand {
  label: string;
  minHuf: number;
  maxHuf: number;
}

export const PACKAGE_PRICE_BANDS: Record<Package, PackagePriceBand> = {
  landing: { label: "single landing page", minHuf: 250_000, maxHuf: 450_000 },
  business: { label: "5–8 page business site", minHuf: 600_000, maxHuf: 1_100_000 },
  ecommerce: { label: "full e-commerce build", minHuf: 1_200_000, maxHuf: 2_500_000 },
};

export const DEFAULT_MONTHLY_RETAINER_HUF = 25_000;

export function formatPackageBandsForPrompt(): string {
  return (Object.entries(PACKAGE_PRICE_BANDS) as [Package, PackagePriceBand][])
    .map(
      ([key, band]) =>
        `- "${key}": ${band.label}, ${band.minHuf.toLocaleString("hu-HU")}–${band.maxHuf.toLocaleString("hu-HU")} Ft`,
    )
    .join("\n");
}
