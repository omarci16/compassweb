"use client";

import { useState } from "react";
import { Mail, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProposalDraftModal } from "./ProposalDraftModal";
import { formatRelativeHu } from "@/lib/utils/format";

export function ProposalActions({
  dealId,
  recipientEmail,
  proposalSentAt,
}: {
  dealId: string;
  recipientEmail: string | null;
  proposalSentAt: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      {proposalSentAt ? (
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-compass-green" />
          Proposal sent {formatRelativeHu(proposalSentAt)}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No proposal sent yet. Generate an AI draft, review, then send.
        </p>
      )}

      <div className="flex gap-2">
        <Button onClick={() => setOpen(true)} className="gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Draft proposal
        </Button>
        <Button variant="outline" disabled={!recipientEmail} className="gap-1.5">
          <Mail className="h-3.5 w-3.5" />
          Draft follow-up
        </Button>
      </div>

      <ProposalDraftModal
        dealId={dealId}
        open={open}
        onOpenChange={setOpen}
        recipientEmail={recipientEmail}
      />
    </div>
  );
}
