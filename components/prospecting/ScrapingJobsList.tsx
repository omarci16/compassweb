"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  PROSPECTING_NICHE_LABELS,
  type ProspectingNiche,
  type ScrapingJob,
  type ScrapingJobStatus,
} from "@/lib/types/app.types";
import { formatRelativeHu } from "@/lib/utils/format";
import { Loader2 } from "lucide-react";

const STATUS_VARIANTS: Record<
  ScrapingJobStatus,
  "default" | "secondary" | "success" | "warning" | "destructive" | "info" | "outline" | "purple"
> = {
  queued: "secondary",
  running: "info",
  collecting: "info",
  processing: "purple",
  complete: "success",
  failed: "destructive",
  cancelled: "outline",
};

const STATUS_LABEL: Record<ScrapingJobStatus, string> = {
  queued: "Várakozik",
  running: "Fut",
  collecting: "Gyűjt",
  processing: "Feldolgoz",
  complete: "Kész",
  failed: "Hibás",
  cancelled: "Megszakítva",
};

export function ScrapingJobsList({
  jobs: initialJobs,
}: {
  jobs: ScrapingJob[];
}) {
  const [jobs, setJobs] = useState(initialJobs);

  // Refresh every 4 seconds while any job is in a non-terminal state
  useEffect(() => {
    const hasActive = jobs.some(
      (j) => !["complete", "failed", "cancelled"].includes(j.status),
    );
    if (!hasActive) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/prospecting/jobs", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { jobs?: ScrapingJob[] };
        if (data.jobs) setJobs(data.jobs);
      } catch {
        /* ignore */
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [jobs]);

  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Még nincs futtatott vadászat. Indíts egyet fent!
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Niche</TableHead>
            <TableHead>Város</TableHead>
            <TableHead>Státusz</TableHead>
            <TableHead className="text-right">Scraped</TableHead>
            <TableHead className="text-right">Új lead</TableHead>
            <TableHead className="text-right">Top tier</TableHead>
            <TableHead className="text-right">Költség</TableHead>
            <TableHead>Mikor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => {
            const isActive = !["complete", "failed", "cancelled"].includes(job.status);
            return (
              <TableRow key={job.id}>
                <TableCell className="font-medium">
                  {PROSPECTING_NICHE_LABELS[job.niche as ProspectingNiche] ?? job.niche}
                </TableCell>
                <TableCell>{job.city}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[job.status]}>
                    {isActive && (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    )}
                    {STATUS_LABEL[job.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {job.total_scraped || (isActive ? "—" : 0)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {job.total_imported || (isActive ? "—" : 0)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {job.total_top_tier > 0 ? (
                    <span className="text-compass-green font-semibold">
                      {job.total_top_tier}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {isActive ? "—" : 0}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                  {job.estimated_cost_usd != null
                    ? `$${Number(job.estimated_cost_usd).toFixed(2)}`
                    : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatRelativeHu(job.created_at)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
