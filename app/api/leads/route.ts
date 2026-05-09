import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import { inngest } from "@/lib/inngest/client";
import {
  computeBaseScore,
} from "@/lib/ai/scoring/win-probability";

const LeadInput = z.object({
  company_name: z.string().min(1),
  contact_name: z.string().nullish(),
  email: z.string().email().nullish().or(z.literal("")),
  phone: z.string().nullish(),
  website_url: z.string().url().nullish().or(z.literal("")),
  source: z.enum(["instagram_dm", "referral", "cold_outreach", "inbound_form", "other"]),
  niche: z.string().nullish(),
  package_interest: z.enum(["landing", "business", "ecommerce"]).nullish().or(z.literal("")),
  budget_confirmed: z.boolean().default(false),
  decision_maker_confirmed: z.boolean().default(false),
  has_existing_website: z.boolean().nullish(),
  timeline_weeks: z.number().int().positive().nullish(),
  internal_notes: z.string().nullish(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = LeadInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const cleanWebsite = input.website_url || null;
  const cleanPackage = input.package_interest || null;

  // Compute deterministic base score immediately
  const base = computeBaseScore({
    lead: {
      budget_confirmed: input.budget_confirmed,
      decision_maker_confirmed: input.decision_maker_confirmed,
      has_existing_website: input.has_existing_website ?? false,
      timeline_weeks: input.timeline_weeks ?? null,
      package_interest: cleanPackage,
      source: input.source,
      niche: input.niche ?? null,
    },
  });

  if (!isSupabaseConfigured()) {
    // Without a DB we can still return success for demo previews.
    return NextResponse.json({
      ok: true,
      demo: true,
      base_score: base.total,
      message:
        "Supabase not configured — demo mode. Set NEXT_PUBLIC_SUPABASE_URL to persist.",
    });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      ...input,
      website_url: cleanWebsite,
      package_interest: cleanPackage,
      win_probability: base.total,
      win_probability_reasons: base.signals.map((s) => s.label),
      enrichment_status: cleanWebsite ? "running" : "failed",
      enrichment_summary: cleanWebsite ? null : "No website URL provided.",
    })
    .select("id, website_url")
    .single();

  if (error) {
    console.error("create lead error", error);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }

  // Fire-and-forget: trigger enrichment + downstream scoring
  if (process.env.INNGEST_EVENT_KEY) {
    void inngest.send({
      name: "lead/created",
      data: { lead_id: data.id, website_url: data.website_url },
    });
  }

  return NextResponse.json({ ok: true, id: data.id, base_score: base.total });
}

export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ leads: [] });
  const supabase = createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("win_probability", { ascending: false, nullsFirst: false })
    .limit(200);
  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });
  return NextResponse.json({ leads: data });
}
