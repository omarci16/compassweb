"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2, Wand2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PROSPECTING_NICHE_LABELS_HU,
  type EmailVoiceProfile,
  type FewShotExample,
  type ProspectingNiche,
  type VoiceSituation,
} from "@/lib/types/app.types";
import { SITUATION_LABELS_HU } from "@/lib/email-studio/situation-labels";
import { SAMPLE_LEADS } from "@/lib/email-studio/sample-leads";

const NICHES = Object.keys(PROSPECTING_NICHE_LABELS_HU) as ProspectingNiche[];
const SITUATIONS = Object.keys(SITUATION_LABELS_HU) as VoiceSituation[];

interface FormState {
  name: string;
  situation: VoiceSituation;
  niche: string | null;
  offer_track: string | null;
  active: boolean;
  is_default: boolean;
  voice_description: string;
  register: string;
  warmth: string;
  directness: string;
  banned_phrases: string;
  required_elements: string;
  word_count_min: string;
  word_count_max: string;
  signature_block: string;
  visual_style_prompt: string;
  few_shot_examples: FewShotExample[];
}

function toFormState(p: EmailVoiceProfile | null): FormState {
  return {
    name: p?.name ?? "",
    situation: p?.situation ?? "cold_first_touch",
    niche: p?.niche ?? null,
    offer_track: p?.offer_track ?? null,
    active: p?.active ?? true,
    is_default: p?.is_default ?? false,
    voice_description: p?.voice_description ?? "",
    register: p?.tone_traits.register ?? "",
    warmth: p?.tone_traits.warmth ?? "",
    directness: p?.tone_traits.directness ?? "",
    banned_phrases: (p?.banned_phrases ?? []).join("\n"),
    required_elements: (p?.required_elements ?? []).join("\n"),
    word_count_min: p?.word_count_min != null ? String(p.word_count_min) : "",
    word_count_max: p?.word_count_max != null ? String(p.word_count_max) : "",
    signature_block: p?.signature_block ?? "",
    visual_style_prompt: p?.visual_style_prompt ?? "",
    few_shot_examples: p?.few_shot_examples ?? [],
  };
}

function toProfilePayload(f: FormState) {
  return {
    name: f.name,
    situation: f.situation,
    niche: f.niche,
    offer_track: f.offer_track,
    active: f.active,
    is_default: f.is_default,
    voice_description: f.voice_description || null,
    tone_traits: {
      ...(f.register ? { register: f.register } : {}),
      ...(f.warmth ? { warmth: f.warmth } : {}),
      ...(f.directness ? { directness: f.directness } : {}),
    },
    banned_phrases: f.banned_phrases.split("\n").map((s) => s.trim()).filter(Boolean),
    required_elements: f.required_elements.split("\n").map((s) => s.trim()).filter(Boolean),
    word_count_min: f.word_count_min ? Number(f.word_count_min) : null,
    word_count_max: f.word_count_max ? Number(f.word_count_max) : null,
    signature_block: f.signature_block || null,
    visual_style_prompt: f.visual_style_prompt || null,
    few_shot_examples: f.few_shot_examples,
  };
}

interface PreviewResult {
  email_subject?: string;
  email_body?: string;
  email_body_html?: string;
}

