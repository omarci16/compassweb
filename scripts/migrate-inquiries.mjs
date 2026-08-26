#!/usr/bin/env node
/*
 * One-time migration: website `inquiries` → ERP `leads`.
 *
 * The marketing site and the ERP are two separate Supabase projects, so this
 * reads from one and writes to the other. Run it once, after applying
 * supabase/migrations/0015_website_brief.sql to the ERP project.
 *
 *   WEBSITE_SUPABASE_URL=https://xxx.supabase.co \
 *   WEBSITE_SERVICE_KEY=eyJ... \
 *   ERP_SUPABASE_URL=https://yyy.supabase.co \
 *   ERP_SERVICE_KEY=eyJ... \
 *   node scripts/migrate-inquiries.mjs            # dry run, prints a plan
 *
 * Add --commit to actually write. Re-running is safe: existing contact_brief
 * leads are matched on email + created_at and skipped.
 *
 * Service-role keys are required on both sides — RLS blocks anon from reading
 * inquiries at all. Do not commit them; pass them on the command line.
 */
import { createClient } from "@supabase/supabase-js";

const COMMIT = process.argv.includes("--commit");

const need = (name) => {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
  return v;
};

const site = createClient(need("WEBSITE_SUPABASE_URL"), need("WEBSITE_SERVICE_KEY"), {
  auth: { persistSession: false },
});
const erp = createClient(need("ERP_SUPABASE_URL"), need("ERP_SERVICE_KEY"), {
  auth: { persistSession: false },
});

const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "freemail.hu", "citromail.hu", "indamail.hu",
  "hotmail.com", "outlook.com", "outlook.hu", "live.com", "yahoo.com",
  "icloud.com", "me.com", "proton.me", "protonmail.com", "vipmail.hu",
  "t-online.hu", "invitel.hu", "upcmail.hu",
]);

function domainOf(email) {
  return (email || "").split("@")[1]?.toLowerCase().trim() || "";
}

function companyName(inq) {
  if (inq.company?.trim()) return inq.company.trim();
  const d = domainOf(inq.email);
  if (d && !FREE_MAIL.has(d)) {
    const base = d.split(".")[0];
    if (base) return base.charAt(0).toUpperCase() + base.slice(1);
  }
  return inq.name?.trim() || inq.email || "Ismeretlen";
}

// Mapped onto LeadStatus (lib/types/app.types.ts). `replied` has no exact
// equivalent — `qualified` is the closest honest reading: we engaged, but the
// deal had not moved to a proposal. `archived` inquiries were closed out.
const STATUS_MAP = { new: "new", read: "new", replied: "qualified", archived: "archived" };

const { data: inquiries, error } = await site
  .from("inquiries")
  .select("*")
  .order("created_at", { ascending: true });

if (error) {
  console.error("Could not read inquiries:", error.message);
  process.exit(1);
}
if (!inquiries?.length) {
  console.log("No inquiries to migrate.");
  process.exit(0);
}

const { data: existing } = await erp
  .from("leads")
  .select("email, created_at")
  .eq("source", "contact_brief");
const seen = new Set((existing ?? []).map((l) => `${l.email}|${l.created_at}`));

const rows = [];
let skipped = 0;

for (const inq of inquiries) {
  if (seen.has(`${inq.email}|${inq.created_at}`)) {
    skipped++;
    continue;
  }
  const d = domainOf(inq.email);
  const website = d && !FREE_MAIL.has(d) ? `https://${d}` : null;
  rows.push({
    created_at: inq.created_at,
    company_name: companyName(inq),
    contact_name: inq.name || null,
    email: inq.email || null,
    phone: inq.phone || null,
    website_url: website,
    source: "contact_brief",
    has_existing_website: Boolean(website),
    status: STATUS_MAP[inq.status] ?? "new",
    internal_notes: inq.message || null,
    budget_confirmed: Boolean(inq.budget),
    brief: {
      bottleneck: inq.bottleneck ?? [],
      response_speed: inq.response_speed ?? "",
      tools: inq.tools ?? [],
      budget: inq.budget ?? "",
      message: inq.message ?? "",
      lang: inq.lang ?? "hu",
    },
    // Historical rows: no point running enrichment or scoring on them now.
    enrichment_status: "failed",
    enrichment_summary: "Migrated from the website inquiries table.",
  });
}

console.log(`inquiries read:  ${inquiries.length}`);
console.log(`already in ERP:  ${skipped}`);
console.log(`to insert:       ${rows.length}`);

if (!rows.length) process.exit(0);

if (!COMMIT) {
  console.log("\n--- dry run, nothing written. Sample: ---");
  console.log(JSON.stringify(rows.slice(0, 3), null, 2));
  console.log("\nRe-run with --commit to write.");
  process.exit(0);
}

const { error: insErr, data: ins } = await erp.from("leads").insert(rows).select("id");
if (insErr) {
  console.error("Insert failed:", insErr.message);
  process.exit(1);
}
console.log(`\nInserted ${ins.length} leads.`);
