import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  Coins,
  Receipt,
  TrendingUp,
  Users,
} from "lucide-react";
import { getInvoices, getProjects, getRevenueMetrics } from "@/lib/data/queries";
import { Stat } from "@/components/shared/Stat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MarkPaidButton } from "@/components/revenue/InvoiceActions";
import {
  formatDateHu,
  formatHuf,
  formatHufCompact,
  formatRelativeHu,
} from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function RevenuePage() {
  const [metrics, invoices, projects] = await Promise.all([
    getRevenueMetrics(),
    getInvoices(),
    getProjects(),
  ]);

  const retainerProjects = projects.filter((p) => p.current_stage === 7);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Revenue & retainers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cashflow at a glance. Monthly retainer invoices auto-generate on the 1st.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="MRR (current)"
          value={formatHufCompact(metrics.mrr_current)}
          hint={`${metrics.retainer_clients} retainer clients`}
          icon={Banknote}
          tone="positive"
        />
        <Stat
          label="MRR (projected)"
          value={formatHufCompact(metrics.mrr_projected)}
          hint="incl. stage 5–6 launches"
          icon={TrendingUp}
        />
        <Stat
          label="One-time this month"
          value={formatHufCompact(metrics.one_time_this_month)}
          hint="deposit + final invoices"
          icon={Coins}
        />
        <Stat
          label="Outstanding"
          value={formatHufCompact(metrics.outstanding)}
          hint="unpaid sent invoices"
          icon={Receipt}
          tone={metrics.outstanding > 0 ? "warning" : "neutral"}
        />
        <Stat
          label="Overdue"
          value={formatHufCompact(metrics.overdue)}
          hint={metrics.overdue > 0 ? "needs chasing" : "all clear"}
          icon={AlertTriangle}
          tone={metrics.overdue > 0 ? "danger" : "positive"}
        />
        <Stat
          label="Retainer clients"
          value={metrics.retainer_clients}
          hint={`${formatHufCompact(metrics.mrr_current)} MRR total`}
          icon={Users}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[120px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => {
                const project = projects.find((p) => p.id === inv.project_id);
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.invoice_number ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal capitalize">{inv.type.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell>
                      {project ? (
                        <Link href={`/erp/projects/${project.id}`} className="text-sm hover:underline">
                          {project.client_name}
                        </Link>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {inv.issued_at ? formatDateHu(inv.issued_at) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {inv.due_at ? (
                        <span className={inv.status === "overdue" ? "text-compass-red font-medium" : ""}>
                          {formatDateHu(inv.due_at)}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatHuf(inv.amount_huf)}
                    </TableCell>
                    <TableCell className="text-right">
                      <MarkPaidButton invoiceId={inv.id} status={inv.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {retainerProjects.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              Retainer roster
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {retainerProjects.map((p) => (
              <Link
                key={p.id}
                href={`/erp/projects/${p.id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 hover:bg-accent/50"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.client_name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    Live {formatRelativeHu(p.launched_at)} · last portal view {p.portal_last_viewed_at ? formatRelativeHu(p.portal_last_viewed_at) : "never"}
                  </div>
                </div>
                <div className="font-medium tabular-nums">{formatHuf(p.monthly_fee_huf)}/mo</div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
