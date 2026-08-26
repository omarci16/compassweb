"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DEAL_STAGE_LABELS,
  PACKAGE_LABELS,
  type Deal,
  type Lead,
} from "@/lib/types/app.types";
import { formatHufCompact, formatRelativeHu } from "@/lib/utils/format";
import { UrgencyChip, urgencyBorder } from "@/components/projects/UrgencyIndicator";
import { cn } from "@/lib/utils";

export function DealCard({
  deal,
  lead,
}: {
  deal: Deal;
  lead?: Lead;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: deal.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Link
        href={`/erp/pipeline/${deal.id}`}
        className={cn(
          "block rounded-lg border border-border bg-card p-3 shadow-sm transition-all hover:shadow-md hover:border-primary/30",
          urgencyBorder(deal.urgency_score ?? 0),
          isDragging && "opacity-40 ring-2 ring-primary/40",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">
              {lead?.company_name ?? "Unknown"}
            </div>
            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
              {lead?.contact_name ?? "—"} {lead?.niche ? `· ${lead.niche}` : ""}
            </div>
          </div>
          {deal.urgency_score != null && <UrgencyChip score={deal.urgency_score} />}
        </div>

        {deal.proposed_package && (
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <Badge variant="purple" className="font-normal text-[10px]">
              {PACKAGE_LABELS[deal.proposed_package]}
            </Badge>
            {deal.proposed_price_huf && (
              <Badge variant="secondary" className="font-normal text-[10px]">
                {formatHufCompact(deal.proposed_price_huf)}
              </Badge>
            )}
          </div>
        )}

        {deal.vercel_preview_url && (
          <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-compass-blue">
            <Globe className="h-3 w-3" />
            Preview attached
          </div>
        )}

        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{DEAL_STAGE_LABELS[deal.stage]}</span>
          <span>{formatRelativeHu(deal.updated_at)}</span>
        </div>
      </Link>
    </div>
  );
}
