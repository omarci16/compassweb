"use client";

import { useState } from "react";
import { Loader2, Mail, Copy, Check, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Props {
  leadId: string;
  /** True if the lead has an email to send to. */
  hasEmail: boolean;
}

export function ColdOutreachModal({ leadId, hasEmail }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [hook, setHook] = useState<string | null>(null);
  const [copied, setCopied] = useState<"subject" | "body" | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/cold-outreach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lead_id: leadId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Hiba történt");
        return;
      }
      setSubject(data.result.email_subject);
      setBodyText(data.result.email_body);
      setHook(data.result.personalization_hook);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ismeretlen hiba");
    } finally {
      setLoading(false);
    }
  }

  async function copy(which: "subject" | "body") {
    const text = which === "subject" ? subject : bodyText;
    await navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v && !subject && !loading) {
          // Auto-generate on first open
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Személyre szabott első üzenet
          </DialogTitle>
          <DialogDescription>
            AI által generált, a pain auditra építő hideg outreach.
            Soha nem küldjük automatikusan — átolvasod, finomítod, kimásolod.
          </DialogDescription>
        </DialogHeader>

        {loading && !subject && (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            AI dolgozik a személyre szabott üzeneten…
          </div>
        )}

        {error && (
          <div className="rounded-md border border-compass-red/30 bg-compass-red/5 p-3 text-sm text-compass-red">
            {error}
          </div>
        )}

        {subject && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="cold-subject">Tárgy</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => copy("subject")}
                >
                  {copied === "subject" ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <Input
                id="cold-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="cold-body">Üzenet</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => copy("body")}
                >
                  {copied === "body" ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <Textarea
                id="cold-body"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={10}
                className="font-mono text-sm"
              />
            </div>

            {hook && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">Personalization hook:</span> {hook}
              </p>
            )}

            {!hasEmail && (
              <p className="text-xs text-amber-700">
                Megj.: ennek a leadnek nincs email címe. Másold ki, és küldd kézzel onnan, ahonnan elérhető.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => generate()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : null}
            Újragenerálás
          </Button>
          <Button onClick={() => setOpen(false)}>Bezárás</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
