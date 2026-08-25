"use client";

import { Star, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PROSPECTING_NICHE_LABELS_HU, type EmailVoiceProfile, type ProspectingNiche } from "@/lib/types/app.types";
import type { VoiceProfilePerformance } from "@/lib/data/queries";

const OFFER_TRACK_LABELS_HU: Record<string, string> = {
  needs_site: "Nincs oldal",
  upgrade: "Upgrade",
  low_priority: "Alacsony prioritás",
};

function nicheLabel(niche: string | null): string {
  if (!niche) return "Minden niche";
  return (PROSPECTING_NICHE_LABELS_HU as Record<string, string>)[niche as ProspectingNiche] ?? niche;
}

export function VoiceProfileCard({
  profile,
  performance,
  onEdit,
}: {
  profile: EmailVoiceProfile;
  performance?: VoiceProfilePerformance;
  onEdit: () => void;
}) {
  return (
    <Card className={!profile.active ? "opacity-60" : undefined}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-medium truncate">{profile.name}</span>
              {profile.is_default && (
                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="font-normal">
                {nicheLabel(profile.niche)}
              </Badge>
              {profile.offer_track && (
                <Badge variant="outline" className="font-normal">
                  {OFFER_TRACK_LABELS_HU[profile.offer_track] ?? profile.offer_track}
                </Badge>
              )}
              {!profile.active && (
                <Badge variant="secondary" className="font-normal">
                  Inaktív
                </Badge>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>

        {profile.voice_description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{profile.voice_description}</p>
        )}

        {performance && performance.sent > 0 && (
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t border-border">
            <span>{performance.sent} küldve</span>
            <span>
              {performance.sent > 0 ? Math.round((performance.opened / performance.sent) * 100) : 0}% megnyitva
            </span>
            <span>{performance.converted} konvertált</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
