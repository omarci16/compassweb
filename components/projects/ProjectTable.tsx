"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { WaitingOnBadge } from "./WaitingOnBadge";
import { UrgencyChip } from "./UrgencyIndicator";
import {
  PACKAGE_LABELS,
  PROJECT_STAGE_LABELS_HU,
  type Project,
} from "@/lib/types/app.types";
import { formatHufCompact } from "@/lib/utils/format";
import { ArrowRight } from "lucide-react";

export function ProjectTable({ projects }: { projects: Project[] }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Client</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Package</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Waiting</TableHead>
            <TableHead>Urgency</TableHead>
            <TableHead className="text-right">Days in stage</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((p) => (
            <TableRow key={p.id} className="cursor-pointer">
              <TableCell>
                <Link href={`/erp/projects/${p.id}`} className="block">
                  <div className="font-medium text-sm">{p.client_name}</div>
                  <div className="text-[11px] text-muted-foreground">{p.client_company ?? ""}</div>
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="font-normal">
                  {p.current_stage}. {PROJECT_STAGE_LABELS_HU[p.current_stage]}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="purple" className="font-normal">{PACKAGE_LABELS[p.package]}</Badge>
              </TableCell>
              <TableCell className="text-sm tabular-nums">{formatHufCompact(p.agreed_price_huf)}</TableCell>
              <TableCell><WaitingOnBadge waitingOn={p.waiting_on} /></TableCell>
              <TableCell><UrgencyChip score={p.urgency_score} /></TableCell>
              <TableCell className="text-right text-sm tabular-nums">{p.days_in_current_stage}d</TableCell>
              <TableCell><ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /></TableCell>
            </TableRow>
          ))}
          {projects.length === 0 && (
            <TableRow><TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">No projects.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
