import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import { NO_REFS, partitionDeletable, type LeadRefs } from "@/lib/leads/deletable";

// Bulk-delete leads that nothing depends on — the point is clearing scraped
// junk, not removing customers.
//
// The guard is not cosmetic: deals.lead_id and re_engagement_sequences.lead_id
// are ON DELETE CASCADE, so deleting a lead with a deal would silently destroy
// pipeline data; email_log.lead_id is ON DELETE SET NULL, so deleting an
// emailed lead would orphan a record CLAUDE.md rule #4 exists to protect.
// Anything attached is reported back and kept.

const BulkDeleteInput = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BulkDeleteInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { ids } = parsed.data;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      demo: true,
      deleted: 0,
      blocked: [],
      message: "Supabase not configured — delete is a no-op in demo mode.",
    });
  }

  const supabase = createClient();

  // Names for the "kept these" report.
  const { data: leadRows, error: leadErr } = await supabase
    .from("leads")
    .select("id, company_name")
    .in("id", ids);

  if (leadErr) {
    console.error("bulk-delete: fetch leads failed", leadErr);
    return NextResponse.json({ error: "Failed to load leads" }, { status: 500 });
  }
  if (!leadRows || leadRows.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0, blocked: [] });
  }

  const presentIds = leadRows.map((l) => l.id as string);

  // One query per referencing table, then tally in code — cheaper and simpler
  // than a count per lead, and these lists are bounded by the 500-id cap.
  const [deals, projects, emails, sends] = await Promise.all([
    supabase.from("deals").select("lead_id").in("lead_id", presentIds),
    supabase.from("projects").select("lead_id").in("lead_id", presentIds),
    supabase.from("email_log").select("lead_id").in("lead_id", presentIds),
    supabase.from("outreach_sends").select("lead_id").in("lead_id", presentIds),
  ]);

  const refsById = new Map<string, LeadRefs>(presentIds.map((id) => [id, { ...NO_REFS }]));
  const tally = (
    rows: { lead_id: string | null }[] | null | undefined,
    key: keyof LeadRefs,
  ) => {
    for (const row of rows ?? []) {
      if (!row.lead_id) continue;
      const refs = refsById.get(row.lead_id);
      if (refs) refs[key] += 1;
    }
  };

  tally(deals.data as { lead_id: string | null }[] | null, "deals");
  tally(projects.data as { lead_id: string | null }[] | null, "projects");
  tally(emails.data as { lead_id: string | null }[] | null, "emails");
  // outreach_sends only exists from migration 0010; treat a query error as
  // "no sends" rather than blocking the whole operation.
  if (!sends.error) {
    tally(sends.data as { lead_id: string | null }[] | null, "sends");
  }

  const { deletable, blocked } = partitionDeletable(
    leadRows.map((l) => ({
      id: l.id as string,
      company_name: (l.company_name as string) ?? "—",
      refs: refsById.get(l.id as string) ?? NO_REFS,
    })),
  );

  if (deletable.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0, blocked });
  }

  const { error: delErr } = await supabase.from("leads").delete().in("id", deletable);
  if (delErr) {
    console.error("bulk-delete: delete failed", delErr);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: deletable.length, blocked });
}