export function VoiceProfileEditor({
  profile,
  onClose,
  onSaved,
}: {
  profile: EmailVoiceProfile | null;
  onClose: () => void;
  onSaved: (p: EmailVoiceProfile) => void;
}) {
  const [form, setForm] = useState<FormState>(() => toFormState(profile));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sampleLeadId, setSampleLeadId] = useState(SAMPLE_LEADS[0]?.id ?? "");
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const isCold = form.situation === "cold_first_touch" || form.situation === "cold_followup";

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addExample() {
    update("few_shot_examples", [...form.few_shot_examples, { subject: "", body_html: "", note: "" }]);
  }
  function updateExample(i: number, patch: Partial<FewShotExample>) {
    update(
      "few_shot_examples",
      form.few_shot_examples.map((ex, idx) => (idx === i ? { ...ex, ...patch } : ex)),
    );
  }
  function removeExample(i: number) {
    update(
      "few_shot_examples",
      form.few_shot_examples.filter((_, idx) => idx !== i),
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload = toProfilePayload(form);
      const res = await fetch(
        profile ? `/api/email-studio/profiles/${profile.id}` : "/api/email-studio/profiles",
        {
          method: profile ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Mentés sikertelen");
      onSaved(data.profile as EmailVoiceProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mentés sikertelen");
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    setPreviewing(true);
    setPreviewError(null);
    setPreview(null);
    try {
      const res = await fetch("/api/email-studio/preview-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: toProfilePayload(form),
          sample_lead_id: sampleLeadId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Előnézet generálása sikertelen");
      setPreview(data.result as PreviewResult);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Előnézet generálása sikertelen");
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{profile ? "Hangnem-profil szerkesztése" : "Új hangnem-profil"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="settings" className="mt-2">
          <TabsList>
            <TabsTrigger value="settings">Beállítások</TabsTrigger>
            <TabsTrigger value="sandbox" className="gap-1.5">
              <Wand2 className="h-3.5 w-3.5" />
              Sandbox
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Név</Label>
                <Input value={form.name} onChange={(e) => update("name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Szituáció</Label>
                <Select
                  value={form.situation}
                  onValueChange={(v) => update("situation", v as VoiceSituation)}
                  disabled={Boolean(profile)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SITUATIONS.map((s) => (
                      <SelectItem key={s} value={s}>{SITUATION_LABELS_HU[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Niche</Label>
                <Select
                  value={form.niche ?? "__all__"}
                  onValueChange={(v) => update("niche", v === "__all__" ? null : v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Minden niche</SelectItem>
                    {NICHES.map((n) => (
                      <SelectItem key={n} value={n}>{PROSPECTING_NICHE_LABELS_HU[n]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isCold && (
                <div className="space-y-1.5">
                  <Label>Ajánlati sáv</Label>
                  <Select
                    value={form.offer_track ?? "__all__"}
                    onValueChange={(v) => update("offer_track", v === "__all__" ? null : v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Mindkettő</SelectItem>
                      <SelectItem value="needs_site">Nincs oldal</SelectItem>
                      <SelectItem value="upgrade">Upgrade</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Hangnem leírása</Label>
              <Textarea
                rows={2}
                value={form.voice_description}
                onChange={(e) => update("voice_description", e.target.value)}
                placeholder="pl. Laza, közvetlen, kicsit humoros, de sosem hivataloskodó."
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Regiszter</Label>
                <Input placeholder="magázás / tegezés" value={form.register} onChange={(e) => update("register", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Melegség</Label>
                <Input placeholder="pl. playful" value={form.warmth} onChange={(e) => update("warmth", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Direktség</Label>
                <Input placeholder="pl. soft" value={form.directness} onChange={(e) => update("directness", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Min. szószám</Label>
                <Input type="number" value={form.word_count_min} onChange={(e) => update("word_count_min", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Max. szószám</Label>
                <Input type="number" value={form.word_count_max} onChange={(e) => update("word_count_max", e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Tiltott kifejezések (soronként)</Label>
              <Textarea rows={3} value={form.banned_phrases} onChange={(e) => update("banned_phrases", e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Kötelező elemek (soronként)</Label>
              <Textarea rows={2} value={form.required_elements} onChange={(e) => update("required_elements", e.target.value)} />
            </div>

            {isCold && (
              <div className="space-y-1.5">
                <Label>Vizuális stílus (mockup)</Label>
                <Textarea
                  rows={2}
                  value={form.visual_style_prompt}
                  onChange={(e) => update("visual_style_prompt", e.target.value)}
                  placeholder="pl. clinical premium — soft blues, clean sans-serif"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Aláírás</Label>
              <Textarea rows={2} value={form.signature_block} onChange={(e) => update("signature_block", e.target.value)} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Példa levelek (few-shot)</Label>
                <Button variant="outline" size="sm" className="gap-1" onClick={addExample}>
                  <Plus className="h-3.5 w-3.5" /> Hozzáadás
                </Button>
              </div>
              {form.few_shot_examples.map((ex, i) => (
                <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Példa {i + 1}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeExample(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Tárgy"
                    value={ex.subject}
                    onChange={(e) => updateExample(i, { subject: e.target.value })}
                  />
                  <Textarea
                    rows={3}
                    placeholder="Törzs (HTML)"
                    value={ex.body_html}
                    onChange={(e) => updateExample(i, { body_html: e.target.value })}
                  />
                  <Input
                    placeholder="Megjegyzés (miért jó ez a példa)"
                    value={ex.note ?? ""}
                    onChange={(e) => updateExample(i, { note: e.target.value })}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <div className="text-sm font-medium">Aktív</div>
                <div className="text-xs text-muted-foreground">Inaktív profilt a rendszer sosem választ ki.</div>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => update("active", v)} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <div className="text-sm font-medium">Alapértelmezett ehhez a hatókörhöz</div>
                <div className="text-xs text-muted-foreground">
                  Az automatikus generálás (batch, sequence) csak alapértelmezett profilt választ.
                  Bekapcsoláskor a jelenlegi alapértelmezett ugyanerre a hatókörre leváltásra kerül.
                </div>
              </div>
              <Switch checked={form.is_default} onCheckedChange={(v) => update("is_default", v)} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>Mégse</Button>
              <Button onClick={handleSave} disabled={saving || !form.name}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                Mentés
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="sandbox" className="space-y-4 pt-2">
            <p className="text-xs text-muted-foreground">
              Generálj egy előnézetet a jelenlegi (még el nem mentett) beállításokkal — semmi
              nem kerül mentésre az outreach sorba.
            </p>
            {form.situation === "re_engagement" ? (
              <p className="text-sm text-muted-foreground">
                A re-engagement piszkozatgenerálás még nincs bekötve — ehhez a szituációhoz nincs
                élő sandbox.
              </p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Minta lead</Label>
                  <Select value={sampleLeadId} onValueChange={setSampleLeadId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SAMPLE_LEADS.map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handlePreview} disabled={previewing} className="gap-1.5">
                  {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  Előnézet generálása
                </Button>

                {previewError && <p className="text-sm text-destructive">{previewError}</p>}

                {preview && (
                  <div className="rounded-lg border border-border p-4 space-y-2 bg-muted/20">
                    <div className="text-sm font-medium">{preview.email_subject}</div>
                    <div
                      className="text-sm leading-relaxed prose-sm"
                      dangerouslySetInnerHTML={{
                        __html: preview.email_body_html ?? preview.email_body ?? "",
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
