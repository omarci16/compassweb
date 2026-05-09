"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  PROJECT_STAGE_LABELS_HU,
  type ProjectStage,
} from "@/lib/types/app.types";
import type { GateResult } from "@/lib/utils/stage-gates";

export function StageGateGuard({
  projectId,
  currentStage,
  gate,
}: {
  projectId: string;
  currentStage: ProjectStage;
  gate: GateResult;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const next = (currentStage + 1) as ProjectStage;
  const terminal = currentStage === 7;

  async function advance() {
    setLoading(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/stage`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stage: next }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        alert(j.error ?? "Stage gate refused");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (terminal) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Project is in retainer (stage 7) — terminal stage.
      </div>
    );
  }

  if (!gate.allowed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button disabled variant="outline" className="gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" />
            Cannot advance to {next}. {PROJECT_STAGE_LABELS_HU[next]}
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="font-medium mb-1">Waiting for:</div>
          <ul className="space-y-0.5">
            {gate.blockers.map((b, i) => (
              <li key={i}>• {b}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button onClick={advance} disabled={loading} className="gap-1.5">
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronRight className="h-3.5 w-3.5" />}
      Advance to {next}. {PROJECT_STAGE_LABELS_HU[next]}
    </Button>
  );
}
