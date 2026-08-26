"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Loader2,
  Hammer,
  Stethoscope,
  Dumbbell,
  Building2,
  Scale,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PROSPECTING_NICHE_LABELS,
  type ProspectingNiche,
} from "@/lib/types/app.types";
import {
  COST_PER_RESULT_USD,
  PROSPECTING_CITIES,
} from "@/lib/apify/google-maps-constants";

const NICHE_ICONS: Record<ProspectingNiche, typeof Sparkles> = {
  beauty: Sparkles,
  fitness: Dumbbell,
  dental: Stethoscope,
  real_estate: Building2,
  legal: Scale,
  hospitality: UtensilsCrossed,
  other: Hammer,
};

const NICHE_BLURBS: Record<ProspectingNiche, string> = {
  beauty:
    "Szalons, kozmetikák, fodrászok — sok IG-only, kevés rendes weboldal.",
  fitness:
    "Edzőtermek, személyi edzők, jóga stúdiók — gyakran régi, foglalási rendszer nélküli oldalak.",
  dental:
    "Fogászatok — magas büdzsé, professzionális image-igény. Hatékonyan konvertál.",
  real_estate:
    "Ingatlanirodák — sok rossz minőségű oldal, magas volumen.",
  legal:
    "Ügyvédi irodák — magas büdzsé, konzervatív image-igény, gyakran elavult oldal.",
  hospitality:
    "Éttermek, kávézók, panziók — nagy volumen, sok gyenge vagy hiányzó oldal.",
  other: "Egyéb — adj meg saját keresési kifejezéseket.",
};

// Single source of truth lives in google-maps-constants (PROSPECTING_CITIES).
const CITY_LABELS: Record<string, string> = { Hungary: "Egész Magyarország" };
const CITIES = PROSPECTING_CITIES.map((value) => ({
  value,
  label: CITY_LABELS[value] ?? value,
}));

export function ScrapeLauncher({ niche }: { niche: ProspectingNiche }) {
  const router = useRouter();
  const Icon = NICHE_ICONS[niche];
  const [city, setCity] = useState<string>("Budapest");
  const [maxResults, setMaxResults] = useState<number>(200);
  const [customTerms, setCustomTerms] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estimatedCost = (maxResults * COST_PER_RESULT_USD).toFixed(2);

  async function launch() {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        niche,
        city,
        max_results: maxResults,
      };
      if (niche === "other") {
        const terms = customTerms
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (terms.length === 0) {
          setError("Adj meg legalább egy keresési kifejezést.");
          setLoading(false);
          return;
        }
        body.search_terms = terms;
      }
      const res = await fetch("/api/prospecting/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Hiba történt");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ismeretlen hiba");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">{PROSPECTING_NICHE_LABELS[niche]}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            {NICHE_BLURBS[niche]}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="space-y-1.5">
          <Label htmlFor={`city-${niche}`} className="text-xs">
            Város
          </Label>
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger id={`city-${niche}`} className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CITIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`max-${niche}`} className="text-xs">
            Max találat
          </Label>
          <Input
            id={`max-${niche}`}
            type="number"
            min={20}
            max={2000}
            step={20}
            value={maxResults}
            onChange={(e) => setMaxResults(Number(e.target.value) || 200)}
            className="h-9"
          />
        </div>
      </div>

      {niche === "other" && (
        <div className="space-y-1.5 mt-3">
          <Label htmlFor={`terms-${niche}`} className="text-xs">
            Keresési kifejezések (vesszővel)
          </Label>
          <Input
            id={`terms-${niche}`}
            placeholder="pl. autóservíz, gumiszerelő"
            value={customTerms}
            onChange={(e) => setCustomTerms(e.target.value)}
            className="h-9"
          />
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>Becsült költség: ${estimatedCost}</span>
      </div>

      {error && (
        <p className="mt-2 text-xs text-compass-red">{error}</p>
      )}

      <Button
        onClick={launch}
        disabled={loading}
        className="mt-4 w-full"
        size="sm"
      >
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            Indítás…
          </>
        ) : (
          <>Lead vadászat indítása</>
        )}
      </Button>
    </div>
  );
}
