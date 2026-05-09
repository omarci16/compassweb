import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  tone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: LucideIcon;
  trend?: { value: string; positive?: boolean };
  tone?: "neutral" | "positive" | "warning" | "danger";
  className?: string;
}) {
  const toneClass =
    tone === "positive"
      ? "text-compass-green"
      : tone === "warning"
        ? "text-amber-700"
        : tone === "danger"
          ? "text-compass-red"
          : "text-foreground";

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 transition-all hover:shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-0.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
        </div>
        {Icon && (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
      <div className={cn("mt-3 text-2xl font-semibold tabular-nums", toneClass)}>
        {value}
      </div>
      <div className="mt-1 flex items-center gap-2">
        {trend && (
          <span
            className={cn(
              "text-xs font-medium",
              trend.positive ? "text-compass-green" : "text-compass-red",
            )}
          >
            {trend.value}
          </span>
        )}
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
