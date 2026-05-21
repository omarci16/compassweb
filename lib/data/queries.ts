// Server-side data access — talks to Supabase when configured, otherwise
// falls back to the in-memory demo dataset so the UI is always previewable.

import { createClient } from "@/lib/supabase/server";
import type {
  DailyBriefing,
  DailyBriefingItem,
  Deal,
  EmailLog,
  Invoice,
  Lead,
  LeadStatus,
  Project,
  ScrapingJob,
} from "@/lib/types/app.types";
import {
  demoDeals,
  demoEmailLog,
  demoInvoices,
  demoLeads,
  demoProjects,
} from "./demo";
import { differenceInDays } from "date-fns";

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export async function getLeads(opts?: {
  status?: LeadStatus | "active";
  limit?: number;
}): Promise<Lead[]> {
  if (!isSupabaseConfigured()) {
    let leads = [...demoLeads];
    if (opts?.status === "active") {
      leads = leads.filter(
        (l) => !["lost", "archived", "won"].includes(l.status),
      );
    } else if (opts?.status) {
      leads = leads.filter((l) => l.status === opts.status);
    }
    leads.sort(
      (a, b) =>
        (b.win_probability ?? 0) - (a.win_probability ?? 0) ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return leads.slice(0, opts?.limit ?? 100);
  }

  const supabase = createClient();
  let query = supabase
    .from("leads")
    .select("*")
    .order("win_probability", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (opts?.status === "active") {
    query = query.not("status", "in", "(lost,archived,won)");
  } else if (opts?.status) {
    query = query.eq("status", opts.status);
  }
  if (opts?.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) {
    console.error("getLeads error", error);
    return [];
  }
  return (data ?? []) as unknown as Lead[];
}

export async function getLeadById(id: string): Promise<Lead | null> {
  if (!isSupabaseConfigured()) {
    return demoLeads.find((l) => l.id === id) ?? null;
  }
  const supabase = createClient();
  const { data } = await supabase.from("leads").select("*").eq("id", id).single();
  return (data as unknown as Lead) ?? null;
}

export async function getDeals(): Promise<Deal[]> {
  if (!isSupabaseConfigured()) return [...demoDeals];
  const supabase = createClient();
  const { data } = await supabase
    .from("deals")
    .select("*")
    .order("urgency_score", { ascending: false, nullsFirst: false });
  return (data ?? []) as unknown as Deal[];
}

function addDaysInStage<T extends { stage_entered_at: string }>(row: T): T & { days_in_current_stage: number } {
  const days = Math.floor((Date.now() - new Date(row.stage_entered_at).getTime()) / 86_400_000);
  return { ...row, days_in_current_stage: days };
}

export async function getProjects(opts?: { activeOnly?: boolean }): Promise<Project[]> {
  if (!isSupabaseConfigured()) {
    let projects = [...demoProjects];
    if (opts?.activeOnly) projects = projects.filter((p) => p.current_stage < 7);
    projects.sort((a, b) => b.urgency_score - a.urgency_score);
    return projects;
  }
  const supabase = createClient();
  let query = supabase
    .from("projects")
    .select("*")
    .order("urgency_score", { ascending: false });
  if (opts?.activeOnly) query = query.lt("current_stage", 7);
  const { data } = await query;
  return ((data ?? []) as unknown as Project[]).map(addDaysInStage);
}

export async function getProjectById(id: string): Promise<Project | null> {
  if (!isSupabaseConfigured()) {
    return demoProjects.find((p) => p.id === id) ?? null;
  }
  const supabase = createClient();
  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  return data ? addDaysInStage(data as unknown as Project) : null;
}

export async function getProjectByPortalToken(token: string): Promise<Project | null> {
  if (!isSupabaseConfigured()) {
    return demoProjects.find((p) => p.portal_token === token) ?? null;
  }
  const supabase = createClient();
  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("portal_token", token)
    .single();
  return (data as unknown as Project) ?? null;
}

export async function getInvoices(opts?: { projectId?: string }): Promise<Invoice[]> {
  if (!isSupabaseConfigured()) {
    let invoices = [...demoInvoices];
    if (opts?.projectId) invoices = invoices.filter((i) => i.project_id === opts.projectId);
    return invoices.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }
  const supabase = createClient();
  let query = supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });
  if (opts?.projectId) query = query.eq("project_id", opts.projectId);
  const { data } = await query;
  return (data ?? []) as unknown as Invoice[];
}

