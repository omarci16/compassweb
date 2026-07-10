"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Image as ImageIcon,
  Loader2,
  Mail,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  leadId: string;
  /** True if the lead has an email to send to. */
  hasEmail: boolean;
  /** Recipient email for the live preview + send. */
  recipientEmail?: string | null;
  /** Company name — used in alt text and label. */
  companyName?: string | null;
  /** Rendered homepage screenshot — lets the sender eyeball the real site. */
  screenshotUrl?: string | null;
  /** ISO timestamp of the last site verification, or null if unverified. */
  verifiedAt?: string | null;
}

interface DraftResult {
  email_subject: string;
  email_body_html: string;
  email_body_text: string;
  visual_concept: string;
  primary_pain_point_used: string;
  personalization_hook: string;
  tone_notes: string;
}

interface UploadedVisual {
  public_url: string;
  file_name: string;
  size_bytes: number;
  mime_type: string;
}

const EMAIL_SHELL_PREVIEW = (
  bodyHtml: string,
  visualUrls: string[],
  alt: string,
) => `<!doctype html>
<html lang="hu"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f6f6f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f6f4;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:12px;border:1px solid #ececec;">
<tr><td style="padding:28px 32px 8px 32px;"><div style="font-size:14px;font-weight:600;letter-spacing:0.08em;color:#534AB7;text-transform:uppercase;">Compass Marketing</div></td></tr>
<tr><td style="padding:8px 32px 4px 32px;font-size:15px;line-height:1.65;color:#1f2937;">${bodyHtml}</td></tr>
${
  visualUrls.length
    ? `<tr><td style="padding:8px 32px 0 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${visualUrls
        .map(
          (u) =>
            `<tr><td style="padding:16px 0;"><img src="${u}" alt="${alt}" style="display:block;width:100%;max-width:560px;height:auto;border-radius:8px;border:1px solid #e5e7eb;"/></td></tr>`,
        )
        .join("")}</table></td></tr>`
    : ""
}
<tr><td style="padding:8px 32px 28px 32px;"><hr style="border:none;border-top:1px solid #ececec;margin:16px 0;"/><p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">Compass Marketing Kft. · Budapest, Magyarország<br/><a href="mailto:info@compassmarketing.hu" style="color:#534AB7;text-decoration:none;">info@compassmarketing.hu</a></p></td></tr>
</table></td></tr></table></body></html>`;

