import Link from "next/link";
import { AlertTriangle, ArrowRight, Bell, CheckCircle2, Info } from "lucide-react";
import type { DailyBriefing } from "@/lib/types/app.types";
import { Button } from "@/components/ui/button";

const ICONS = {
  urgent: { icon: AlertTriangle, color: "text-compass-red", bg: "bg-compass-red/10" },
  action: { icon: Bell, color: "text-compass-amber", bg: "bg-compass-amber/10" },
  info: { icon: Info, color: "text-compass-blue", bg: "bg-compass-blue/10" },
  ok: { icon: CheckCircle2, color: "text-compass-green", bg: "bg-compass-green/10" },
} as const;

export function DailyBriefingCard({ briefing }: { briefing: DailyBriefing }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/[0.04] p-6 shadow-sm">
      <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-primary/[0.06] blur-3xl pointer-events-none" />
      <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Daily briefing
          </p>
          <h1 className="text-xl font-semibold">{briefing.greeting}</h1>
          <p className="text-sm text-muted-foreground">
            Today's priorities, ranked by urgency.
          </p>
        </div>
        {briefing.suggested_first_action && (
          <Button asChild size="sm" className="gap-1.5 shrink-0">
            <Link href={briefing.suggested_first_action.href}>
              {briefing.suggested_first_action.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </div>

      <ul className="relative mt-5 space-y-2">
        {briefing.items.map((item, i) => {
          const I = ICONS[item.severity];
          const Inner = (
            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/40 px-3.5 py-3 transition-colors hover:border-border hover:bg-background/70">
              <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${I.bg}`}>
                <I.icon className={`h-3.5 w-3.5 ${I.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium leading-tight truncate">
                  {item.title}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {item.detail}
                </div>
              </div>
              {item.href && (
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1.5" />
              )}
            </div>
          );
          return (
            <li key={i}>
              {item.href ? <Link href={item.href}>{Inner}</Link> : Inner}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
