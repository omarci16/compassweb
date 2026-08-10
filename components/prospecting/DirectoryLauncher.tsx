"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookUser, Loader2 } from "lucide-react";
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
import { PROSPECTING_CITIES } from "@/lib/apify/google-maps-constants";

const ALL_HU = "__all__";

/**
 * Launch a scrape against a trade directory rather than Google Maps.
 *
 * Costs nothing (no Apify), so there is no spend estimate here — the only
 * budget is politeness toward the directory, which the reader enforces with
 * concurrency and spacing caps.
 */
export function DirectoryLauncher() {
  const router = useRouter();
  const [city, setCity] = useState<string>(ALL_HU);
  const [maxResults, setMaxResults] = useState<number>(200);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function launch() {
    setLoading(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/prospecting/directory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "fogorvoskereso",
          niche: "dental",
          city: city === ALL_HU ? null : city,
          max_results: maxResults,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Nem sikerült elindítani");
        return;
      }
      setDone(
        data.demo
          ? "Demo mód — nincs Supabase, a futás kihagyva."
          : data.dispatched
            ? "Elindult. A rendelők pár percen belül megjelennek a Leads listán."
            : "Job létrehozva, de az Inngest nincs beállítva — sorban áll.",
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ismeretlen hiba");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <BookUser className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="font-medium text-sm">fogorvoskereso.hu — országos fogorvos katalógus</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Nem a Google Maps-ről: a szakmai katalógusban olyan rendelők is
            szerepelnek, amiknek gyenge vagy hiányzó a Maps találata. Ingyenes —
            nincs Apify költség.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Város</Label>
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_HU}>Egész Magyarország</SelectItem>
              {PROSPECTING_CITIES.filter((c) => c !== "Hungary").map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Max. rendelő</Label>
          <Input
            type="number"
            min={20}
            max={2000}
            value={maxResults}
            onChange={(e) => setMaxResults(Number(e.target.value))}
          />
        </div>
      </div>

      {error && <p className="text-xs text-compass-red">{error}</p>}
      {done && <p className="text-xs text-compass-green">{done}</p>}

      <Button size="sm" onClick={() => void launch()} disabled={loading}>
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
        ) : (
          <BookUser className="h-3.5 w-3.5 mr-1.5" />
        )}
        Katalógus beolvasása
      </Button>
    </div>
  );
}
