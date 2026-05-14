import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import { inngest } from "@/lib/inngest/client";
import { computeBaseScore } from "@/lib/ai/scoring/win-probability";

export const runtime = "nodejs";

const InboundLead = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  phone: z.string().min(3).max(40),
  website_url: z.string().url().max(500).optional().or(z.literal("")),
  no_website: z.boolean().optional(),
  company_name: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

function secretsMatch(received: string, expected: string): boolean {
  if (received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

function deriveCompanyName(input: {
  company_name?: string;
  website_url?: string;
  name: string;
}): string {
  if (input.company_name && input.company_name.trim()) {
    return input.company_name.trim();
  }
  if (input.website_url) {
    try {
      const host = new URL(input.website_url).hostname.replace(/^www\./, "");
      const base = host.split(".")[0];
      if (base) return base.charAt(0).toUpperCase() + base.slice(1);
    } catch {
      // fall through
    }
  }
  return input.name.trim();
}

export async function POST(req: Request) {
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected) {
    console.error("inbound leads: WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const received = req.headers.get("x-webhook-secret") ?? "";
  if (!received || !secretsMatch(received, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = InboundLead.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const websiteUrl = input.website_url || null;
  const hasExistingWebsite = input.no_website === true ? false : Boolean(websiteUrl);
  const companyName = deriveCompanyName({
    company_name: input.company_name,
    website_url: websiteUrl ?? undefined,
    name: input.name,
  });

  const base = computeBaseScore({
    lead: {
      budget_confirmed: false,
      decision_maker_confirmed: false,
      has_existing_website: hasExistingWebsite,
      timeline_weeks: null,
      package_interest: null,
      source: "inbound_form",
      niche: null,
    },
  });

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      demo: true,
      base_score: base.total,
      message: "Supabase not configured — lead not persisted.",
    });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      company_name: companyName,
      contact_name: input.name,
      email: input.email,
      phone: input.phone,
      website_url: websiteUrl,
      source: "inbound_form",
      has_existing_website: hasExistingWebsite,
      internal_notes: input.notes ?? null,
      win_probability: base.total,
      win_probability_reasons: base.signals.map((s) => s.label),
      enrichment_status: websiteUrl ? "running" : "failed",
      enrichment_summary: websiteUrl ? null : "Client has no website yet.",
    })
    .select("id, website_url")
    .single();

  if (error) {
    console.error("inbound lead insert failed", error);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }

  if (process.env.INNGEST_EVENT_KEY) {
    void inngest.send({
      name: "lead/created",
      data: { lead_id: data.id, website_url: data.website_url },
    });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
