import { CheckCircle2, Loader2, AlertCircle, Sparkles } from "lucide-react";
import type { EnrichmentStatus } from "@/lib/types/app.types";
import { cn } from "@/lib/utils";

export function EnrichmentStatusBadge({
  status,
  className,
}: {
  status: EnrichmentStatus;
  className?: string;
}) {
  const cfg = {
    pending: { label: "Pending", icon: Sparkles, color: "text-muted-foreground bg-muted" },
    running: { label: "Enriching", icon: Loader2, color: "text-compass-blue bg-compass-blue/10", spin: true },
    complete: { label: "Enriched", icon: CheckCircle2, color: "text-compass-green bg-compass-green/10" },
    failed: { label: "Failed", icon: AlertCircle, color: "text-compass-red bg-compass-red/10" },
  }[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        cfg.color,
        className,
      )}
    >
      <cfg.icon className={cn("h-3 w-3", cfg.spin && "animate-spin")} />
      {cfg.label}
    </span>
  );
}
