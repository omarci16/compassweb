import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Mail,
  AlertTriangle,
  CalendarDays,
} from "lucide-react";
import { getInvoices, getProjectById } from "@/lib/data/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StageProgress } from "@/components/projects/StageProgress";
import { StageGateGuard } from "@/components/projects/StageGateGuard";
import { BlockerField } from "@/components/projects/BlockerField";
import { WaitingOnBadge } from "@/components/projects/WaitingOnBadge";
import { UrgencyChip } from "@/components/projects/UrgencyIndicator";
import { MarkPaidButton } from "@/components/revenue/InvoiceActions";
import { PortalTokenManager } from "@/components/projects/PortalTokenManager";
import { checkGate } from "@/lib/utils/stage-gates";
import {
  PACKAGE_LABELS,
  PROJECT_STAGE_LABELS_HU,
} from "@/lib/types/app.types";
import {
  formatDateHu,
  formatHuf,
  formatRelativeHu,
} from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const project = await getProjectById(params.id);
  if (!project) notFound();
  const invoices = await getInvoices({ projectId: project.id });

  const depositInvoice = invoices.find((i) => i.type === "deposit") ?? null;
  const finalInvoice = invoices.find((i) => i.type === "final") ?? null;
  const nextStage = (project.current_stage + 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  const gate =
    project.current_stage < 7
      ? checkGate({ project, depositInvoice, finalInvoice }, nextStage)
      : { allowed: false, blockers: [] };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link href="/projects" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Projects
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {project.client_name}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            {project.client_company && (
              <span className="text-sm text-muted-foreground">{project.client_company}</span>
            )}
            <Badge variant="purple" className="font-normal">{PACKAGE_LABELS[project.package]}</Badge>
            <WaitingOnBadge waitingOn={project.waiting_on} size="md" />
            <UrgencyChip score={project.urgency_score} />
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StageGateGuard projectId={project.id} currentStage={project.current_stage} gate={gate} />
          <PortalTokenManager projectId={project.id} token={project.portal_token} />
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <StageProgress current={project.current_stage} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Blocker</CardTitle>
            </CardHeader>
            <CardContent>
              <BlockerField projectId={project.id} initial={project.blocker} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invoices yet.</p>
              ) : (
                <div className="space-y-2">
                  {invoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="text-sm font-medium capitalize">{inv.type.replace("_", " ")}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {inv.invoice_number ?? "—"} · due {inv.due_at ? formatDateHu(inv.due_at) : "—"}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="tabular-nums font-medium">{formatHuf(inv.amount_huf)}</span>
                        <Badge
                          variant={
                            inv.status === "paid" ? "success" :
                            inv.status === "overdue" ? "destructive" :
                            inv.status === "sent" ? "info" : "outline"
                          }
                          className="font-normal capitalize"
                        >
                          {inv.status}
                        </Badge>
                        <MarkPaidButton invoiceId={inv.id} status={inv.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <Stamp icon={CalendarDays} label="Contract signed" value={project.contract_signed_at} />
              <Stamp icon={CalendarDays} label="Deposit paid" value={project.deposit_paid_at} />
              <Stamp icon={CalendarDays} label="Materials deadline" value={project.materials_deadline} highlight={project.current_stage === 3} />
              <Stamp icon={CalendarDays} label="Materials received" value={project.materials_received_at} />
              <Stamp icon={CalendarDays} label="Blueprint approved" value={project.blueprint_approved_at} />
              <Stamp icon={CalendarDays} label="Staging sent" value={project.staging_sent_at} />
              <Stamp icon={CalendarDays} label="Revision deadline" value={project.revision_deadline} highlight={project.current_stage === 5} />
              <Stamp icon={CalendarDays} label="Revision received" value={project.revision_received_at} />
              <Stamp icon={CalendarDays} label="Final payment" value={project.final_payment_at} />
              <Stamp icon={CalendarDays} label="Launched" value={project.launched_at} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Project</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Stage" value={`${project.current_stage}. ${PROJECT_STAGE_LABELS_HU[project.current_stage]}`} />
              <Row label="Days in stage" value={`${project.days_in_current_stage}d`} />
              <Row label="Agreed price" value={formatHuf(project.agreed_price_huf)} />
              <Row label="Monthly fee" value={formatHuf(project.monthly_fee_huf)} />
              <Row label="Last portal view" value={project.portal_last_viewed_at ? formatRelativeHu(project.portal_last_viewed_at) : "Never"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Client</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Name" value={project.client_name} />
              <Row label="Email" value={project.client_email} />
              {project.staging_url && (
                <a
                  href={project.staging_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Staging <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {project.launch_url && (
                <a
                  href={project.launch_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline ml-3"
                >
                  Live <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </CardContent>
          </Card>

          {project.urgency_factors && Array.isArray(project.urgency_factors) && project.urgency_factors.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-compass-amber" />
                  Urgency drivers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs">
                {(project.urgency_factors as Array<{ label: string; delta: number }>).map((f, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span>{f.label}</span>
                    <span className="tabular-nums font-medium text-compass-red">+{f.delta}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right truncate">{value}</span>
    </div>
  );
}

function Stamp({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: typeof Mail;
  label: string;
  value: string | null;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${highlight ? "text-compass-amber" : "text-muted-foreground/60"}`} />
      <div className="flex-1 flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-xs ${value ? "font-medium text-foreground" : "text-muted-foreground italic"}`}>
          {value ? formatDateHu(value) : "—"}
        </span>
      </div>
    </div>
  );
}
