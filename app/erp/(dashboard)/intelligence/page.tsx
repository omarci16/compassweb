import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/shared/Stat";
import { EmptyState } from "@/components/shared/EmptyState";
import { Activity, Award, BarChart3, Target, Timer } from "lucide-react";
import {
  CycleTrendChart,
  LossReasonPie,
  WinRateChart,
} from "@/components/intelligence/Charts";
import { getInsights } from "@/lib/data/queries";
import { SOURCE_LABELS, type LeadSource } from "@/lib/types/app.types";

export const dynamic = "force-dynamic";

export default async function IntelligencePage() {
  const insights = await getInsights();

  const winRateData = insights.win_rate_by_niche.map((r) => ({
    niche: r.niche.replace("_", " "),
    rate: r.rate,
  }));
  const sourceData = insights.win_rate_by_source.map((r) => ({
    niche: SOURCE_LABELS[r.source as LeadSource] ?? r.source,
    rate: r.rate,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Intelligence</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Performance analytics and the data feedback loop. The longer the system runs,
          the sharper the AI scoring becomes.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Win rate (overall)"
          value={`${insights.win_rate_overall}%`}
          hint={`${insights.closed_this_month} closed this month`}
          icon={Target}
          tone={insights.win_rate_overall >= 50 ? "positive" : "neutral"}
        />
        <Stat
          label="Avg deal cycle"
          value={
            insights.cycle_trend.length > 0
              ? `${insights.cycle_trend[insights.cycle_trend.length - 1].days}d`
              : "—"
          }
          hint="lead → won, last month"
          icon={Timer}
        />
        <Stat
          label="Speed-to-lead"
          value={insights.speed_to_lead_median_min ? `${insights.speed_to_lead_median_min}m` : "—"}
          hint="median, contacted leads"
          icon={Activity}
        />
        <Stat
          label="Wins this month"
          value={insights.wins_this_month}
          hint={`of ${insights.closed_this_month} closed`}
          icon={Award}
          tone="positive"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Win rate by niche</CardTitle>
          </CardHeader>
          <CardContent>
            {winRateData.length > 0 ? (
              <WinRateChart data={winRateData} />
            ) : (
              <EmptyState icon={BarChart3} title="No closed leads yet" description="Win rates appear once you mark leads won or lost." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Win rate by source</CardTitle>
          </CardHeader>
          <CardContent>
            {sourceData.length > 0 ? (
              <WinRateChart data={sourceData} />
            ) : (
              <EmptyState icon={BarChart3} title="No source data yet" description="Track sources for every lead and outcomes appear here." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Loss reasons</CardTitle>
          </CardHeader>
          <CardContent>
            {insights.loss_reasons.length > 0 ? (
              <LossReasonPie data={insights.loss_reasons} />
            ) : (
              <EmptyState icon={BarChart3} title="No losses yet" description="Reasons appear once leads are marked lost." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Deal cycle (monthly avg)</CardTitle>
          </CardHeader>
          <CardContent>
            {insights.cycle_trend.length > 0 ? (
              <CycleTrendChart data={insights.cycle_trend} />
            ) : (
              <EmptyState icon={BarChart3} title="No cycle data yet" description="Lead → won timing aggregates as deals close." />
            )}
          </CardContent>
        </Card>
      </div>

      {insights.win_rate_by_niche.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Niche breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {insights.win_rate_by_niche.map((n) => (
              <div key={n.niche} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                <span className="font-medium capitalize">{n.niche.replace("_", " ")}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{n.volume} closed</span>
                  <span className={`font-semibold tabular-nums ${n.rate >= 60 ? "text-compass-green" : n.rate >= 40 ? "text-compass-amber" : "text-compass-red"}`}>
                    {n.rate}%
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