export interface RevenueMetrics {
  mrr_current: number;
  mrr_projected: number;
  one_time_this_month: number;
  outstanding: number;
  overdue: number;
  retainer_clients: number;
}

export async function getRevenueMetrics(): Promise<RevenueMetrics> {
  const projects = await getProjects();
  const invoices = await getInvoices();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const mrr_current = projects
    .filter((p) => p.current_stage === 7)
    .reduce((s, p) => s + p.monthly_fee_huf, 0);

  const mrr_projected =
    mrr_current +
    projects
      .filter((p) => p.current_stage >= 5 && p.current_stage < 7)
      .reduce((s, p) => s + p.monthly_fee_huf, 0);

  const one_time_this_month = invoices
    .filter(
      (i) =>
        (i.type === "deposit" || i.type === "final") &&
        i.issued_at &&
        new Date(i.issued_at) >= monthStart,
    )
    .reduce((s, i) => s + i.amount_huf, 0);

  const outstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + i.amount_huf, 0);

  const overdue = invoices
    .filter((i) => i.status === "overdue")
    .reduce((s, i) => s + i.amount_huf, 0);

  const retainer_clients = projects.filter((p) => p.current_stage === 7).length;

  return { mrr_current, mrr_projected, one_time_this_month, outstanding, overdue, retainer_clients };
}

// ---------------------------------------------------------------------
// Prospecting — scraping jobs + cold lead surfacing
// ---------------------------------------------------------------------

export interface SourceEffectivenessRow {
  job_id: string;
  niche: string;
  city: string;
  created_at: string;
  total_imported: number;
  total_contacted: number;     // first_contact_at IS NOT NULL
  total_qualified: number;     // status moved past 'new'/'enriching'
  total_won: number;           // status = 'won'
  contact_rate: number;        // 0–1
  qualification_rate: number;
  win_rate: number;
}

/**
 * Source effectiveness: per scraping_job, how did the leads actually perform?
 * Lets us learn which niche × city × search-term combos convert.
 */
export async function getSourceEffectiveness(): Promise<SourceEffectivenessRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = createClient();

  // Pull jobs + their leads. We do this in two queries (rather than a SQL view)
  // to keep the schema simple. For a two-person ops tool, the volume is fine.
  const { data: jobs } = await supabase
    .from("scraping_jobs")
    .select("id, niche, city, created_at, total_imported")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!jobs || jobs.length === 0) return [];

  const jobIds = jobs.map((j) => j.id);
  const { data: leadsForJobs } = await supabase
    .from("leads")
    .select("scraping_job_id, status, first_contact_at")
    .in("scraping_job_id", jobIds);

  const byJob = new Map<string, { contacted: number; qualified: number; won: number }>();
  for (const l of (leadsForJobs ?? []) as {
    scraping_job_id: string | null;
    status: string;
    first_contact_at: string | null;
  }[]) {
    if (!l.scraping_job_id) continue;
    const b = byJob.get(l.scraping_job_id) ?? { contacted: 0, qualified: 0, won: 0 };
    if (l.first_contact_at) b.contacted += 1;
    if (!["new", "enriching"].includes(l.status)) b.qualified += 1;
    if (l.status === "won") b.won += 1;
    byJob.set(l.scraping_job_id, b);
  }

  return jobs.map((j) => {
    const counts = byJob.get(j.id) ?? { contacted: 0, qualified: 0, won: 0 };
    const imported = j.total_imported ?? 0;
    return {
      job_id: j.id,
      niche: j.niche,
      city: j.city,
      created_at: j.created_at,
      total_imported: imported,
      total_contacted: counts.contacted,
      total_qualified: counts.qualified,
      total_won: counts.won,
      contact_rate: imported > 0 ? counts.contacted / imported : 0,
      qualification_rate: imported > 0 ? counts.qualified / imported : 0,
      win_rate: imported > 0 ? counts.won / imported : 0,
    };
  });
}

