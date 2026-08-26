"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Kanban,
  ClipboardList,
  Archive,
  Mail,
  Wand2,
  Banknote,
  BarChart3,
  Settings,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/erp", label: "Dashboard", icon: LayoutDashboard },
  { href: "/erp/prospecting", label: "Prospecting", icon: Target },
  { href: "/erp/leads", label: "Leads", icon: Inbox },
  { href: "/erp/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/erp/projects", label: "Projects", icon: ClipboardList },
  { href: "/erp/archive", label: "Archive", icon: Archive },
  { href: "/erp/outreach", label: "Outreach", icon: Mail },
  { href: "/erp/email-studio", label: "Email Studio", icon: Wand2 },
  { href: "/erp/revenue", label: "Revenue", icon: Banknote },
  { href: "/erp/intelligence", label: "Intelligence", icon: BarChart3 },
];

export function Sidebar() {
  const path = usePathname();
  const isActive = (href: string) =>
    href === "/erp" ? path === "/erp" : path === href || path.startsWith(href + "/");

  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-border bg-card">
      <a
        href="/"
        title="Vissza a weboldalra"
        className="flex h-14 items-center gap-2.5 px-5 border-b border-border transition-opacity hover:opacity-70"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logo.png" alt="Compass Systems" className="h-5 w-auto" />
        <span className="mono-label !text-[10px]">ERP</span>
      </a>
      <nav className="flex-1 py-3 px-4 space-y-0.5">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-light transition-colors",
              "before:absolute before:left-[-8px] before:top-1/2 before:h-[18px] before:w-[2px]",
              "before:-translate-y-1/2 before:rounded-sm before:bg-primary before:transition-opacity",
              isActive(n.href)
                ? "bg-secondary text-foreground before:opacity-100"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground before:opacity-0",
            )}
          >
            <n.icon className="h-4 w-4" />
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="px-4 pb-3 border-t border-border pt-3">
        <Link
          href="/erp/settings"
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-light transition-colors",
            path.startsWith("/erp/settings")
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
