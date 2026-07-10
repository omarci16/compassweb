import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  Globe,
  Sparkles,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { getLeadById } from "@/lib/data/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadScoreBadge } from "@/components/leads/LeadScoreBadge";
import { EnrichmentStatusBadge } from "@/components/leads/EnrichmentStatus";
import { SpeedToLeadTimer } from "@/components/leads/SpeedToLeadTimer";
import { ScoreLeadButton } from "@/components/leads/ScoreLeadButton";
import { MoveToPipelineButton } from "@/components/leads/MoveToPipelineButton";
import { LeadStatusActions } from "@/components/leads/LeadStatusActions";
import { PainSignalsList } from "@/components/leads/PainSignalsList";
import { TechStackBadges } from "@/components/leads/TechStackBadges";
import { PainAuditCard } from "@/components/leads/PainAuditCard";
import { WebsiteSnapshotCard } from "@/components/leads/WebsiteSnapshotCard";
import { ColdOutreachModal } from "@/components/leads/ColdOutreachModal";
import {
  SOURCE_LABELS,
  PACKAGE_LABELS,
  type PainSignal,
  type TechStack,
} from "@/lib/types/app.types";
import { formatDateTimeHu, formatRelativeHu } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const lead = await getLeadById(params.id);
  if (!lead) notFound();

  const reasons = Array.isArray(lead.win_probability_reasons)
    ? (lead.win_probability_reasons as string[])
    : [];
  const painSignals: PainSignal[] = Array.isArray(lead.pain_signals)
    ? (lead.pain_signals as unknown as PainSignal[])
    : [];
  const techStack: TechStack | null = lead.tech_stack
    ? (lead.tech_stack as unknown as TechStack)
    : null;
  const isColdSourced = lead.source === "cold_outreach";
  const health = lead.website_health_status;
  const finalUrl =
    lead.website_health_details &&
    typeof lead.website_health_details === "object" &&
    "final_url" in lead.website_health_details
      ? ((lead.website_health_details as { final_url?: string }).final_url ?? null)
      : null;
  const verifiedByNature = health === "no_website" || health === "redirect_social";
  const unverifiable =
    !!health && ["blocked", "unreachable", "unknown", "js_shell"].includes(health);
  const verifiedSignals = painSignals.filter((s) => s.confidence === "verified");
  // The audit is only generatable once the site is verified (or verifiable by
  // nature) AND there is something verified to say.
  const canAudit =
    !unverifiable &&
    (verifiedByNature || !!lead.website_verified_at) &&
    (verifiedSignals.length > 0 || !!lead.enrichment_summary);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/leads"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> All leads
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {lead.company_name}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="font-normal">
              {SOURCE_LABELS[lead.source] ?? lead.source}
            </Badge>
            {lead.niche && <Badge variant="secondary" className="font-normal">{lead.niche}</Badge>}
            {lead.package_interest && (
              <Badge variant="purple" className="font-normal">
                {PACKAGE_LABELS[lead.package_interest]}
              </Badge>
            )}
            <EnrichmentStatusBadge status={lead.enrichment_status} />
            {lead.status === "new" && (
              <SpeedToLeadTimer
                createdAt={lead.created_at}
                firstContactAt={lead.first_contact_at}
              />
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {isColdSourced && (
              <ColdOutreachModal
                leadId={lead.id}
                hasEmail={!!lead.email}
                recipientEmail={lead.email}
                companyName={lead.company_name}
                screenshotUrl={lead.website_screenshot_url}
                verifiedAt={lead.website_verified_at}
              />
            )}
            <ScoreLeadButton leadId={lead.id} />
            {!["won", "lost", "archived"].includes(lead.status) && (
              <MoveToPipelineButton leadId={lead.id} />
            )}
          </div>
          <LeadStatusActions leadId={lead.id} status={lead.status} />
        </div>
      </div>

      {lead.status === "lost" && lead.loss_reason && (
        <Card className="border-compass-red/30 bg-compass-red/5">
          <CardContent className="pt-4 flex items-start gap-3">
            <XCircle className="h-4 w-4 text-compass-red mt-0.5 shrink-0" />
            <div className="text-sm">
              <div className="font-medium">Lost — {lead.loss_reason.replace("_", " ")}</div>
              {lead.loss_notes && (
                <p className="text-muted-foreground mt-0.5">{lead.loss_notes}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Win probability
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-semibold tabular-nums">
                  {lead.win_probability ?? "—"}
                </div>
                <div className="flex-1">
                  <LeadScoreBadge score={lead.win_probability} className="w-full" />
                  <p className="text-xs text-muted-foreground mt-2">
                    Combined deterministic rule score and AI adjustment.
                  </p>
                </div>
              </div>
              {reasons.length > 0 && (
                <ul className="mt-5 space-y-1.5">
                  {reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 text-compass-green mt-0.5 shrink-0" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Enrichment summary</CardTitle>
            </CardHeader>
            <CardContent>
              {lead.enrichment_summary ? (
                <p className="text-sm leading-relaxed text-foreground/90">
                  {lead.enrichment_summary}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Enrichment not yet available.
                </p>
              )}
            </CardContent>
          </Card>

          {isColdSourced && lead.website_url && (
            <WebsiteSnapshotCard
              leadId={lead.id}
              websiteUrl={lead.website_url}
              screenshotUrl={lead.website_screenshot_url}
              verifiedAt={lead.website_verified_at}
              finalUrl={finalUrl}
            />
          )}

          {isColdSourced && (
            <PainAuditCard
              leadId={lead.id}
              audit={lead.pain_audit}
              generatedAt={lead.pain_audit_generated_at}
              canGenerate={canAudit}
            />
          )}

          {painSignals.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Detektált fájdalompontok</CardTitle>
              </CardHeader>
              <CardContent>
                <PainSignalsList signals={painSignals} />
              </CardContent>
            </Card>
          )}

          {techStack && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Technikai felmérés</CardTitle>
              </CardHeader>
              <CardContent>
                <TechStackBadges tech={techStack} />
              </CardContent>
            </Card>
          )}

          {lead.internal_notes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Internal notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap text-foreground/90">
                  {lead.internal_notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <DetailRow icon={Mail} label="Email" value={lead.email} link={lead.email ? `mailto:${lead.email}` : undefined} />
              <DetailRow icon={Phone} label="Phone" value={lead.phone} link={lead.phone ? `tel:${lead.phone}` : undefined} />
              <DetailRow icon={Globe} label="Website" value={lead.website_url} link={lead.website_url ?? undefined} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Qualification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Toggle label="Budget confirmed" value={lead.budget_confirmed} />
              <Toggle label="Decision-maker confirmed" value={lead.decision_maker_confirmed} />
              <Toggle label="Has existing website" value={!!lead.has_existing_website} />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Timeline</span>
                <span className="font-medium">{lead.timeline_weeks ? `${lead.timeline_weeks} weeks` : "—"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Timestamps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <Stamp label="Created" value={formatDateTimeHu(lead.created_at)} hint={formatRelativeHu(lead.created_at)} />
              <Stamp label="Updated" value={formatDateTimeHu(lead.updated_at)} hint={formatRelativeHu(lead.updated_at)} />
              <Stamp label="First contact" value={lead.first_contact_at ? formatDateTimeHu(lead.first_contact_at) : "—"} hint={lead.speed_to_lead_minutes ? `${lead.speed_to_lead_minutes}m speed-to-lead` : undefined} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  link,
}: {
  icon: typeof Mail;
  label: string;
  value: string | null;
  link?: string;
}) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        {value ? (
          link ? (
            <a href={link} className="text-foreground hover:text-primary hover:underline truncate block" target="_blank" rel="noreferrer">
              {value}
            </a>
          ) : (
            <span className="text-foreground">{value}</span>
          )
        ) : (
          <span className="text-muted-foreground italic">—</span>
        )}
      </div>
    </div>
  );
}

function Toggle({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      {value ? (
        <CheckCircle2 className="h-4 w-4 text-compass-green" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground/40" />
      )}
    </div>
  );
}

function Stamp({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">
        <div className="font-medium text-foreground">{value}</div>
        {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
      </span>
    </div>
  );
}
