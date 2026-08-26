"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, ShieldAlert, ExternalLink, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeHu } from "@/lib/utils/format";

interface Props {
  leadId: string;
  websiteUrl: string | null;
  screenshotUrl: string | null;
  verifiedAt: string | null;
  finalUrl: string | null;
}

/**
 * Shows the rendered homepage screenshot + verification status so a human can
 * eyeball the REAL site before trusting an audit or sending outreach. "Verify"
 * kicks off PageSpeed Insights (+ optional rendered crawl) in the background.
 */
export function WebsiteSnapshotCard({
  leadId,
  websiteUrl,
  screenshotUrl,
  verifiedAt,
  finalUrl,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);

  if (!websiteUrl) return null;

  async function verify() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leads/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, audit_after: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Hiba történt");
        return;
      }
      setQueued(true);
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
            <Camera className="h-4 w-4 text-primary" />
            Weboldal pillanatkép
          </CardTitle>
          {verifiedAt ? (
            <p className="text-xs text-compass-green mt-1 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              Ellenőrizve: {formatRelativeHu(verifiedAt)}
            </p>
          ) : (
            <p className="text-xs text-compass-amber mt-1 flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" />
              Nem ellenőrzött — csak statikus mérés
            </p>
          )}
        </div>
        <Button size="sm" variant={verifiedAt ? "ghost" : "default"} onClick={verify} disabled={loading}>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : verifiedAt ? (
            "Újraellenőrzés"
          ) : (
            "Ellenőrzés futtatása"
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-compass-red">{error}</p>}
        {queued && !error && (
          <p className="text-sm text-muted-foreground italic">
            Ellenőrzés elindítva — frissítsd az oldalt egy percen belül.
          </p>
        )}
        {screenshotUrl ? (
          <a href={finalUrl || websiteUrl} target="_blank" rel="noopener noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screenshotUrl}
              alt="Weboldal pillanatkép"
              className="w-full max-w-xs rounded-md border shadow-sm"
            />
          </a>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Nincs pillanatkép. Futtass ellenőrzést a valós (renderelt) oldal megtekintéséhez.
          </p>
        )}
        {(finalUrl || websiteUrl) && (
          <a
            href={finalUrl || websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {finalUrl || websiteUrl}
          </a>
        )}
      </CardContent>
    </Card>
  );
}
