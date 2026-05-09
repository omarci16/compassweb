"use client";

import { useEffect, useState } from "react";
import { differenceInMinutes } from "date-fns";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function SpeedToLeadTimer({
  createdAt,
  firstContactAt,
  size = "sm",
}: {
  createdAt: string;
  firstContactAt: string | null;
  size?: "sm" | "md";
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (firstContactAt) return;
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, [firstContactAt]);

  if (firstContactAt) {
    const mins = differenceInMinutes(new Date(firstContactAt), new Date(createdAt));
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        Contacted in {formatMins(mins)}
      </span>
    );
  }

  const mins = differenceInMinutes(now, new Date(createdAt));
  const tier = mins > 120 ? "red" : mins > 60 ? "amber" : "green";
  const palette = {
    red: "text-compass-red bg-compass-red/10 border-compass-red/30",
    amber: "text-amber-700 bg-compass-amber/10 border-compass-amber/30",
    green: "text-compass-green bg-compass-green/10 border-compass-green/30",
  }[tier];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-medium",
        size === "sm" ? "text-[10px]" : "text-xs",
        palette,
      )}
    >
      <Clock className="h-3 w-3" />
      {formatMins(mins)} uncontacted
    </span>
  );
}

function formatMins(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours < 24) return `${hours}h ${rem ? rem + "m" : ""}`.trim();
  return `${Math.floor(hours / 24)}d`;
}
