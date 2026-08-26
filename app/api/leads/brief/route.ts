import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import { inngest } from "@/lib/inngest/client";
import { computeBaseScore } from "@/lib/ai/scoring/win-probability";

export const runtime = "nodejs";

/*
 * Public intake for the marketing site's contact brief (public/contact.html).
 *
 * Deliberately NOT /api/leads/inbound: that route is authenticated with a
 * shared secret for server-to-server callers, and this one is called from the
 * browser, where no secret can be kept. Instead it is same-origin only and
 * relies on an origin check, a honeypot and a per-IP rate limit. Keep the two
 * separate — widening the inbound route to allow unauthenticated calls would
 * expose the integration endpoint too.
 */

const Brief = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  phone: z.string().max(40).optional().default(""),
  company: z.string().max(200).optional().default(""),
  message: z.string().max(4000).optional().default(""),
  bottleneck: z.array(z.string().max(120)).max(20).optional().default([]),
  response_speed: z.string().max(120).optional().default(""),
  tools: z.array(z.string().max(120)).max(20).optional().default([]),
  budget: z.string().max(120).optional().default(""),
  lang: z.enum(["hu", "en"]).optional().default("hu"),
  // Honeypot: a field hidden from humans in CSS. Bots fill everything in.
  website: z.string().max(200).optional().default(""),
});

const ALLOWED_HOSTS = [
  "compassaisystems.hu",
  "www.compassaisystems.hu",
  "compassaisystems.com",
  "www.compassaisystems.com",
];

function originAllowed(req: Request): boolean {
  // Same-origin form posts always carry one of these.
  const raw = req.headers.get("origin") ?? req.headers.get("referer");
  if (!raw) return false;
  let host: string;
  try {
    host = new URL(raw).hostname;
  } catch {
    return false;
  }
  if (ALLOWED_HOSTS.includes(host)) return true;
  // Local development and Vercel preview deployments.
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host.endsWith(".vercel.app")) return true;
  return false;
}

/*
 * Per-IP rate limit. In-memory, so it is per serverless instance rather than
 * global — enough to stop a naive flood from a single client, not a real
 * distributed defence. The brief is five screens of typing; nobody legitimate
 * submits it more than a few times an hour.
 */
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear(); // crude ceiling; avoids unbounded growth
  return recent.length > RATE_LIMIT;
}

// Mailbox providers tell us nothing about the prospect's own site.
const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "freemail.hu", "citromail.hu", "indamail.hu",
  "hotmail.com", "outlook.com", "outlook.hu", "live.com", "yahoo.com",
  "yahoo.co.uk", "icloud.com", "me.com", "proton.me", "protonmail.com",
  "vipmail.hu", "t-online.hu", "invitel.hu", "upcmail.hu",
]);

/*
 * The brief never asks for a website — one more field would cost completions.
 * A business email domain is usually the site anyway, so derive it and let the
 * existing enrichment pipeline confirm or fail. Free-mail domains yield null.
 */
function deriveWebsite(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain || FREE_MAIL.has(domain)) return null;
  return `https://${domain}`;
}

function deriveCompanyName(company: string, email: string, name: string): string {
  if (company.trim()) return company.trim();
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (domain && !FREE_MAIL.has(domain)) {
    const base = domain.split(".")[0];
    if (base) return base.charAt(0).toUpperCase() + base.slice(1);
  }
  return name.trim();
}

export async function POST(req: Request) {
  if (!originAllowed(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = Brief.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Honeypot tripped — accept so the bot does not retry, but persist nothing.
  if (input.website.trim()) {
    return NextResponse.json({ ok: true });
  }

  const websiteUrl = deriveWebsite(input.email);
  const companyName = deriveCompanyName(input.company, input.email, input.name);

  const base = computeBaseScore({
    lead: {
      // A stated budget band is the prospect qualifying themselves.
      budget_confirmed: Boolean(input.budget.trim()),
      decision_maker_confirmed: false,
      has_existing_website: Boolean(websiteUrl),
      timeline_weeks: null,
      package_interest: null,
      source: "contact_brief",
      niche: null,
    },
  });

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, demo: true });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      company_name: companyName,
      contact_name: input.name,
      email: input.email,
      phone: input.phone || null,
      website_url: websiteUrl,
      source: "contact_brief",
      has_existing_website: Boolean(websiteUrl),
      internal_notes: input.message || null,
      brief: {
        bottleneck: input.bottleneck,
        response_speed: input.response_speed,
        tools: input.tools,
        budget: input.budget,
        message: input.message,
        lang: input.lang,
      },
      budget_confirmed: Boolean(input.budget.trim()),
      win_probability: base.total,
      win_probability_reasons: base.signals.map((s) => s.label),
      enrichment_status: websiteUrl ? "running" : "failed",
      enrichment_summary: websiteUrl
        ? null
        : "Brief submitted from a free-mail address — no website to enrich.",
    })
    .select("id, website_url")
    .single();

  if (error) {
    console.error("contact brief insert failed", error);
    return NextResponse.json({ error: "Failed to save brief" }, { status: 500 });
  }

  if (websiteUrl && process.env.INNGEST_EVENT_KEY) {
    void inngest.send({
      name: "lead/created",
      data: { lead_id: data.id, website_url: data.website_url },
    });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
