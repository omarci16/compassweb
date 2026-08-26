import { AlertTriangle, Info, CircleAlert, ShieldCheck, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PainSignal, PainSignalSeverity } from "@/lib/types/app.types";

const SEVERITY_STYLES: Record<PainSignalSeverity, { class: string; icon: typeof AlertTriangle }> = {
  high: {
    class: "border-compass-red/30 bg-compass-red/5 text-compass-red",
    icon: AlertTriangle,
  },
  medium: {
    class: "border-compass-amber/40 bg-compass-amber/5 text-compass-amber",
    icon: CircleAlert,
  },
  low: {
    class: "border-border bg-muted/40 text-muted-foreground",
    icon: Info,
  },
};

function evidenceTitle(s: PainSignal): string {
  if (!s.evidence) {
    return s.confidence === "verified"
      ? "Ellenőrzött jelzés"
      : "Statikus HTML alapján — nem ellenőrzött, lehet téves";
  }
  const e = s.evidence;
  const parts = [
    `Forrás: ${e.method}`,
    e.final_url ? `URL: ${e.final_url}` : null,
    e.http_status != null ? `HTTP ${e.http_status}` : null,
    e.content_bytes != null ? `${e.content_bytes} byte` : null,
    e.checked_at ? `Ellenőrizve: ${new Date(e.checked_at).toLocaleString("hu-HU")}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function PainSignalsList({ signals }: { signals: PainSignal[] }) {
  if (signals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Nincs detektált fájdalompont.
      </p>
    );
  }

  // Sort: high severity first
  const order: Record<PainSignalSeverity, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...signals].sort((a, b) => order[a.severity] - order[b.severity]);

  return (
    <ul className="space-y-1.5">
      {sorted.map((s, i) => {
        const style = SEVERITY_STYLES[s.severity];
        const Icon = style.icon;
        const verified = s.confidence === "verified";
        return (
          <li
            key={`${s.code}-${i}`}
            className={cn(
              "flex items-start gap-2.5 rounded-md border px-3 py-2 text-sm",
              style.class,
            )}
          >
            <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="leading-snug flex-1">{s.label_hu}</span>
            <span
              title={evidenceTitle(s)}
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0 cursor-help",
                verified
                  ? "bg-compass-green/10 text-compass-green"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {verified ? (
                <ShieldCheck className="h-3 w-3" />
              ) : (
                <HelpCircle className="h-3 w-3" />
              )}
              {verified ? "Ellenőrzött" : "Nem ellenőrzött"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
