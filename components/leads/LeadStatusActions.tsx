"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LeadStatus, LossReason } from "@/lib/types/app.types";

const LOSS_REASONS: { value: LossReason; label: string }[] = [
  { value: "price", label: "Price" },
  { value: "timing", label: "Timing" },
  { value: "competitor", label: "Competitor" },
  { value: "no_response", label: "No response" },
  { value: "out_of_scope", label: "Out of scope" },
  { value: "other", label: "Other" },
];

export function LeadStatusActions({
  leadId,
  status,
}: {
  leadId: string;
  status: LeadStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "won" | "lost" | "archive">(null);
  const [lossOpen, setLossOpen] = useState(false);
  const [lossReason, setLossReason] = useState<LossReason>("no_response");
  const [lossNotes, setLossNotes] = useState("");

  async function patch(body: Record<string, unknown>, key: "won" | "lost" | "archive") {
    setBusy(key);
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const isClosed = status === "won" || status === "lost" || status === "archived";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {!isClosed && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() => patch({ status: "won" }, "won")}
            className="gap-1.5"
          >
            {busy === "won" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 text-compass-green" />}
            Mark won
          </Button>
        )}
        {!isClosed && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() => setLossOpen(true)}
            className="gap-1.5"
          >
            <XCircle className="h-3.5 w-3.5 text-compass-red" />
            Mark lost
          </Button>
        )}
        {status !== "archived" && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy !== null}
            onClick={() => patch({ status: "archived" }, "archive")}
            className="gap-1.5 text-muted-foreground"
          >
            {busy === "archive" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
            Archive
          </Button>
        )}
      </div>

      <Dialog open={lossOpen} onOpenChange={setLossOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark lead as lost</DialogTitle>
            <DialogDescription>
              The reason feeds the win-rate model so future scoring gets sharper.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Select value={lossReason} onValueChange={(v) => setLossReason(v as LossReason)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOSS_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                rows={3}
                value={lossNotes}
                onChange={(e) => setLossNotes(e.target.value)}
                placeholder="What happened?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLossOpen(false)}>Cancel</Button>
            <Button
              disabled={busy !== null}
              onClick={async () => {
                await patch(
                  { status: "lost", loss_reason: lossReason, loss_notes: lossNotes || null },
                  "lost",
                );
                setLossOpen(false);
              }}
            >
              {busy === "lost" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm lost"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
