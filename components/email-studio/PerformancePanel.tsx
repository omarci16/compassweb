"use client";

import { BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EmailVoiceProfile } from "@/lib/types/app.types";
import type { VoiceProfilePerformance } from "@/lib/data/queries";
import { SITUATION_LABELS_HU } from "@/lib/email-studio/situation-labels";

export function PerformancePanel({
  profiles,
  performance,
}: {
  profiles: EmailVoiceProfile[];
  performance: VoiceProfilePerformance[];
}) {
  const perfByProfile = new Map(performance.map((p) => [p.voice_profile_id, p]));
  const rows = profiles
    .map((p) => ({ profile: p, perf: perfByProfile.get(p.id) }))
    .filter((r) => r.perf && r.perf.sent > 0)
    .sort((a, b) => (b.perf?.sent ?? 0) - (a.perf?.sent ?? 0));

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Küldve / megnyitva / kattintva a Resend webhookokból (automatikus, pontos). Konvertált =
        a leadhez tartozó üzlet nyert státuszba került. Válasz-arány nincs itt, mert az ERP-ben
        ma nincs automatikus válasz-felismerés — csak kézi jelölés az Outreach oldalon.
      </p>
      {rows.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Még nincs adat"
          description="Amint egy profil piszkozatai kimennek és a Resend visszajelez, itt megjelenik a teljesítmény."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profil</TableHead>
                  <TableHead>Szituáció</TableHead>
                  <TableHead className="text-right">Küldve</TableHead>
                  <TableHead className="text-right">Megnyitva</TableHead>
                  <TableHead className="text-right">Kattintva</TableHead>
                  <TableHead className="text-right">Konvertált</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ profile, perf }) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profile.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {SITUATION_LABELS_HU[profile.situation]}
                    </TableCell>
                    <TableCell className="text-right">{perf?.sent}</TableCell>
                    <TableCell className="text-right">
                      {perf?.sent ? Math.round(((perf.opened ?? 0) / perf.sent) * 100) : 0}%
                    </TableCell>
                    <TableCell className="text-right">{perf?.clicked}</TableCell>
                    <TableCell className="text-right">{perf?.converted}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
