// Server-side data access — talks to Supabase when configured, otherwise
// falls back to the in-memory demo dataset so the UI is always previewable.

import { createClient } from "@/lib/supabase/server";
import type {
  Deal,
  Invoice,
  Lead,
  LeadStatus,
  Project,
} from "@/lib/types/app.types";
import {
  demoDeals,
  demoInvoices,
  demoLeads,
  demoProjects,
} from "./demo";

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
