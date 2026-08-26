import { notFound } from "next/navigation";
import { Compass, CheckCircle2, Circle, Mail, ExternalLink } from "lucide-react";
import { getInvoices, getProjectByPortalToken } from "@/lib/data/queries";
import { isValidPortalToken } from "@/lib/utils/portal-token";
import {
  PROJECT_STAGE_LABELS_HU,
  PACKAGE_LABELS,
  type ProjectStage,
} from "@/lib/types/app.types";
import { formatDateHu, formatHuf } from "@/lib/utils/format";
import { StageProgress } from "@/components/projects/StageProgress";

const STAGES: ProjectStage[] = [0, 1, 2, 3, 4, 5, 6, 7];

export const metadata = { title: "Compass · Project portal" };

export default async function PortalPage({ params }: { params: { token: string } }) {
  if (!isValidPortalToken(params.token)) notFound();
  const project = await getProjectByPortalToken(params.token);
  if (!project) notFound();

  const invoices = await getInvoices({ projectId: project.id });
  const blueprint = project.blueprint_data as Record<string, unknown> | null;

  const checklist = [
    { label: "Logo / brand assets", done: !!project.materials_received_at },
    { label: "Brand colors and typography", done: !!project.materials_received_at },
    { label: "Photos / product imagery", done: !!project.materials_received_at },
    { label: "Copy text / page content", done: !!project.materials_received_at },
    { label: "Reference websites", done: !!project.materials_received_at },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Compass className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Compass · Projekt portál</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {project.client_company ?? project.client_name}
              </div>
            </div>
          </div>
          <a
            href="mailto:info@compassmarketing.hu"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <Mail className="h-3 w-3" />
            Kérdés esetén
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8 space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold">
            Üdvözöljük, {project.client_name}!
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Itt követheti a projekt állását. Csomag:{" "}
            <strong className="text-foreground">{PACKAGE_LABELS[project.package]}</strong>.
          </p>

          <div className="mt-6">
            <StageProgress current={project.current_stage} />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-base font-semibold mb-3">Anyagok ellenőrző listája</h2>
          <ul className="space-y-2">
            {checklist.map((c, i) => (
              <li key={i} className="flex items-center gap-2.5 text-sm">
                {c.done ? (
                  <CheckCircle2 className="h-4 w-4 text-compass-green" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/40" />
                )}
                <span className={c.done ? "" : "text-muted-foreground"}>{c.label}</span>
              </li>
            ))}
          </ul>
          {project.materials_deadline && !project.materials_received_at && (
            <p className="mt-3 text-xs text-compass-amber">
              Határidő: {formatDateHu(project.materials_deadline)} — kérjük, küldje el az
              anyagokat eddig az időpontig.
            </p>
          )}
        </section>

        {blueprint && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-base font-semibold mb-3">Stratégiai blueprint</h2>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              {Object.entries(blueprint)
                .filter(([k, v]) => typeof v === "string" && k !== "build_instructions")
                .slice(0, 6)
                .map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-muted/50 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {k.replace(/_/g, " ")}
                    </div>
                    <div className="mt-0.5 text-sm">{String(v)}</div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {project.staging_url && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-base font-semibold mb-2">Staging előnézet</h2>
            <p className="text-sm text-muted-foreground mb-3">
              Az aktuális verzió megtekinthető:
            </p>
            <a
              href={project.staging_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
            >
              Megnyitás <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </section>
        )}

        {invoices.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-base font-semibold mb-3">Számlák</h2>
            <ul className="divide-y divide-border">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <div className="font-medium capitalize">{inv.type.replace("_", " ")}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {inv.due_at ? `Fizetési határidő ${formatDateHu(inv.due_at)}` : "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium tabular-nums">{formatHuf(inv.amount_huf)}</span>
                    <span
                      className={`text-[10px] uppercase tracking-wide font-bold rounded-md px-2 py-0.5 ${
                        inv.status === "paid"
                          ? "bg-compass-green/10 text-compass-green"
                          : inv.status === "overdue"
                            ? "bg-compass-red/10 text-compass-red"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {inv.status === "paid" ? "Kifizetve" : inv.status === "overdue" ? "Lejárt" : "Esedékes"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-center text-xs text-muted-foreground py-4">
          Compass Marketing Kft. · {new Date().getFullYear()}
        </p>
      </main>
    </div>
  );
}
