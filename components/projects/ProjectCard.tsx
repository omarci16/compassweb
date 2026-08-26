"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { WaitingOnBadge } from "./WaitingOnBadge";
import { UrgencyChip, urgencyBorder } from "./UrgencyIndicator";
import { PACKAGE_LABELS, type Project } from "@/lib/types/app.types";
import { formatHufCompact } from "@/lib/utils/format";
import { AlertOctagon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProjectCard({ project, draggable = true }: { project: Project; draggable?: boolean }) {
  const drag = useDraggable({
    id: project.id,
    disabled: !draggable,
  });
  const style = drag.transform
    ? { transform: `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={draggable ? drag.setNodeRef : undefined}
      style={style}
      {...(draggable ? { ...drag.attributes, ...drag.listeners } : {})}
    >
      <Link
        href={`/erp/projects/${project.id}`}
        className={cn(
          "block rounded-lg border border-border bg-card p-3 shadow-sm transition-all hover:shadow-md hover:border-primary/30",
          urgencyBorder(project.urgency_score),
          drag.isDragging && "opacity-40 ring-2 ring-primary/40",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{project.client_name}</div>
            {project.client_company && project.client_company !== project.client_name && (
              <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                {project.client_company}
              </div>
            )}
          </div>
          <UrgencyChip score={project.urgency_score} />
        </div>

        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          <Badge variant="purple" className="font-normal text-[10px]">
            {PACKAGE_LABELS[project.package]}
          </Badge>
          <Badge variant="secondary" className="font-normal text-[10px]">
            {formatHufCompact(project.agreed_price_huf)}
          </Badge>
          <WaitingOnBadge waitingOn={project.waiting_on} />
        </div>

        {project.blocker && (
          <div className="mt-2 flex items-start gap-1.5 rounded-md bg-compass-red/10 px-2 py-1.5 text-[11px] text-compass-red">
            <AlertOctagon className="h-3 w-3 mt-0.5 shrink-0" />
            <span className="line-clamp-2">{project.blocker}</span>
          </div>
        )}

        <div className="mt-2 text-[10px] text-muted-foreground tabular-nums">
          {project.days_in_current_stage}d in stage
        </div>
      </Link>
    </div>
  );
}
