import Link from "next/link";
import { ArrowRight, Inbox, MailCheck, MousePointerClick, Send, ShieldX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OutboundStats } from "@/lib/data/queries";

const TRACK_LABEL: Record<string, string> = {
  needs_site: "Nincs oldal",
  upgrade: "Fejlesztés",
  low_priority: "Alacsony",
};

function Metric({
  label,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: number;
  icon: typeof Send;
  tone?: "neutral" | "positive" | "danger";
}) {
  const toneCls =
    tone === "positive"
      ? "text-compass-green"
      : tone === "danger"
        ? "text-compass-red"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={`mt-1 text-xl font-semibold ${toneCls}`}>{value.toLocaleString("hu-HU")}</div>
    </div>
  );
}

export function OutboundControlTower({ stats }: { stats: OutboundStats }) {
  const nextActions: { label: string; href: string }[] = [];
  if (stats.drafts_pending > 0)
    nextActions.push({ label: `Hagyj jóvá ${stats.drafts_pending} piszkozatot`, href: "/outreach" });
  if (stats.drafts_approved > 0)
    nextActions.push({ label: `Küldd el a ${stats.drafts_approved} jóváhagyottat`, href: "/outreach" });
  if (stats.by_track.needs_site + stats.by_track.upgrade > 0 && stats.drafts_pending === 0)
    nextActions.push({ label: "Generálj piszkozatokat a top leadekhez", href: "/outreach" });
  if (nextActions.length === 0)
    nextActions.push({ label: "Indíts egy batch vadászatot", href: "/prospecting" });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-primary" />
            Outbound irányítótorony
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            A hideg outreach gép állapota — piszkozatok, mai kézbesítés, célpontok.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
          <Link href="/outreach">
            Sor <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Jóváhagyásra" value={stats.drafts_pending} icon={Inbox} tone={stats.drafts_pending > 0 ? "danger" : "neutral"} />
          <Metric label="Küldésre kész" value={stats.drafts_approved} icon={Send} />
          <Metric label="Ma kiment" value={stats.sent_today} icon={MailCheck} tone="positive" />
          <Metric label="Megnyitva" value={stats.opened_today} icon={MousePointerClick} />
          <Metric label="Válasz ma" value={stats.replied_today} icon={MailCheck} tone="positive" />
          <Metric label="Bounce ma" value={stats.bounced_today} icon={ShieldX} tone={stats.bounced_today > 0 ? "danger" : "neutral"} />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Kontaktálatlan sávok:</span>
          <Badge variant="purple" className="font-normal">
            Nincs oldal · {stats.by_track.needs_site}
          </Badge>
          <Badge variant="info" className="font-normal">
            Fejlesztés · {stats.by_track.upgrade}
          </Badge>
          <Badge variant="outline" className="font-normal">
            Alacsony · {stats.by_track.low_priority}
          </Badge>
          <span className="ml-auto text-muted-foreground">
            Suppression: {stats.suppressed_total}
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Top célpontok</div>
            {stats.top_targets.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nincs kontaktálatlan, routolt lead.</p>
            ) : (
              <div className="space-y-1.5">
                {stats.top_targets.map((t) => (
                  <Link
                    key={t.id}
                    href={`/leads/${t.id}`}
                    className="flex items-center justify-between rounded-md border border-border bg-background px-2.5 py-1.5 text-sm hover:bg-accent/40"
                  >
                    <span className="truncate">
                      {t.company_name}
                      {t.city ? <span className="text-muted-foreground"> · {t.city}</span> : null}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      {t.offer_track && (
                        <Badge variant="outline" className="font-normal text-[10px]">
                          {TRACK_LABEL[t.offer_track] ?? t.offer_track}
                        </Badge>
                      )}
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {t.win_probability ?? "—"}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Következő 3 lépés</div>
            <ol className="space-y-1.5">
              {nextActions.slice(0, 3).map((a, i) => (
                <li key={i}>
                  <Link
                    href={a.href}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm hover:bg-accent/40"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[11px] font-semibold text-primary">
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate">{a.label}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
