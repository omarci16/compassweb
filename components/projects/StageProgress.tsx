import { Check } from "lucide-react";
import { PROJECT_STAGE_LABELS_HU, type ProjectStage } from "@/lib/types/app.types";
import { cn } from "@/lib/utils";

const STAGES: ProjectStage[] = [0, 1, 2, 3, 4, 5, 6, 7];

export function StageProgress({ current }: { current: ProjectStage }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {STAGES.map((s, i) => {
          const done = s < current;
          const active = s === current;
          return (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold shrink-0 transition-colors",
                  done && "bg-compass-green text-background",
                  active && "bg-primary text-primary-foreground ring-4 ring-primary/15",
                  !done && !active && "bg-muted text-muted-foreground border border-border",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : s}
              </div>
              {i < STAGES.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 mx-1 rounded-full",
                    s < current ? "bg-compass-green" : "bg-border",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="text-xs text-muted-foreground">
        Currently in <span className="font-semibold text-foreground">stage {current}: {PROJECT_STAGE_LABELS_HU[current]}</span>
      </div>
    </div>
  );
}
