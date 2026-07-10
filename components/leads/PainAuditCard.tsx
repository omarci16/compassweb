"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeHu } from "@/lib/utils/format";

interface Props {
  leadId: string;
  audit: string | null;
  generatedAt: string | null;
  /** True if we have signals or enrichment to audit on */
  canGenerate: boolean;
}

export function PainAuditCard({ leadId, audit: initialAudit, generatedAt: initialAt, canGenerate }: Props) {
  const router = useRouter();
  const [audit, setAudit] = useState<string | null>(initialAudit);
  const [generatedAt, setGeneratedAt] = useState<string | null>(initialAt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(force: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/pain-audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, force }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Hiba történt");
        return;
      }
      setAudit(data.audit);
      setGeneratedAt(new Date().toISOString());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ismeretlen hiba");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Pain audit
          </CardTitle>
          {generatedAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Generálva: {formatRelativeHu(generatedAt)}
            </p>
          )}
        </div>
        {audit ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => generate(true)}
            disabled={loading || !canGenerate}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => generate(false)}
            disabled={loading || !canGenerate}
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                AI dolgozik…
              </>
            ) : (
              <>Audit generálása</>
            )}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-sm text-compass-red mb-3">{error}</p>
        )}
        {audit ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
            {audit}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            {canGenerate
              ? "Még nincs audit. Generáláskor az AI csak az ELLENŐRZÖTT jeleket fordítja le konkrét üzleti veszteségekre."
              : "Audit nem generálható — előbb ellenőrizd a weboldalt (fent), vagy nincs ellenőrzött jel / enrichment adat."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
