import Link from "next/link";
import { Mail, Snowflake, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  getEmailLog,
  getDeals,
  getLeads,
  getProjects,
} from "@/lib/data/queries";
import { formatRelativeHu } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  proposal: "Proposal",
  follow_up: "Follow-up",
  contract: "Contract",
  invoice: "Invoice",
  staging_delivery: "Staging delivery",
  re_engagement: "Re-engagement",
  cold_outreach: "Cold outreach",
  general: "General",
};

const TYPE_VARIANT: Record<string, "default" | "info" | "purple" | "warning" | "success" | "outline"> = {
  proposal: "purple",
  follow_up: "info",
  contract: "info",
  invoice: "warning",
  staging_delivery: "success",
  re_engagement: "info",
  cold_outreach: "purple",
  general: "outline",
};

export default async function OutreachPage() {
  const [log, deals, leads, projects] = await Promise.all([
    getEmailLog({ direction: "outbound", limit: 100 }),
    getDeals(),
    getLeads({ limit: 500 }),
    getProjects(),
  ]);

  const recipientFor = (e: typeof log[number]) => {
    if (e.project_id) {
      const p = projects.find((x) => x.id === e.project_id);
      return { name: p?.client_name ?? e.to_address, href: p ? `/projects/${p.id}` : null };
    }
    if (e.deal_id) {
      const d = deals.find((x) => x.id === e.deal_id);
      const lead = d ? leads.find((l) => l.id === d.lead_id) : null;
      return {
        name: lead?.company_name ?? e.to_address,
        href: d ? `/pipeline/${d.id}` : null,
      };
    }
    if (e.lead_id) {
      const l = leads.find((x) => x.id === e.lead_id);
      return { name: l?.company_name ?? e.to_address, href: l ? `/leads/${l.id}` : null };
    }
    return { name: e.to_address, href: null };
  };

  const aiDrafted = log.filter((e) => e.ai_drafted);
  const coldOutreach = log.filter((e) => e.type === "cold_outreach");
  const sent = log;

  const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const coldThisWeek = coldOutreach.filter(
    (e) => new Date(e.sent_at ?? e.created_at) >= last7Days,
  ).length;
  const coldLeadIds = new Set(
    coldOutreach.map((e) => e.lead_id).filter(Boolean),
  );
  const coldLeadsReached = coldLeadIds.size;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Outreach</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Outbound email log. AI-drafted emails are flagged so you can audit what the system wrote vs you wrote.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Cold outreach (összes)
            </div>
            <div className="mt-1 text-2xl font-semibold">{coldOutreach.length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {coldLeadsReached} egyedi lead elért
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Hideg küldemény (utolsó 7 nap)
            </div>
            <div className="mt-1 text-2xl font-semibold">{coldThisWeek}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Friss outbound aktivitás
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              AI-drafted (összes)
            </div>
            <div className="mt-1 text-2xl font-semibold">{aiDrafted.length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Sonnet által megírt
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Snowflake className="h-4 w-4 text-primary" />
            Cold outreach (elküldött)
            <Badge variant="purple" className="font-normal">{coldOutreach.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {coldOutreach.length === 0 ? (
            <EmptyState
              icon={Snowflake}
              title="Még nincs elküldött cold outreach"
              description="Egy lead profilból a 'Cold outreach' gombbal indíthatsz egy személyre szabott első üzenetet."
            />
          ) : (
            <div className="space-y-2">
              {coldOutreach.map((e) => {
                const r = recipientFor(e);
                const card = (
                  <div className="rounded-lg border border-border bg-background p-3 hover:bg-accent/40 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="purple" className="font-normal">
                            Cold
                          </Badge>
                          {e.ai_drafted && (
                            <Badge variant="outline" className="font-normal gap-1">
                              <Sparkles className="h-2.5 w-2.5" />
                              AI
                            </Badge>
                          )}
                          <span className="text-sm font-medium">{r.name}</span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-foreground/90 truncate">
                          {e.subject}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatRelativeHu(e.sent_at ?? e.created_at)} · {e.to_address}
                        </p>
                      </div>
                    </div>
                  </div>
                );
                return <div key={e.id}>{r.href ? <Link href={r.href}>{card}</Link> : card}</div>;
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI-drafted (sent)
            <Badge variant="purple" className="font-normal">{aiDrafted.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {aiDrafted.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="No AI-drafted emails yet"
              description="Generate proposals or follow-ups via the pipeline. AI-flagged emails appear here for audit."
            />
          ) : (
            <div className="space-y-2">
              {aiDrafted.map((e) => {
                const r = recipientFor(e);
                const card = (
                  <div className="rounded-lg border border-border bg-background p-3 hover:bg-accent/40 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={TYPE_VARIANT[e.type ?? "general"] ?? "outline"} className="font-normal">
                            {TYPE_LABEL[e.type ?? "general"] ?? e.type}
                          </Badge>
                          <span className="text-sm font-medium">{r.name}</span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-foreground/90 truncate">
                          {e.subject}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Sent {formatRelativeHu(e.sent_at ?? e.created_at)} · {e.to_address}
                        </p>
                      </div>
                    </div>
                  </div>
                );
                return <div key={e.id}>{r.href ? <Link href={r.href}>{card}</Link> : card}</div>;
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>All outbound</CardTitle>
        </CardHeader>
        <CardContent>
          {sent.length === 0 ? (
            <EmptyState icon={Mail} title="No emails sent yet" description="Outbound activity logged via Resend will appear here." />
          ) : (
            <div className="space-y-2">
              {sent.map((e) => {
                const r = recipientFor(e);
                const row = (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 hover:bg-accent/40 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium truncate">{r.name}</span>
                      <Badge variant="outline" className="font-normal capitalize shrink-0">
                        {TYPE_LABEL[e.type ?? "general"] ?? e.type}
                      </Badge>
                      {e.ai_drafted && (
                        <Badge variant="purple" className="font-normal shrink-0 gap-1">
                          <Sparkles className="h-2.5 w-2.5" />
                          AI
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatRelativeHu(e.sent_at ?? e.created_at)}
                    </span>
                  </div>
                );
                return <div key={e.id}>{r.href ? <Link href={r.href}>{row}</Link> : row}</div>;
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
