"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PROSPECTING_NICHE_LABELS,
  type ProspectingNiche,
} from "@/lib/types/app.types";
import {
  COST_PER_RESULT_USD,
  PROSPECTING_CITIES,
} from "@/lib/apify/google-maps-constants";

// 'other' has no built-in search terms, so it's excluded from batch runs.
const BATCH_NICHES: ProspectingNiche[] = [
  "beauty",
  "fitness",
  "dental",
  "real_estate",
  "legal",
  "hospitality",
];

const CITY_LABELS: Record<string, string> = { Hungary: "Egész Magyarország" };

export function BatchLauncher() {
  const router = useRouter();
  const [niches, setNiches] = useState<Set<ProspectingNiche>>(
    new Set(["beauty", "dental", "legal", "hospitality"]),
  );
  const [cities, setCities] = useState<Set<string>>(new Set(["Budapest", "Debrecen"]));
  const [maxResults, setMaxResults] = useState<number>(150);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const jobCount = niches.size * cities.size;
  const estimatedCost = useMemo(
    () => (jobCount * maxResults * COST_PER_RESULT_USD).toFixed(2),
    [jobCount, maxResults],
  );

  const toggle = <T,>(set: Set<T>, value: T): Set<T> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  async function launch() {
    setLoading(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/prospecting/batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          niches: Array.from(niches),
          cities: Array.from(cities),
          max_results: maxResults,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Hiba történt");
        return;
      }
      setDone(
        data.demo
          ? `Demo mód — ${data.planned_jobs} vadászat indulna éles kulcsokkal.`
          : `${data.created} vadászat elindítva.`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ismeretlen hiba");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/[0.03] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Rocket className="h-4.5 w-4.5" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">Batch vadászat</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            Több iparág × több város egyetlen kattintással. Minden kombináció külön vadászat lesz.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Iparágak
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {BATCH_NICHES.map((n) => (
              <label
                key={n}
                className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-sm cursor-pointer hover:bg-accent/40"
              >
                <Checkbox
                  checked={niches.has(n)}
                  onCheckedChange={() => setNiches((s) => toggle(s, n))}
                />
                {PROSPECTING_NICHE_LABELS[n]}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Városok
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {PROSPECTING_CITIES.map((c) => (
              <label
                key={c}
                className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-sm cursor-pointer hover:bg-accent/40"
              >
                <Checkbox
                  checked={cities.has(c)}
                  onCheckedChange={() => setCities((s) => toggle(s, c))}
                />
                {CITY_LABELS[c] ?? c}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-5 max-w-xs">
        <div className="space-y-1.5">
          <Label htmlFor="batch-max" className="text-xs">
            Max találat / vadászat
          </Label>
          <Input
            id="batch-max"
            type="number"
            min={20}
            max={2000}
            step={10}
            value={maxResults}
            onChange={(e) => setMaxResults(Number(e.target.value) || 150)}
            className="h-9"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          <strong className="text-foreground">{jobCount}</strong> vadászat
          ({niches.size} iparág × {cities.size} város)
        </span>
        <span>Becsült költség: ${estimatedCost}</span>
      </div>

      {error && <p className="mt-2 text-xs text-compass-red">{error}</p>}
      {done && <p className="mt-2 text-xs text-compass-green">{done}</p>}

      <Button
        onClick={launch}
        disabled={loading || jobCount === 0}
        className="mt-4"
        size="sm"
      >
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            Indítás…
          </>
        ) : (
          <>
            <Rocket className="h-3.5 w-3.5 mr-1.5" />
            {jobCount} vadászat indítása
          </>
        )}
      </Button>
    </div>
  );
}
