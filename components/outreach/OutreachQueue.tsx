"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Loader2,
  Send,
  Sparkles,
  ThumbsUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/shared/EmptyState";
import type { OutreachDraftView } from "@/lib/data/queries";
import { formatRelativeHu } from "@/lib/utils/format";

const TRACK_LABEL: Record<string, string> = {
  needs_site: "Nincs oldal",
  upgrade: "Fejlesztés",
  low_priority: "Alacsony prioritás",
};
const TRACK_VARIANT: Record<string, "purple" | "info" | "outline"> = {
  needs_site: "purple",
  upgrade: "info",
  low_priority: "outline",
};
const EMAIL_VARIANT: Record<string, "success" | "warning" | "outline"> = {
  valid: "success",
  risky: "warning",
  unknown: "outline",
};

export function OutreachQueue({ drafts }: { drafts: OutreachDraftView[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sendingQueue, setSendingQueue] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = useMemo(() => drafts.filter((d) => d.status === "draft"), [drafts]);
  const approved = useMemo(() => drafts.filter((d) => d.status !== "draft"), [drafts]);

  const setBusyFor = (id: string, on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  async function patch(id: string, status: "approved" | "skipped") {
    setBusyFor(id, true);
    setError(null);
    try {
      const res = await fetch(`/api/outreach/drafts/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Hiba");
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ismeretlen hiba");
    } finally {
      setBusyFor(id, false);
    }
  }

  async function bulkApprove() {
    const ids = Array.from(selected);
    for (const id of ids) await patch(id, "approved");
    setSelected(new Set());
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/outreach/drafts/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit: 10 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Nem sikerült elindítani a generálást");
        return;
      }
      setNotice("Piszkozat-generálás elindítva a háttérben — frissítsd az oldalt pár másodperc múlva.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ismeretlen hiba");
    } finally {
      setGenerating(false);
    }
  }

  async function startSending() {
    setSendingQueue(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/outreach/send-queue", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Nem sikerült elindítani a küldést");
        return;
      }
      setNotice(
        "Küldés elindítva — a jóváhagyott levelek rotált postafiókokból, napi limit és 3–7 perc időzítés mellett mennek ki.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ismeretlen hiba");
    } finally {
      setSendingQueue(false);
    }
  }

  const toggleSel = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderDraft = (d: OutreachDraftView, reviewable: boolean) => (
    <div key={d.id} className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-start gap-3">
        {reviewable && (
          <Checkbox
            className="mt-1"
            checked={selected.has(d.id)}
            onCheckedChange={() => toggleSel(d.id)}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={TRACK_VARIANT[d.track] ?? "outline"} className="font-normal">
              {TRACK_LABEL[d.track] ?? d.track}
            </Badge>
            <span className="text-sm font-medium">{d.company_name}</span>
            {d.email_status && (
              <Badge
                variant={EMAIL_VARIANT[d.email_status] ?? "outline"}
                className="font-normal text-[10px]"
              >
                {d.email_status}
              </Badge>
            )}
            {d.status !== "draft" && (
              <Badge variant="success" className="font-normal">
                {d.status === "approved" ? "Jóváhagyva" : d.status}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm font-medium text-foreground/90 truncate">{d.subject}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {d.email ?? "nincs email"} · {formatRelativeHu(d.created_at)}
            {d.touch_number > 1 ? ` · ${d.touch_number}. érintés` : ""}
          </p>

          <button
            type="button"
            onClick={() => setExpanded((e) => (e === d.id ? null : d.id))}
            className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ChevronDown
              className={`h-3 w-3 transition-transform ${expanded === d.id ? "rotate-180" : ""}`}
            />
            Előnézet
          </button>
          {expanded === d.id && (
            <div
              className="prose prose-sm mt-2 max-w-none rounded-md border border-border bg-muted/30 p-3 text-[13px] [&_p]:my-2"
              dangerouslySetInnerHTML={{ __html: d.body_html }}
            />
          )}
        </div>

        {reviewable && (
          <div className="flex shrink-0 flex-col gap-1.5">
            <Button
              size="sm"
              className="h-7"
              disabled={busy.has(d.id)}
              onClick={() => void patch(d.id, "approved")}
            >
              {busy.has(d.id) ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Jóváhagy
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-muted-foreground"
              disabled={busy.has(d.id)}
              onClick={() => void patch(d.id, "skipped")}
            >
              <X className="h-3 w-3" />
              Elvet
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void generate()} disabled={generating}>
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            )}
            Piszkozatok generálása
          </Button>
          {selected.size > 0 && (
            <Button size="sm" onClick={() => void bulkApprove()}>
              <ThumbsUp className="h-3.5 w-3.5 mr-1.5" />
              {selected.size} kijelölt jóváhagyása
            </Button>
          )}
          {approved.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void startSending()}
              disabled={sendingQueue}
            >
              {sendingQueue ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Send className="h-3.5 w-3.5 mr-1.5" />
              )}
              Jóváhagyottak küldése ({approved.length})
            </Button>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {pending.length} jóváhagyásra vár · {approved.length} jóváhagyva
        </span>
      </div>

      {notice && <p className="text-xs text-compass-green">{notice}</p>}
      {error && <p className="text-xs text-compass-red">{error}</p>}

      {pending.length === 0 && approved.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Nincs piszkozat a sorban"
          description="Generálj piszkozatokat a legjobb hideg leadekhez, vagy indíts egyet egy lead profilból. Minden küldést Te hagysz jóvá."
        />
      ) : (
        <div className="space-y-2">
          {pending.map((d) => renderDraft(d, true))}
          {approved.map((d) => renderDraft(d, false))}
        </div>
      )}
    </div>
  );
}
