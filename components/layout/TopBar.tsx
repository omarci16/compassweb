"use client";

import { Bell, Search, Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState } from "react";
import { QuickAddLead } from "@/components/leads/QuickAddLead";

const PATH_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/leads": "Leads",
  "/pipeline": "Pipeline",
  "/projects": "Projects",
  "/archive": "Archive",
  "/outreach": "Outreach",
  "/revenue": "Revenue",
  "/intelligence": "Intelligence",
  "/settings": "Settings",
};

export function TopBar({ initials = "RB" }: { initials?: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const segs = path.split("/").filter(Boolean);
  const currentLabel = PATH_LABELS[`/${segs[0] ?? ""}`] ?? PATH_LABELS["/"];

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-6">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">
            {currentLabel}
          </span>
          {segs.length > 1 && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-medium text-foreground">
                {segs.slice(1).join(" / ")}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-muted-foreground hidden md:inline-flex"
          >
            <Search className="h-3.5 w-3.5" />
            Search
            <kbd className="ml-2 inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
              /
            </kbd>
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            New lead
            <kbd className="ml-1 inline-flex h-4 items-center rounded bg-white/15 px-1 text-[10px] font-medium">
              K
            </kbd>
          </Button>
          <Button size="icon" variant="ghost" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Button>
          <Avatar>
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </div>
      </header>
      <QuickAddLead open={open} onOpenChange={setOpen} />
    </>
  );
}
