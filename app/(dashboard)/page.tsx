import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  Inbox,
  Banknote,
  Activity,
} from "lucide-react";
import { DailyBriefingCard } from "@/components/layout/DailyBriefing";
import { OutboundControlTower } from "@/components/layout/OutboundControlTower";
import { Stat } from "@/components/shared/Stat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LeadScoreBadge } from "@/components/leads/LeadScoreBadge";
import { WaitingOnBadge } from "@/components/projects/WaitingOnBadge";
import { UrgencyDot, urgencyBorder } from "@/components/projects/UrgencyIndicator";
import { Button } from "@/components/ui/button";
import {
  computeBriefing,
  getLeads,
  getOutboundStats,
  getProjects,
  getRevenueMetrics,
} from "@/lib/data/queries";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import {
  formatHufCompact,
  formatRelativeHu,
} from "@/lib/utils/format";
import {
  PROJECT_STAGE_LABELS_HU,
} from "@/lib/types/app.types";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  let firstName = "Richárd";
  if (isSupabaseConfigured()) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const fullName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "Richárd";
    firstName = fullName.split(" ")[0] ?? "Richárd";
  }

  const outbound = await getOutboundStats();
  const [leads, projects, revenue, briefing] = await Promise.all([
    getLeads({ status: "active", limit: 5 }),
    getProjects({ activeOnly: true }),
    getRevenueMetrics(),
    computeBriefing(firstName, outbound),
  ]);

  const topProjects = projects.slice(0, 5);

  return (
    <div className="space-y-6">
      <DailyBriefingCard briefing={briefing} />

      <OutboundControlTower stats={outbound} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="MRR"
          value={formatHufCompact(revenue.mrr_current)}
          hint={`${revenue.retainer_clients} retainer clients`}
          icon={Banknote}
          tone="positive"
        />
        <Stat
          label="Outstanding"
          value={formatHufCompact(revenue.outstanding)}
          hint={revenue.overdue > 0 ? `${formatHufCompact(revenue.overdue)} overdue` : "all current"}
          icon={Activity}
          tone={revenue.overdue > 0 ? "danger" : "neutral"}
        />
        <Stat
          label="Active leads"
          value={leads.length}
          hint="sorted by win probability"
          icon={Inbox}
        />
        <Stat
          label="Active projects"
          value={projects.length}
          hint="sorted by urgency"
          icon={ClipboardList}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between pb-3">
            <div>
              <CardTitle>Top urgent projects</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Default sort: urgency score, descending.
              </p>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
              <Link href="/projects">All projects <ArrowRight className="h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {topProjects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className={`block rounded-lg border border-border bg-background px-3 py-3 transition-colors hover:bg-accent/50 ${urgencyBorder(p.urgency_score)}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <UrgencyDot score={p.urgency_score} />
                      <span className="font-medium text-sm truncate">{p.client_name}</span>
                      <WaitingOnBadge waitingOn={p.waiting_on} />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground truncate">
                      Stage {p.current_stage} · {PROJECT_STAGE_LABELS_HU[p.current_stage]} · {p.days_in_current_stage}d in stage
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant="secondary" className="font-normal">
                      {formatHufCompact(p.agreed_price_huf)}
                    </Badge>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <div>
              <CardTitle>Hot leads</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Highest win probability first.
              </p>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
              <Link href="/leads">All <ArrowRight className="h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {leads.map((l) => (
              <Link
                key={l.id}
                href={`/leads/${l.id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{l.company_name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {l.niche ?? "—"} · {formatRelativeHu(l.created_at)}
                  </div>
                </div>
                <LeadScoreBadge score={l.win_probability} />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
