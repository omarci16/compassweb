"use client";

import { useState } from "react";
import { Loader2, Megaphone, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import { PROSPECTING_NICHE_LABELS_HU, type EmailCampaign, type EmailVoiceProfile } from "@/lib/types/app.types";
import { SITUATION_LABELS_HU } from "@/lib/email-studio/situation-labels";

const STATUS_VARIANT: Record<string, "outline" | "purple" | "success" | "secondary"> = {
  draft: "outline",
  active: "purple",
  completed: "success",
  archived: "secondary",
};

const STATUS_LABEL_HU: Record<string, string> = {
  draft: "Piszkozat",
  active: "Aktív",
  completed: "Lezárva",
  archived: "Archiválva",
};

export function CampaignsPanel({
  initialCampaigns,
  profiles,
}: {
  initialCampaigns: EmailCampaign[];
  profiles: EmailVoiceProfile[];
}) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [voiceProfileId, setVoiceProfileId] = useState("");

  const profileById = new Map(profiles.map((p) => [p.id, p]));

  async function handleCreate() {
    const profile = profileById.get(voiceProfileId);
    if (!profile || !name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/email-studio/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          situation: profile.situation,
          niche: profile.niche,
          offer_track: profile.offer_track,
          voice_profile_id: profile.id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.campaign) {
        setCampaigns((prev) => [data.campaign, ...prev]);
        setName("");
        setVoiceProfileId("");
        setCreating(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/email-studio/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status: status as EmailCampaign["status"] } : c)));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCreating((v) => !v)}>
          <Plus className="h-3.5 w-3.5" /> Új kampány
        </Button>
      </div>

      {creating && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Név</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="pl. Fogászatok — 2026 Q3" />
              </div>
              <div className="space-y-1.5">
                <Label>Hangnem-profil</Label>
                <Select value={voiceProfileId} onValueChange={setVoiceProfileId}>
                  <SelectTrigger><SelectValue placeholder="Válassz profilt" /></SelectTrigger>
                  <SelectContent>
                    {profiles.filter((p) => p.active).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreating(false)}>Mégse</Button>
              <Button onClick={handleCreate} disabled={saving || !name || !voiceProfileId}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                Létrehozás
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Még nincs kampány"
          description="Egy kampány egy lead-szegmenshez rendel egy hangnem-profilt, és követi a teljesítményét."
        />
      ) : (
        <div className="space-y-2">
          {campaigns.map((c) => {
            const profile = profileById.get(c.voice_profile_id);
            return (
              <Card key={c.id}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{c.name}</span>
                      <Badge variant={STATUS_VARIANT[c.status] ?? "outline"} className="font-normal">
                        {STATUS_LABEL_HU[c.status] ?? c.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {SITUATION_LABELS_HU[c.situation]}
                      {c.niche ? ` · ${(PROSPECTING_NICHE_LABELS_HU as Record<string, string>)[c.niche] ?? c.niche}` : ""}
                      {profile ? ` · ${profile.name}` : ""}
                      {c.target_count ? ` · ${c.target_count} lead` : ""}
                    </p>
                  </div>
                  <Select value={c.status} onValueChange={(v) => updateStatus(c.id, v)}>
                    <SelectTrigger className="w-36 shrink-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(STATUS_LABEL_HU).map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_LABEL_HU[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
