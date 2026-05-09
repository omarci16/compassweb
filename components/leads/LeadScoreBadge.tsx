import { cn } from "@/lib/utils";

export function LeadScoreBadge({
  score,
  showLabel = true,
  className,
}: {
  score: number | null;
  showLabel?: boolean;
  className?: string;
}) {
  if (score == null) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>—</span>
    );
  }
  const tier =
    score >= 70 ? "high" : score >= 40 ? "med" : "low";
  const palette = {
    high: { bar: "bg-compass-green", text: "text-compass-green", bg: "bg-compass-green/10" },
    med: { bar: "bg-compass-amber", text: "text-amber-700", bg: "bg-compass-amber/10" },
    low: { bar: "bg-compass-red", text: "text-compass-red", bg: "bg-compass-red/10" },
  }[tier];

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <div className="relative h-1.5 w-16 rounded-full bg-secondary overflow-hidden">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full", palette.bar)}
          style={{ width: `${score}%` }}
        />
      </div>
      {showLabel && (
        <span className={cn("text-xs font-semibold tabular-nums", palette.text)}>
          {score}
        </span>
      )}
    </div>
  );
}
