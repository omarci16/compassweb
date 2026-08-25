"use client";

import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/EmptyState";
import { VoiceProfileCard } from "@/components/email-studio/VoiceProfileCard";
import { VoiceProfileEditor } from "@/components/email-studio/VoiceProfileEditor";
import { CampaignsPanel } from "@/components/email-studio/CampaignsPanel";
import { PerformancePanel } from "@/components/email-studio/PerformancePanel";
import type { EmailCampaign, EmailVoiceProfile } from "@/lib/types/app.types";
import type { VoiceProfilePerformance } from "@/lib/data/queries";
import { SITUATION_LABELS_HU, SITUATION_ORDER } from "@/lib/email-studio/situation-labels";

export function EmailStudioClient({
  initialProfiles,
  initialCampaigns,
  performance,
}: {
  initialProfiles: EmailVoiceProfile[];
  initialCampaigns: EmailCampaign[];
  performance: VoiceProfilePerformance[];
}) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [editingProfile, setEditingProfile] = useState<EmailVoiceProfile | "new" | null>(null);

  function upsertProfile(updated: EmailVoiceProfile) {
    setProfiles((prev) => {
      const exists = prev.some((p) => p.id === updated.id);
      return exists ? prev.map((p) => (p.id === updated.id ? updated : p)) : [updated, ...prev];
    });
  }

  const perfByProfile = new Map(performance.map((p) => [p.voice_profile_id, p]));

  return (
    <Tabs defaultValue="profiles" className="space-y-4">
      <div className="flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="profiles">Hangnem-profilok</TabsTrigger>
          <TabsTrigger value="campaigns">Kampányok</TabsTrigger>
          <TabsTrigger value="performance">Teljesítmény</TabsTrigger>
        </TabsList>
        <Button size="sm" className="gap-1.5" onClick={() => setEditingProfile("new")}>
          <Plus className="h-3.5 w-3.5" />
          Új profil
        </Button>
      </div>

      <TabsContent value="profiles" className="space-y-6">
        {profiles.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Még nincs hangnem-profil"
            description="Hozz létre egyet, és próbáld ki a sandboxban, mielőtt élesbe mész."
          />
        ) : (
          SITUATION_ORDER.map((situation) => {
            const rows = profiles.filter((p) => p.situation === situation);
            if (rows.length === 0) return null;
            return (
              <div key={situation} className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {SITUATION_LABELS_HU[situation]}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {rows.map((p) => (
                    <VoiceProfileCard
                      key={p.id}
                      profile={p}
                      performance={perfByProfile.get(p.id)}
                      onEdit={() => setEditingProfile(p)}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </TabsContent>

      <TabsContent value="campaigns">
        <CampaignsPanel initialCampaigns={initialCampaigns} profiles={profiles} />
      </TabsContent>

      <TabsContent value="performance">
        <PerformancePanel profiles={profiles} performance={performance} />
      </TabsContent>

      {editingProfile && (
        <VoiceProfileEditor
          profile={editingProfile === "new" ? null : editingProfile}
          onClose={() => setEditingProfile(null)}
          onSaved={(p) => {
            upsertProfile(p);
            setEditingProfile(null);
          }}
        />
      )}
    </Tabs>
  );
}
