"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";

// Manual reply-tracking stand-in: there is no inbound-email-parsing pipeline
// in this ERP (replies land in a monitored human inbox, not a webhook), so
// this is the cheap fix for Email Studio's performance rollups to have SOME
// reply signal — logged as an inbound email_log row against the lead.
export function MarkRepliedButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function markReplied() {
    setBusy(true);
    try {
      const res = await fetch("/api/email/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction: "inbound",
          lead_id: leadId,
          subject: "Válasz (kézi jelölés)",
          type: "cold_outreach",
        }),
      });
      if (res.ok) {
        setDone(true);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <span className="text-[11px] text-compass-green shrink-0">Válaszként jelölve</span>;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 shrink-0 gap-1 text-[11px] text-muted-foreground"
      disabled={busy}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void markReplied();
      }}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquareText className="h-3 w-3" />}
      Jelöld válaszoltnak
    </Button>
  );
}
