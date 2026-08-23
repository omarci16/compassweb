"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  PROSPECTING_NICHE_LABELS_HU,
  SOURCE_LABELS,
  type Lead,
  type LeadSource,
} from "@/lib/types/app.types";
import { leadReachChannel } from "@/lib/prospecting/contactability";
import {
  DATE_PRESET_LABELS,
  EMPTY_CRITERIA,
  collectNiches,
  filterLeads,
  hasActiveFilters,
  type DatePreset,
  type LeadFilterCriteria,
} from "@/lib/leads/lead-filters";
import { summarizeDeletion, type Blocked } from "@/lib/leads/deletable";
import {
  ArrowRight,
  AtSign,
  Filter,
  Loader2,
  MessageCircle,
  Phone,
  Slash,
  Trash2,
  X,
} from "lucide-react";

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

const STATUSES = [
  "new",
  "enriching",
  "qualified",
  "visual_sent",
  "proposal_sent",
  "negotiating",
  "won",
  "lost",
  "archived",
];

const DATE_PRESETS: DatePreset[] = ["all", "today", "7d", "30d", "90d"];

/**
 * Prettify a niche when it's one of ours; otherwise show it as stored. Leads
 * carry free-text niches (inbound ones especially), so this can't be a lookup
 * that assumes every value is a ProspectingNiche.
 */
function nicheLabel(niche: string): string {
  return (PROSPECTING_NICHE_LABELS_HU as Record<string, string>)[niche] ?? niche;
}

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
  const router = useRouter();
  const [criteria, setCriteria] = useState<LeadFilterCriteria>(EMPTY_CRITERIA);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [result, setResult] = useState<{ message: string; blocked: Blocked[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const niches = useMemo(() => collectNiches(leads), [leads]);
  const filtered = useMemo(() => filterLeads(leads, criteria), [leads, criteria]);

  const set = <K extends keyof LeadFilterCriteria>(key: K, value: LeadFilterCriteria[K]) =>
    setCriteria((c) => ({ ...c, [key]: value }));

  // Selection is scoped to what's on screen: filter down, select all, delete.
  const visibleIds = useMemo(() => filtered.map((l) => l.id), [filtered]);
  const selectedVisible = visibleIds.filter((id) => selected.has(id));
  const allVisibleSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearFilters() {
    setCriteria(EMPTY_CRITERIA);
  }

  async function doDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/leads/bulk-delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: selectedVisible }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "A törlés nem sikerült");
        return;
      }
      setResult({
        message: data.demo
          ? "Demo mód — nincs Supabase, a törlés kihagyva."
          : summarizeDeletion(data.deleted ?? 0, (data.blocked ?? []).length),
        blocked: data.blocked ?? [],
      });
      setSelected(new Set());
      setConfirmOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ismeretlen hiba");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Input
            placeholder="Cég, kapcsolattartó, email…"
            value={criteria.q}
            onChange={(e) => set("q", e.target.value)}
            className="pl-8"
          />
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        </div>

        <Select value={criteria.niche} onValueChange={(v) => set("niche", v)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Minden iparág</SelectItem>
            {niches.map((n) => (
              <SelectItem key={n} value={n}>{nicheLabel(n)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={criteria.date} onValueChange={(v) => set("date", v as DatePreset)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DATE_PRESETS.map((p) => (
              <SelectItem key={p} value={p}>{DATE_PRESET_LABELS[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={criteria.source} onValueChange={(v) => set("source", v)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Minden forrás</SelectItem>
            {Object.entries(SOURCE_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={criteria.status} onValueChange={(v) => set("status", v)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Minden státusz</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={criteria.reach} onValueChange={(v) => set("reach", v)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Bárhogy elérhető</SelectItem>
            <SelectItem value="reachable">Csak elérhető</SelectItem>
            <SelectItem value="unreachable">Nincs csatorna</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters(criteria) && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-3.5 w-3.5 mr-1" />
            Szűrők törlése
          </Button>
        )}
      </div>

      {/* Selection action bar */}
      {selectedVisible.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
          <span className="text-sm">
            <b>{selectedVisible.length}</b> lead kijelölve
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Kijelölés törlése
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Törlés
            </Button>
          </div>
        </div>
      )}

      {/* Result / error */}
      {error && <p className="text-sm text-compass-red">{error}</p>}
      {result && (
        <div className="rounded-lg border border-border bg-card px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">{result.message}</span>
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setResult(null)}
            >
              Bezár
            </button>
          </div>
          {result.blocked.length > 0 && (
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {result.blocked.map((b) => (
                <li key={b.id}>
                  <span className="text-foreground">{b.company_name}</span> — {b.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {filtered.length} / {leads.length} lead
        </span>
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={toggleAllVisible}
                  aria-label="Összes látható kijelölése"
                  disabled={visibleIds.length === 0}
                />
              </TableHead>
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
              <TableRow key={l.id} data-state={selected.has(l.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(l.id)}
                    onCheckedChange={() => toggleOne(l.id)}
                    aria-label={`${l.company_name} kijelölése`}
                  />
                </TableCell>
                <TableCell>
                  <Link href={`/leads/${l.id}`} className="block">
                    <div className="font-medium text-sm">{l.company_name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {l.niche ? nicheLabel(l.niche) : "—"}
                      {l.contact_name ? ` · ${l.contact_name}` : ""}
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
                  <Link href={`/leads/${l.id}`} aria-label="Megnyitás">
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-12">
                  Nincs a szűrőknek megfelelő lead.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{selectedVisible.length} lead törlése</DialogTitle>
            <DialogDescription>
              Ez végleges, nem visszavonható. A leadeket, amikhez tartozik
              projekt, deal, vagy akiknek már küldtünk emailt, a rendszer
              automatikusan megtartja — a törlés után listázza is őket.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={deleting}>
              Mégse
            </Button>
            <Button variant="destructive" onClick={() => void doDelete()} disabled={deleting}>
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Végleges törlés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
