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
import { ProjectCard } from "./ProjectCard";
import {
  PROJECT_STAGE_LABELS_HU,
  type Project,
  type ProjectStage,
} from "@/lib/types/app.types";
import { cn } from "@/lib/utils";

const STAGES: ProjectStage[] = [0, 1, 2, 3, 4, 5, 6, 7];

export function ProjectKanban({ projects: initial }: { projects: Project[] }) {
  const [projects, setProjects] = useState(initial);
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const grouped = useMemo(() => {
    const m: Record<number, Project[]> = {};
    for (const s of STAGES) m[s] = [];
    for (const p of projects) (m[p.current_stage] ??= []).push(p);
    return m;
  }, [projects]);

  function onDragEnd(e: DragEndEvent) {
    const id = e.active.id as string;
    const target = e.over?.id as ProjectStage | undefined;
    if (target == null) return;
    const current = projects.find((p) => p.id === id);
    if (!current || current.current_stage === target) return;

    fetch(`/api/projects/${id}/stage`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stage: target }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("gate failed");
        setProjects((prev) =>
          prev.map((p) => (p.id === id ? { ...p, current_stage: target } : p)),
        );
        router.refresh();
      })
      .catch(() => {
        // Show a soft alert — the gate refused
        alert("Cannot advance: stage gate not satisfied. See project detail for details.");
      });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid gap-3 grid-cols-[repeat(8,minmax(220px,1fr))] overflow-x-auto pb-3">
        {STAGES.map((stage) => (
          <Column key={stage} stage={stage} projects={grouped[stage] ?? []} />
        ))}
      </div>
    </DndContext>
  );
}

function Column({ stage, projects }: { stage: ProjectStage; projects: Project[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border border-border bg-muted/30 p-2.5 transition-colors min-h-[200px]",
        isOver && "bg-primary/5 border-primary/30",
      )}
    >
      <div className="flex items-center justify-between px-1.5 mb-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="text-foreground/60 mr-1">{stage}.</span>
          {PROJECT_STAGE_LABELS_HU[stage]}
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {projects.length}
        </span>
      </div>
      <div className="space-y-2">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
        {projects.length === 0 && (
          <div className="rounded-lg border border-dashed border-border/60 bg-background/50 py-6 text-center text-[11px] text-muted-foreground">
            —
          </div>
        )}
      </div>
    </div>
  );
}
