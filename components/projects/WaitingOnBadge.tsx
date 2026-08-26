import { Users, User } from "lucide-react";
import type { WaitingOn } from "@/lib/types/app.types";
import { cn } from "@/lib/utils";

export function WaitingOnBadge({
  waitingOn,
  size = "sm",
}: {
  waitingOn: WaitingOn;
  size?: "sm" | "md";
}) {
  const cfg =
    waitingOn === "us"
      ? {
          label: "US",
          icon: Users,
          class:
            "bg-compass-purple/10 text-compass-purple border-compass-purple/20",
        }
      : {
          label: "CLIENT",
          icon: User,
          class:
            "bg-compass-amber/10 text-compass-amber border-compass-amber/30",
        };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-bold tracking-wider",
        size === "sm" ? "text-[9px]" : "text-[10px]",
        cfg.class,
      )}
    >
      <cfg.icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}
