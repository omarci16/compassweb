"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  LayoutDashboard,
  Inbox,
  Kanban,
  ClipboardList,
  Archive,
  Mail,
  Banknote,
  BarChart3,
  Settings,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/prospecting", label: "Prospecting", icon: Target },
  { href: "/leads", label: "Leads", icon: Inbox },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/projects", label: "Projects", icon: ClipboardList },
  { href: "/archive", label: "Archive", icon: Archive },
  { href: "/outreach", label: "Outreach", icon: Mail },
  { href: "/revenue", label: "Revenue", icon: Banknote },
  { href: "/intelligence", label: "Intelligence", icon: BarChart3 },
];

export function Sidebar() {
  const path = usePathname();
  const isActive = (href: string) =>
    href === "/" ? path === "/" : path === href || path.startsWith(href + "/");

  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center gap-2 px-5 border-b border-border">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Compass className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Compass</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            ERP · v0.1
          </div>
        </div>
      </div>
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              isActive(n.href)
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
          >
            <n.icon className="h-4 w-4" />
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="px-2 pb-3 border-t border-border pt-3">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
            path.startsWith("/settings")
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-accent",
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
