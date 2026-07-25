import {
  getProspectingStats,
  getScrapingJobs,
  getLeads,
  getSourceEffectiveness,
} from "@/lib/data/queries";
import { Stat } from "@/components/shared/Stat";
import { ScrapeLauncher } from "@/components/prospecting/ScrapeLauncher";
import { BatchLauncher } from "@/components/prospecting/BatchLauncher";
import { ScrapingJobsList } from "@/components/prospecting/ScrapingJobsList";
import { SourceEffectiveness } from "@/components/prospecting/SourceEffectiveness";
import { Target, Flame, Calendar, DollarSign } from "lucide-react";
import { PROSPECTING_NICHE_LABELS } from "@/lib/types/app.types";
import { LeadScoreBadge } from "@/components/leads/LeadScoreBadge";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProspectingPage() {
  const [stats, jobs, allLeads, effectiveness] = await Promise.all([
    getProspectingStats(),
    getScrapingJobs({ limit: 30 }),
    getLeads({ limit: 500 }),
    getSourceEffectiveness(),
  ]);

  // Top finds: cold-sourced leads with high scores that haven't been contacted
  const topFinds = allLeads
    .filter(
      (l) =>
        l.source === "cold_outreach" &&
        !l.first_contact_at &&
        (l.win_probability ?? 0) >= 70,
    )
    .slice(0, 8);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lead vadászat</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Google Maps-ról szkennelünk magyar vállalkozásokat. Az új leadek
          automatikusan a Leads listára kerülnek, magas pontszámmal a tetején.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Hideg lead összesen"
          value={stats.total_leads.toLocaleString("hu-HU")}
          icon={Target}
          hint="forrás: cold_outreach"
        />
        <Stat
          label="Top tier (≥70)"
          value={stats.top_tier_count.toLocaleString("hu-HU")}
          icon={Flame}
          tone="positive"
          hint="kontaktra érdemes"
        />
        <Stat
          label="Vadászat ezen a héten"
          value={stats.jobs_this_week}
          icon={Calendar}
        />
        <Stat
          label="Becsült költés / hó"
          value={`$${stats.estimated_spend_this_month_usd.toFixed(2)}`}
          icon={DollarSign}
          hint="Apify scrape becslés"
        />
      </div>

      {/* Batch launcher — verticals × cities in one click */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Batch indítás
        </h2>
        <BatchLauncher />
      </section>

      {/* Launcher cards */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Vadászat indítása (egyesével)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {(Object.keys(PROSPECTING_NICHE_LABELS) as Array<keyof typeof PROSPECTING_NICHE_LABELS>).map(
            (n) => (
              <ScrapeLauncher key={n} niche={n} />
            ),
          )}
        </div>
      </section>

      {/* Top finds — what to act on now */}
      {topFinds.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Legjobb találatok — kontaktálandó
            </h2>
            <Link
              href="/leads"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              Összes lead
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {topFinds.map((l) => (
              <Link
                key={l.id}
                href={`/leads/${l.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-accent/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{l.company_name}</span>
                    {l.niche && (
                      <span className="text-xs text-muted-foreground">
                        · {l.niche}
                      </span>
                    )}
                    {l.gmaps_city && (
                      <span className="text-xs text-muted-foreground">
                        · {l.gmaps_city}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {l.website_health_status === "no_website"
                      ? "Nincs weboldal"
                      : l.website_health_status === "broken"
                        ? "Hibás weboldal"
                        : l.website_health_status === "redirect_social"
                          ? "Csak social"
                          : l.gmaps_category}
                    {l.gmaps_rating != null &&
                      ` · ${l.gmaps_rating.toFixed(1)}★ (${l.gmaps_review_count ?? 0})`}
                  </div>
                </div>
                <div className="ml-3 flex items-center gap-2">
                  <LeadScoreBadge score={l.win_probability ?? 0} />
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Source effectiveness: which combinations actually convert */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Forrás hatékonyság
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Mely niche × város kombinációkból lett tényleges kontakt, minősített lead, vagy nyert üzlet.
          </p>
        </div>
        <SourceEffectiveness rows={effectiveness} />
      </section>

      {/* Jobs history */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Vadászat előzmények
        </h2>
        <ScrapingJobsList jobs={jobs} />
      </section>
    </div>
  );
}
