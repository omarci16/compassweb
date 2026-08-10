"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LeadScoreBadge } from "./LeadScoreBadge";
import { SpeedToLeadTimer } from "./SpeedToLeadTimer";
import { EnrichmentStatusBadge } from "./EnrichmentStatus";
import { formatRelativeHu } from "@/lib/utils/format";
import { SOURCE_LABELS, type Lead, type LeadSource, type LeadStatus } from "@/lib/types/app.types";
import { isContactable, leadReachChannel } from "@/lib/prospecting/contactability";
import { ArrowRight, AtSign, Filter, MessageCircle, Phone, Slash } from "lucide-react";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "info" | "outline" | "purple"> = {
  new: "info",
  enriching: "secondary",
  qualified: "success",
  visual_sent: "purple",
  proposal_sent: "purple",
  negotiating: "warning",
  won: "success",
  lost: "destructive",
  archived: "outline",
};

/**
 * Which channel this lead is reachable on. A harvested address (Phase I) is
 * marked so it is obvious the win came from the site, not Google Maps.
 */
function ReachBadge({ lead }: { lead: Lead }) {
  const channel = leadReachChannel(lead);

  if (channel === "none") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Slash className="h-3 w-3" />
        none
      </span>
    );
  }

  const meta = {
    email: { icon: AtSign, label: "email", variant: "success" as const },
    social: { icon: MessageCircle, label: "DM", variant: "purple" as const },
    phone: { icon: Phone, label: "phone", variant: "outline" as const },
  }[channel];

  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant={meta.variant} className="font-normal gap-1">
        <meta.icon className="h-3 w-3" />
        {meta.label}
      </Badge>
      {channel === "email" && lead.contact_source === "website" && (
        <span
          className="text-[10px] text-muted-foreground"
          title="A weboldalról kinyert cím (nem a Google Mapsről)"
        >
          web
        </span>
      )}
    </span>
  );
}

export function LeadsTable({ leads }: { leads: Lead[] }) {
  const [q, setQ] = useState("");
  const [source, setSource] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [reach, setReach] = useState<string>("all");

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (q && !`${l.company_name} ${l.contact_name ?? ""} ${l.niche ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (source !== "all" && l.source !== source) return false;
      if (status !== "all" && l.status !== status) return false;
      if (reach === "reachable" && !isContactable(l)) return false;
      if (reach === "unreachable" && isContactable(l)) return false;
      return true;
    });
  }, [leads, q, source, status, reach]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Input
            placeholder="Search company, contact, niche…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8"
          />
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {Object.entries(SOURCE_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["new", "enriching", "qualified", "visual_sent", "proposal_sent", "negotiating", "won", "lost", "archived"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={reach} onValueChange={setReach}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any contactability</SelectItem>
            <SelectItem value="reachable">Contactable only</SelectItem>
            <SelectItem value="unreachable">No channel</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Company</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Enrichment</TableHead>
              <TableHead>Speed</TableHead>
              <TableHead className="text-right">Created</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((l) => (
              <TableRow key={l.id} className="cursor-pointer">
                <TableCell>
                  <Link href={`/leads/${l.id}`} className="block">
                    <div className="font-medium text-sm">{l.company_name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {l.niche ?? "—"} {l.contact_name ? `· ${l.contact_name}` : ""}
                    </div>
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-normal">
                    {SOURCE_LABELS[l.source as LeadSource] ?? l.source}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[l.status] ?? "outline"} className="font-normal capitalize">
                    {l.status.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <LeadScoreBadge score={l.win_probability} />
                </TableCell>
                <TableCell>
                  <ReachBadge lead={l} />
                </TableCell>
                <TableCell>
                  <EnrichmentStatusBadge status={l.enrichment_status} />
                </TableCell>
                <TableCell>
                  {l.status === "new" ? (
                    <SpeedToLeadTimer
                      createdAt={l.created_at}
                      firstContactAt={l.first_contact_at}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {formatRelativeHu(l.created_at)}
                </TableCell>
                <TableCell>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-12">
                  No leads match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
