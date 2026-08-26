import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PROSPECTING_NICHE_LABELS,
  type ProspectingNiche,
} from "@/lib/types/app.types";
import type { SourceEffectivenessRow } from "@/lib/data/queries";
import { formatRelativeHu } from "@/lib/utils/format";

function pct(v: number): string {
  if (!isFinite(v) || v === 0) return "—";
  return `${Math.round(v * 100)}%`;
}

export function SourceEffectiveness({ rows }: { rows: SourceEffectivenessRow[] }) {
  // Only show jobs that imported at least one lead
  const filtered = rows.filter((r) => r.total_imported > 0);

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Nincs még mérhető adat. Indíts vadászatot és kontaktálj le leadeket — itt fog megjelenni, melyik kombináció konvertál.
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
            <TableHead className="text-right">Importált</TableHead>
            <TableHead className="text-right">Kontaktálva</TableHead>
            <TableHead className="text-right">Minősített</TableHead>
            <TableHead className="text-right">Nyert</TableHead>
            <TableHead className="text-right">Win rate</TableHead>
            <TableHead>Mikor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((r) => (
            <TableRow key={r.job_id}>
              <TableCell className="font-medium">
                {PROSPECTING_NICHE_LABELS[r.niche as ProspectingNiche] ?? r.niche}
              </TableCell>
              <TableCell>{r.city}</TableCell>
              <TableCell className="text-right tabular-nums">{r.total_imported}</TableCell>
              <TableCell className="text-right tabular-nums">
                {r.total_contacted} <span className="text-xs text-muted-foreground">({pct(r.contact_rate)})</span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.total_qualified} <span className="text-xs text-muted-foreground">({pct(r.qualification_rate)})</span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.total_won > 0 ? (
                  <span className="text-compass-green font-semibold">{r.total_won}</span>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.total_won > 0 ? (
                  <span className="text-compass-green font-semibold">{pct(r.win_rate)}</span>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatRelativeHu(r.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
