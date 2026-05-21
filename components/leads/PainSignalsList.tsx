import { AlertTriangle, Info, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PainSignal, PainSignalSeverity } from "@/lib/types/app.types";

const SEVERITY_STYLES: Record<PainSignalSeverity, { class: string; icon: typeof AlertTriangle }> = {
  high: {
    class: "border-compass-red/30 bg-compass-red/5 text-compass-red",
    icon: AlertTriangle,
  },
  medium: {
    class: "border-compass-amber/40 bg-compass-amber/5 text-amber-700",
    icon: CircleAlert,
  },
  low: {
    class: "border-border bg-muted/40 text-muted-foreground",
    icon: Info,
  },
};

export function PainSignalsList({ signals }: { signals: PainSignal[] }) {
  if (signals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Nincs detektált fájdalompont.
      </p>
    );
  }

  // Sort: high severity first
  const order: Record<PainSignalSeverity, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...signals].sort((a, b) => order[a.severity] - order[b.severity]);

  return (
    <ul className="space-y-1.5">
      {sorted.map((s, i) => {
        const style = SEVERITY_STYLES[s.severity];
        const Icon = style.icon;
        return (
          <li
            key={`${s.code}-${i}`}
            className={cn(
              "flex items-start gap-2.5 rounded-md border px-3 py-2 text-sm",
              style.class,
            )}
          >
            <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="leading-snug">{s.label_hu}</span>
          </li>
        );
      })}
    </ul>
  );
}
