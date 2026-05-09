"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Send, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PACKAGE_LABELS, type DraftProposalResult } from "@/lib/types/app.types";

interface Props {
  dealId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<DraftProposalResult>;
  recipientEmail: string | null;
}

export function ProposalDraftModal({
  dealId,
  open,
  onOpenChange,
  initial,
  recipientEmail,
}: Props) {
  const router = useRouter();
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState<Partial<DraftProposalResult>>(initial ?? {});

  async function generate() {
    setDrafting(true);
    try {
      const r = await fetch("/api/ai/draft-proposal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deal_id: dealId }),
      });
      const data = (await r.json()) as DraftProposalResult;
      setDraft(data);
    } finally {
      setDrafting(false);
    }
  }

  async function logAsSent() {
    if (!recipientEmail) return;
    setSending(true);
    try {
      await fetch("/api/email/log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deal_id: dealId,
          to_address: recipientEmail,
          subject: draft.email_subject,
          body_html: draft.email_body,
          type: "proposal",
          ai_drafted: true,
        }),
      });
      onOpenChange(false);
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  async function sendNow() {
    if (!recipientEmail) return;
    setSending(true);
    try {
      await fetch("/api/email/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deal_id: dealId,
          to: recipientEmail,
          subject: draft.email_subject,
          html: draft.email_body,
          type: "proposal",
          ai_drafted: true,
        }),
      });
      onOpenChange(false);
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Proposal draft</DialogTitle>
          <DialogDescription>
            AI drafts in Hungarian. Review every word before sending.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Recipient: <span className="font-medium text-foreground">{recipientEmail ?? "—"}</span>
            </div>
            <Button size="sm" variant="outline" onClick={generate} disabled={drafting}>
              {drafting ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> AI is working…</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5" /> {draft.email_body ? "Regenerate" : "Generate draft"}</>
              )}
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input
              value={draft.email_subject ?? ""}
              onChange={(e) => setDraft({ ...draft, email_subject: e.target.value })}
              placeholder="—"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Body</Label>
            <Textarea
              rows={12}
              value={draft.email_body ?? ""}
              onChange={(e) => setDraft({ ...draft, email_body: e.target.value })}
              className="font-mono text-xs leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Package</Label>
              <Select
                value={draft.proposed_package ?? ""}
                onValueChange={(v) => setDraft({ ...draft, proposed_package: v as never })}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PACKAGE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Price (HUF)</Label>
              <Input
                type="number"
                value={draft.proposed_price_huf ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, proposed_price_huf: Number(e.target.value) || undefined })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Monthly fee (HUF)</Label>
              <Input
                type="number"
                value={draft.monthly_fee_huf ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, monthly_fee_huf: Number(e.target.value) || undefined })
                }
              />
            </div>
          </div>

          {draft.talking_points && draft.talking_points.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                Internal talking points
              </div>
              {draft.talking_points.map((t, i) => (
                <div key={i} className="text-xs text-foreground/80">• {t}</div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() =>
              navigator.clipboard.writeText(
                `${draft.email_subject ?? ""}\n\n${(draft.email_body ?? "").replace(/<[^>]+>/g, "")}`,
              )
            }
            className="gap-1.5"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={logAsSent} disabled={sending || !draft.email_body}>
            Log as sent
          </Button>
          <Button onClick={sendNow} disabled={sending || !draft.email_body || !recipientEmail} className="gap-1.5">
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send via Resend
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
