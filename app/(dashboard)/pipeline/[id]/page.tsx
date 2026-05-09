import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getDeals, getLeadById } from "@/lib/data/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VisualDropZone } from "@/components/pipeline/VisualDropZone";
import { ProposalActions } from "@/components/pipeline/ProposalActions";
import { LeadScoreBadge } from "@/components/leads/LeadScoreBadge";
import { UrgencyChip } from "@/components/projects/UrgencyIndicator";
import {
  DEAL_STAGE_LABELS,
  PACKAGE_LABELS,
} from "@/lib/types/app.types";
import { formatHuf, formatRelativeHu } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function DealDetailPage({ params }: { params: { id: string } }) {
  const deals = await getDeals();
  const deal = deals.find((d) => d.id === params.id);
  if (!deal) notFound();
  const lead = await getLeadById(deal.lead_id);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link href="/pipeline" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Pipeline
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{lead?.company_name ?? "—"}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="purple" className="font-normal">
              {DEAL_STAGE_LABELS[deal.stage]}
            </Badge>
            {deal.proposed_package && (
              <Badge variant="secondary" className="font-normal">
                {PACKAGE_LABELS[deal.proposed_package]}
              </Badge>
            )}
            {deal.urgency_score != null && <UrgencyChip score={deal.urgency_score} />}
            {lead?.win_probability != null && <LeadScoreBadge score={lead.win_probability} />}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Visual concept</CardTitle>
            </CardHeader>
            <CardContent>
              <VisualDropZone dealId={deal.id} initialUrl={deal.vercel_preview_url} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Proposal</CardTitle>
            </CardHeader>
            <CardContent>
              <ProposalActions
                dealId={deal.id}
                recipientEmail={lead?.email ?? null}
                proposalSentAt={deal.proposal_sent_at}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Deal economics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Proposed price" value={formatHuf(deal.proposed_price_huf)} />
              <Row label="Monthly retainer" value={formatHuf(deal.monthly_fee_huf)} />
              <Row label="Last client contact" value={deal.last_client_contact_at ? formatRelativeHu(deal.last_client_contact_at) : "—"} />
              <Row label="Follow-up count" value={String(deal.followup_count)} />
            </CardContent>
          </Card>

          {lead && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Lead snapshot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Contact" value={lead.contact_name ?? "—"} />
                <Row label="Email" value={lead.email ?? "—"} />
                <Row label="Niche" value={lead.niche ?? "—"} />
                {lead.enrichment_summary && (
                  <p className="mt-3 pt-3 border-t border-border text-xs leading-relaxed text-muted-foreground">
                    {lead.enrichment_summary}
                  </p>
                )}
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
