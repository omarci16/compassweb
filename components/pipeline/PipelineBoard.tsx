"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { DealCard } from "./DealCard";
import {
  DEAL_STAGE_LABELS,
  type Deal,
  type DealStage,
  type Lead,
} from "@/lib/types/app.types";
import { cn } from "@/lib/utils";

const COLUMNS: DealStage[] = [
  "concept_pending",
  "concept_ready",
  "visual_sent",
  "proposal_sent",
  "negotiating",
];

export function PipelineBoard({
  deals: initial,
  leads,
}: {
  deals: Deal[];
  leads: Lead[];
}) {
  const [deals, setDeals] = useState(initial);
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const grouped = useMemo(() => {
    const map: Record<string, Deal[]> = {};
    for (const c of COLUMNS) map[c] = [];
    map["closed_won"] = [];
    map["closed_lost"] = [];
    for (const d of deals) {
      (map[d.stage] ??= []).push(d);
    }
    return map;
  }, [deals]);

  const leadById = useMemo(() => {
    const m = new Map<string, Lead>();
    for (const l of leads) m.set(l.id, l);
    return m;
  }, [leads]);

  function onDragEnd(e: DragEndEvent) {
    const dealId = e.active.id as string;
    const targetStage = e.over?.id as DealStage | undefined;
    if (!targetStage) return;
    const current = deals.find((d) => d.id === dealId);
    if (!current || current.stage === targetStage) return;

    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage: targetStage } : d)),
    );

    fetch(`/api/deals/${dealId}/stage`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stage: targetStage }),
    })
      .then(() => router.refresh())
      .catch(() => {
        // Roll back on failure
        setDeals(initial);
      });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid gap-3 grid-cols-[repeat(5,minmax(220px,1fr))] overflow-x-auto pb-3">
        {COLUMNS.map((stage) => (
          <Column key={stage} stage={stage} deals={grouped[stage] ?? []} leads={leadById} />
        ))}
      </div>

      <div className="mt-4 grid gap-3 grid-cols-2">
        <Column stage="closed_won" deals={grouped.closed_won} leads={leadById} compact />
        <Column stage="closed_lost" deals={grouped.closed_lost} leads={leadById} compact />
      </div>
    </DndContext>
  );
}

function Column({
  stage,
  deals,
  leads,
  compact,
}: {
  stage: DealStage;
  deals: Deal[];
  leads: Map<string, Lead>;
  compact?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border border-border bg-muted/30 p-2.5 transition-colors",
        isOver && "bg-primary/5 border-primary/30",
      )}
    >
      <div className="flex items-center justify-between px-1.5 mb-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {DEAL_STAGE_LABELS[stage]}
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {deals.length}
        </span>
      </div>
      <div className={cn("space-y-2", compact && "max-h-[140px] overflow-y-auto")}>
        {deals.map((d) => (
          <DealCard key={d.id} deal={d} lead={leads.get(d.lead_id)} />
        ))}
        {deals.length === 0 && (
          <div className="rounded-lg border border-dashed border-border/60 bg-background/50 py-6 text-center text-[11px] text-muted-foreground">
            Drop a deal here
          </div>
        )}
      </div>
    </div>
  );
}
