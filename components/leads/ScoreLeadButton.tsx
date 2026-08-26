"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ScoreLeadButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    try {
      await fetch(`/api/ai/score`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lead_id: leadId }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={loading} className="gap-1.5">
      {loading ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          AI is working…
        </>
      ) : (
        <>
          <Sparkles className="h-3.5 w-3.5" />
          Re-score
        </>
      )}
    </Button>
  );
}