function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function ColdOutreachModal({
  leadId,
  hasEmail,
  recipientEmail,
  companyName,
  screenshotUrl,
  verifiedAt,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"text" | "visual" | "review">("text");

  // Draft state
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftResult | null>(null);

  // Editable fields
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  // Visual state
  const [visualReady, setVisualReady] = useState(false);
  const [imagePrompt, setImagePrompt] = useState<string | null>(null);
  const [genImgPromptLoading, setGenImgPromptLoading] = useState(false);
  const [uploads, setUploads] = useState<UploadedVisual[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Send state
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const visualUrls = useMemo(() => uploads.map((u) => u.public_url), [uploads]);
  const visualAlt = `${companyName ?? "Compass"} — koncepció`;
  const previewHtml = useMemo(
    () => EMAIL_SHELL_PREVIEW(bodyHtml || "<p>(üres)</p>", visualUrls, visualAlt),
    [bodyHtml, visualUrls, visualAlt],
  );

  const generate = useCallback(async () => {
    setDrafting(true);
    setDraftError(null);
    try {
      const res = await fetch("/api/ai/cold-outreach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lead_id: leadId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDraftError(data.error ?? "Hiba történt");
        return;
      }
      const r = data.result as DraftResult;
      setDraft(r);
      setSubject(r.email_subject);
      setBodyHtml(r.email_body_html);
      setImagePrompt(null);
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Ismeretlen hiba");
    } finally {
      setDrafting(false);
    }
  }, [leadId]);

  const generateImagePrompt = useCallback(async () => {
    if (!draft) return;
    setGenImgPromptLoading(true);
    try {
      const res = await fetch("/api/ai/image-prompt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          visual_concept: draft.visual_concept,
        }),
      });
      const data = await res.json();
      if (res.ok) setImagePrompt(data.prompt as string);
      else setImagePrompt(`Hiba: ${data.error ?? "ismeretlen"}`);
    } finally {
      setGenImgPromptLoading(false);
    }
  }, [draft, leadId]);

  const copyText = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setUploadError(null);
      const list = Array.from(files);
      if (list.length === 0) return;
      setUploading(true);
      try {
        for (const f of list) {
          const fd = new FormData();
          fd.set("lead_id", leadId);
          fd.set("file", f);
          const res = await fetch("/api/outreach/upload-visual", {
            method: "POST",
            body: fd,
          });
          const data = await res.json();
          if (!res.ok) {
            setUploadError(data.error ?? "Feltöltés sikertelen");
            continue;
          }
          setUploads((prev) => [
            ...prev,
            {
              public_url: data.public_url,
              file_name: data.file_name,
              size_bytes: data.size_bytes,
              mime_type: data.mime_type,
            },
          ]);
        }
      } finally {
        setUploading(false);
      }
    },
    [leadId],
  );

  const removeUpload = (url: string) => {
    setUploads((prev) => prev.filter((u) => u.public_url !== url));
  };

  const send = async () => {
    if (!recipientEmail) {
      setSendError("Nincs címzett email cím a leadhez.");
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          to: recipientEmail,
          subject,
          body_html: bodyHtml,
          body_text: htmlToText(bodyHtml),
          visual_urls: visualUrls,
          visual_alt: visualAlt,
          ai_drafted: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error ?? "Küldés sikertelen");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Ismeretlen hiba");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v && !draft && !drafting) {
          void generate();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Mail className="h-3.5 w-3.5 mr-1.5" />
          Cold outreach
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Személyre szabott első üzenet
          </DialogTitle>
          <DialogDescription>
            Claude Sonnet 5 készíti — pain pontok konstruktív felhasználásával, magyar nyelven. Te
            felülvizsgálod, hozzáadod a vizuális koncepciót, és csak a végén küldjük el.
          </DialogDescription>
        </DialogHeader>

        {/* Provenance: let the sender eyeball the REAL site before trusting the
            AI's pain framing. Unverified leads flag a warning. */}
        <div
          className={cn(
            "flex items-center gap-3 rounded-md border px-3 py-2 text-xs",
            verifiedAt
              ? "border-compass-green/30 bg-compass-green/5 text-compass-green"
              : "border-amber-400/40 bg-amber-500/5 text-amber-700",
          )}
        >
          {screenshotUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={screenshotUrl}
              alt="Weboldal pillanatkép"
              className="h-12 w-12 rounded object-cover border shrink-0"
            />
          ) : (
            <ImageIcon className="h-5 w-5 shrink-0" />
          )}
          <span className="leading-snug">
            {verifiedAt
              ? "A weboldal ellenőrizve — a lenti pain pontok renderelt mérésen alapulnak."
              : "A weboldal NINCS ellenőrizve. Nyisd meg a valós oldalt küldés előtt — a pain pontok tévesek lehetnek."}
          </span>
        </div>

        {drafting && !draft && (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            AI fogalmazza a személyre szabott levelet…
          </div>
        )}

        {draftError && (
          <div className="rounded-md border border-compass-red/30 bg-compass-red/5 p-3 text-sm text-compass-red">
            {draftError}
          </div>
        )}

        {draft && (
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="text">1. Szöveg</TabsTrigger>
              <TabsTrigger value="visual">2. Vizuális</TabsTrigger>
              <TabsTrigger value="review" disabled={!subject || !bodyHtml}>
                3. Előnézet & küldés
              </TabsTrigger>
            </TabsList>

            {/* ---------------- TAB 1: TEXT ---------------- */}
            <TabsContent value="text" className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="co-subject">Tárgy</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => copyText("subject", subject)}
                  >
                    {copied === "subject" ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <Input
                  id="co-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="co-body">Üzenet (HTML, &lt;p&gt; bekezdésekkel)</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => copyText("body", bodyHtml)}
                  >
                    {copied === "body" ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <Textarea
                  id="co-body"
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  rows={11}
                  className="font-mono text-[13px] leading-relaxed"
                />
                <div className="rounded-md border border-border bg-muted/40 p-3 text-[13px] leading-relaxed">
                  <div className="text-xs font-medium text-muted-foreground mb-1.5">
                    Renderelt előnézet (csak szöveg)
                  </div>
                  <div
                    className="prose prose-sm max-w-none [&_p]:my-2"
                    dangerouslySetInnerHTML={{ __html: bodyHtml }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground border-t pt-3">
                <div>
                  <div className="font-medium text-foreground/70">Fő pain pont</div>
                  <div>{draft.primary_pain_point_used}</div>
                </div>
                <div>
                  <div className="font-medium text-foreground/70">Hook</div>
                  <div>{draft.personalization_hook}</div>
                </div>
                <div>
                  <div className="font-medium text-foreground/70">Hangnem</div>
                  <div>{draft.tone_notes}</div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void generate()}
                  disabled={drafting}
                >
                  {drafting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Újragenerálás
                </Button>
                <Button size="sm" onClick={() => setTab("visual")}>
                  Tovább a vizuálishoz →
                </Button>
              </div>
            </TabsContent>

            {/* ---------------- TAB 2: VISUAL ---------------- */}
            <TabsContent value="visual" className="space-y-4">
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  AI által javasolt vizuális koncepció
                </div>
                <p className="text-sm leading-relaxed">{draft.visual_concept}</p>
              </div>

              <div className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="visual-ready" className="text-sm">
                    Van már elkészített vizuális?
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Ha még nincs, generálok promptot ChatGPT képgenerátorhoz.
                  </p>
                </div>
                <Switch
                  id="visual-ready"
                  checked={visualReady}
                  onCheckedChange={setVisualReady}
                />
              </div>

              {!visualReady && (
                <div className="space-y-3 rounded-md border border-dashed border-primary/40 bg-primary/5 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wand2 className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">
                        Image-prompt ChatGPT Image Gen 2.0-hoz
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void generateImagePrompt()}
                      disabled={genImgPromptLoading}
                    >
                      {genImgPromptLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      {imagePrompt ? "Újragenerálás" : "Prompt generálása"}
                    </Button>
                  </div>
                  {imagePrompt && (
                    <div className="space-y-2">
                      <Textarea
                        value={imagePrompt}
                        onChange={(e) => setImagePrompt(e.target.value)}
                        rows={8}
                        className="font-mono text-[12px] leading-relaxed bg-background"
                      />
                      <div className="flex items-center justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyText("img-prompt", imagePrompt)}
                        >
                          {copied === "img-prompt" ? (
                            <Check className="h-3 w-3 mr-1.5" />
                          ) : (
                            <Copy className="h-3 w-3 mr-1.5" />
                          )}
                          Vágólapra
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Másold, illeszd be a ChatGPT Image Gen 2.0-ba, generáld le, majd húzd ide a
                        kész képet.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Drag-and-drop upload zone — always visible */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files.length > 0) {
                    void handleFiles(e.dataTransfer.files);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "rounded-md border-2 border-dashed p-6 text-center cursor-pointer transition-colors",
                  dragOver
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted/40",
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  hidden
                  onChange={(e) => {
                    if (e.target.files) void handleFiles(e.target.files);
                    e.currentTarget.value = "";
                  }}
                />
                <div className="flex flex-col items-center gap-2">
                  {uploading ? (
                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                  ) : (
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  )}
                  <div className="text-sm font-medium">
                    Húzd ide a kész vizuális(oka)t, vagy kattints a feltöltéshez
                  </div>
                  <div className="text-xs text-muted-foreground">
                    PNG / JPG / WEBP / GIF · max 10 MB
                  </div>
                </div>
              </div>

              {uploadError && (
                <div className="rounded-md border border-compass-red/30 bg-compass-red/5 p-2 text-xs text-compass-red">
                  {uploadError}
                </div>
              )}

              {uploads.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {uploads.map((u) => (
                    <div
                      key={u.public_url}
                      className="group relative rounded-md border border-border overflow-hidden bg-muted/40"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={u.public_url}
                        alt={u.file_name}
                        className="w-full h-32 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeUpload(u.public_url)}
                        className="absolute top-1.5 right-1.5 rounded-md bg-background/90 border border-border p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Eltávolítás"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                      <div className="px-2 py-1 text-[11px] truncate text-muted-foreground bg-background border-t border-border">
                        {u.file_name}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" size="sm" onClick={() => setTab("text")}>
                  ← Vissza a szöveghez
                </Button>
                <Button size="sm" onClick={() => setTab("review")}>
                  Tovább az előnézethez →
                </Button>
              </div>
            </TabsContent>

            {/* ---------------- TAB 3: REVIEW & SEND ---------------- */}
            <TabsContent value="review" className="space-y-4">
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5 text-sm">
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <span className="text-muted-foreground">Címzett:</span>
                  <span className="font-medium">
                    {recipientEmail ?? (
                      <span className="text-compass-red">Nincs cím a leadhez</span>
                    )}
                  </span>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <span className="text-muted-foreground">Feladó:</span>
                  <span>info@compassmarketing.hu</span>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <span className="text-muted-foreground">Tárgy:</span>
                  <span className="font-medium">{subject}</span>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <span className="text-muted-foreground">Vizuálisok:</span>
                  <span>
                    {uploads.length === 0 ? (
                      <Badge variant="outline" className="font-normal">
                        Nincs (csak szöveges levél)
                      </Badge>
                    ) : (
                      `${uploads.length} db csatolva`
                    )}
                  </span>
                </div>
              </div>

              <div className="rounded-md border border-border overflow-hidden bg-background">
                <div className="px-3 py-1.5 border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <ImageIcon className="h-3 w-3" />
                  Formázott HTML előnézet (pontosan ezt kapja a címzett)
                </div>
                <iframe
                  title="Email preview"
                  srcDoc={previewHtml}
                  className="w-full h-[460px] bg-white"
                  sandbox=""
                />
              </div>

              {sendError && (
                <div className="rounded-md border border-compass-red/30 bg-compass-red/5 p-3 text-sm text-compass-red">
                  {sendError}
                </div>
              )}

              {!hasEmail && (
                <p className="text-xs text-amber-700">
                  Ehhez a leadhez nincs eltárolt email cím. Add hozzá a lead profilban, hogy
                  küldhető legyen.
                </p>
              )}

              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" size="sm" onClick={() => setTab("visual")}>
                  ← Vissza
                </Button>
                <Button
                  onClick={() => void send()}
                  disabled={sending || !recipientEmail || !subject || !bodyHtml}
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <Send className="h-4 w-4 mr-1.5" />
                  )}
                  Küldés Resenden át
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
