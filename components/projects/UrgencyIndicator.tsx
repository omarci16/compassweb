import { cn } from "@/lib/utils";

export function urgencyTier(score: number): "high" | "medium" | "low" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export function urgencyBorder(score: number): string {
  return {
    high: "urgency-high",
    medium: "urgency-medium",
    low: "urgency-low",
  }[urgencyTier(score)];
}

export function UrgencyDot({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const color = {
    high: "bg-compass-red",
    medium: "bg-compass-amber",
    low: "bg-compass-green",
  }[urgencyTier(score)];
  return (
    <span className={cn("inline-block h-2 w-2 rounded-full", color, className)} />
  );
}

export function UrgencyChip({ score }: { score: number }) {
  const tier = urgencyTier(score);
  const cls = {
    high: "bg-compass-red/10 text-compass-red",
    medium: "bg-compass-amber/10 text-compass-amber",
    low: "bg-compass-green/10 text-compass-green",
  }[tier];
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums", cls)}>
      {score}
    </span>
  );
}