export async function getScrapingJobs(opts?: { limit?: number }): Promise<ScrapingJob[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scraping_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 30);
  if (error) {
    console.error("getScrapingJobs error", error);
    return [];
  }
  return (data ?? []) as unknown as ScrapingJob[];
}

export interface ProspectingStats {
  total_leads: number;
  top_tier_count: number;
  jobs_this_week: number;
  estimated_spend_this_month_usd: number;
}

export async function getProspectingStats(): Promise<ProspectingStats> {
  if (!isSupabaseConfigured()) {
    return {
      total_leads: 0,
      top_tier_count: 0,
      jobs_this_week: 0,
      estimated_spend_this_month_usd: 0,
    };
  }
  const supabase = createClient();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [coldLeads, topTier, recentJobs, monthJobs] = await Promise.all([
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("source", "cold_outreach"),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("source", "cold_outreach")
      .gte("win_probability", 70),
    supabase
      .from("scraping_jobs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekAgo),
    supabase
      .from("scraping_jobs")
      .select("estimated_cost_usd")
      .gte("created_at", monthStart.toISOString()),
  ]);

  const estimated_spend =
    (monthJobs.data ?? []).reduce(
      (s, j) => s + Number((j as { estimated_cost_usd: number | null }).estimated_cost_usd ?? 0),
      0,
    );

  return {
    total_leads: coldLeads.count ?? 0,
    top_tier_count: topTier.count ?? 0,
    jobs_this_week: recentJobs.count ?? 0,
    estimated_spend_this_month_usd: Number(estimated_spend.toFixed(2)),
  };
}

// ---------------------------------------------------------------------
// Email log — for the Outreach page
// ---------------------------------------------------------------------

export async function getEmailLog(opts?: {
  direction?: "inbound" | "outbound";
  limit?: number;
  projectId?: string;
  leadId?: string;
  dealId?: string;
}): Promise<EmailLog[]> {
  if (!isSupabaseConfigured()) {
    let log = [...demoEmailLog];
    if (opts?.direction) log = log.filter((e) => e.direction === opts.direction);
    if (opts?.projectId) log = log.filter((e) => e.project_id === opts.projectId);
    if (opts?.leadId) log = log.filter((e) => e.lead_id === opts.leadId);
    if (opts?.dealId) log = log.filter((e) => e.deal_id === opts.dealId);
    log.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return log.slice(0, opts?.limit ?? 100);
  }
  const supabase = createClient();
  let query = supabase.from("email_log").select("*").order("created_at", { ascending: false });
  if (opts?.direction) query = query.eq("direction", opts.direction);
  if (opts?.projectId) query = query.eq("project_id", opts.projectId);
  if (opts?.leadId) query = query.eq("lead_id", opts.leadId);
  if (opts?.dealId) query = query.eq("deal_id", opts.dealId);
  if (opts?.limit) query = query.limit(opts.limit);
  const { data } = await query;
  return (data ?? []) as unknown as EmailLog[];
}

// ---------------------------------------------------------------------
// Insights / analytics for the Intelligence page
// ---------------------------------------------------------------------

export interface Insights {
  win_rate_overall: number;
  win_rate_by_niche: { niche: string; rate: number; volume: number }[];
  win_rate_by_source: { source: string; rate: number; volume: number }[];
  loss_reasons: { name: string; value: number }[];
  cycle_trend: { month: string; days: number }[];
  speed_to_lead_median_min: number;
  wins_this_month: number;
  closed_this_month: number;
}

const HU_MONTHS = ["Jan", "Feb", "Már", "Ápr", "Máj", "Jún", "Júl", "Aug", "Sze", "Okt", "Nov", "Dec"];

export async function getInsights(): Promise<Insights> {
  const leads = await getLeads({ limit: 1000 });

  const closed = leads.filter((l) => l.status === "won" || l.status === "lost");
  const wins = closed.filter((l) => l.status === "won");
  const win_rate_overall = closed.length === 0 ? 0 : Math.round((wins.length / closed.length) * 100);

  const groupRate = <K extends string>(getKey: (l: Lead) => K | null) => {
    const buckets = new Map<K, { wins: number; total: number }>();
    for (const l of closed) {
      const k = getKey(l);
      if (!k) continue;
      const b = buckets.get(k) ?? { wins: 0, total: 0 };
      b.total += 1;
      if (l.status === "won") b.wins += 1;
      buckets.set(k, b);
    }
    return Array.from(buckets.entries())
      .map(([k, b]) => ({ key: k, rate: b.total === 0 ? 0 : Math.round((b.wins / b.total) * 100), volume: b.total }))
      .sort((a, b) => b.rate - a.rate);
  };

  const win_rate_by_niche = groupRate((l) => l.niche).map(({ key, rate, volume }) => ({ niche: key, rate, volume }));
  const win_rate_by_source = groupRate((l) => l.source).map(({ key, rate, volume }) => ({ source: key, rate, volume }));

  const lossCounts = new Map<string, number>();
  for (const l of leads.filter((x) => x.status === "lost" && x.loss_reason)) {
    const k = l.loss_reason!;
    lossCounts.set(k, (lossCounts.get(k) ?? 0) + 1);
  }
  const loss_reasons = Array.from(lossCounts.entries())
    .map(([name, value]) => ({ name: name.replace("_", " "), value }))
    .sort((a, b) => b.value - a.value);

  // Cycle trend: average days from created_at → updated_at for wins, bucketed by month of close
  const cycleByMonth = new Map<string, { sum: number; count: number; sortKey: number }>();
  for (const l of wins) {
    const closedAt = new Date(l.updated_at);
    const days = Math.max(1, differenceInDays(closedAt, new Date(l.created_at)));
    const monthIdx = closedAt.getMonth();
    const yearMonth = `${closedAt.getFullYear()}-${monthIdx}`;
    const label = HU_MONTHS[monthIdx];
    const cur = cycleByMonth.get(yearMonth) ?? { sum: 0, count: 0, sortKey: closedAt.getFullYear() * 12 + monthIdx };
    cur.sum += days;
    cur.count += 1;
    cycleByMonth.set(yearMonth, cur);
    // Stash label
    (cur as { label?: string }).label = label;
  }
  const cycle_trend = Array.from(cycleByMonth.values())
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(-6)
    .map((b) => ({ month: (b as { label?: string }).label ?? "?", days: Math.round(b.sum / b.count) }));

  const speedSamples = leads
    .map((l) => l.speed_to_lead_minutes)
    .filter((m): m is number => typeof m === "number")
    .sort((a, b) => a - b);
  const speed_to_lead_median_min = speedSamples.length === 0
    ? 0
    : speedSamples[Math.floor(speedSamples.length / 2)];

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const closedThisMonth = closed.filter((l) => new Date(l.updated_at) >= monthStart);

  return {
    win_rate_overall,
    win_rate_by_niche,
    win_rate_by_source,
    loss_reasons,
    cycle_trend,
    speed_to_lead_median_min,
    wins_this_month: closedThisMonth.filter((l) => l.status === "won").length,
    closed_this_month: closedThisMonth.length,
  };
}

// ---------------------------------------------------------------------
// Daily briefing — deterministic compute from current operational state.
// (The AI prompt in lib/ai/prompts/daily-briefing.ts is reserved for a
// future morning-cron version; this synchronous variant is what renders
// at every page load.)
// ---------------------------------------------------------------------

export async function computeBriefing(firstName = "Richárd"): Promise<DailyBriefing> {
  const [leads, projects, invoices] = await Promise.all([
    getLeads({ limit: 200 }),
    getProjects({ activeOnly: true }),
    getInvoices(),
  ]);

  const now = Date.now();
  const items: DailyBriefingItem[] = [];

  // 1. Urgent projects: revision deadline past, or stuck >7d on us
  const revisionPastDue = projects.filter(
    (p) =>
      p.current_stage === 5 &&
      p.revision_deadline &&
      new Date(p.revision_deadline).getTime() < now &&
      !p.revision_received_at,
  );
  for (const p of revisionPastDue.slice(0, 2)) {
    items.push({
      severity: "urgent",
      title: `${p.client_name} — revízió határidő lejárt`,
      detail: "5 munkanap eltelt, automatikus jóváhagyás aktiválható.",
      href: `/projects/${p.id}`,
    });
  }

  // 2. Overdue invoices
  const overdue = invoices.filter((i) => i.status === "overdue");
  for (const inv of overdue.slice(0, 2)) {
    const project = projects.find((p) => p.id === inv.project_id);
    const daysOver = inv.due_at ? differenceInDays(new Date(), new Date(inv.due_at)) : 0;
    items.push({
      severity: "urgent",
      title: `${project?.client_name ?? "Számla"} — ${inv.type === "final" ? "végszámla" : inv.type} ${daysOver}d késésben`,
      detail: `Kintlevőség, chaser email javasolt.`,
      href: project ? `/projects/${project.id}` : "/revenue",
    });
  }

  // 3. Uncontacted high-score leads
  const uncontactedHot = leads.filter(
    (l) =>
      l.status === "new" &&
      !l.first_contact_at &&
      (l.win_probability ?? 0) >= 70,
  );
  if (uncontactedHot.length > 0) {
    items.push({
      severity: "action",
      title: `${uncontactedHot.length} új lead 70+ score-ral, egyik sem kontaktálva`,
      detail: uncontactedHot.slice(0, 3).map((l) => l.company_name).join(", "),
      href: "/leads",
    });
  }

  // 4. Materials deadline approaching (projects in stage 3, deadline ≤ 2 days, no materials)
  const materialsApproaching = projects.filter(
    (p) =>
      p.current_stage === 3 &&
      p.materials_deadline &&
      !p.materials_received_at &&
      differenceInDays(new Date(p.materials_deadline), new Date()) <= 2,
  );
  for (const p of materialsApproaching.slice(0, 2)) {
    const daysLeft = differenceInDays(new Date(p.materials_deadline!), new Date());
    items.push({
      severity: "action",
      title: `${p.client_name} — anyaghatáridő ${daysLeft <= 0 ? "ma" : `${daysLeft} nap múlva`}`,
      detail: p.blocker ?? "Anyagok még nem érkeztek meg, chaser email javasolt.",
      href: `/projects/${p.id}`,
    });
  }

  // 5. Stuck on us > 7 days
  const stuckOnUs = projects.filter(
    (p) => p.waiting_on === "us" && p.days_in_current_stage >= 7,
  );
  for (const p of stuckOnUs.slice(0, 2)) {
    items.push({
      severity: "action",
      title: `${p.client_name} — ${p.days_in_current_stage}d a jelenlegi szakaszban`,
      detail: "Mi vagyunk a blokk. Lépni kell.",
      href: `/projects/${p.id}`,
    });
  }

  // 6. ok signal
  const onTrack = projects.filter(
    (p) => p.urgency_score < 50 && !p.blocker,
  );
  if (onTrack.length > 0 && items.length < 6) {
    items.push({
      severity: "ok",
      title: `${onTrack.length} projekt rendben halad`,
      detail: "Nincs blokkoló, alacsony sürgősség.",
    });
  }

  // Sort by severity, cap to 6
  const sevRank: Record<DailyBriefingItem["severity"], number> = { urgent: 0, action: 1, info: 2, ok: 3 };
  items.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);
  const top = items.slice(0, 6);

  // Suggested first action: top urgent → top action
  const first = top.find((i) => i.href);
  return {
    generated_at: new Date().toISOString(),
    greeting: `Jó reggelt, ${firstName}.`,
    items: top.length > 0 ? top : [{
      severity: "ok",
      title: "Minden rendben",
      detail: "Nincs sürgős teendő ma reggel.",
    }],
    suggested_first_action: first ? { label: `Open ${first.title.split("—")[0].trim()}`, href: first.href! } : null,
  };
}
