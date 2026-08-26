import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  lead_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lead_id } = bodySchema.parse(body);

    const supabase = createClient();

    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("id, status, package_interest")
      .eq("id", lead_id)
      .single();

    if (leadErr || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const { data: deal, error: dealErr } = await supabase
      .from("deals")
      .insert({
        lead_id,
        stage: "concept_pending",
        proposed_package: lead.package_interest ?? null,
        urgency_score: 50,
      })
      .select()
      .single();

    if (dealErr) {
      console.error("create deal error", dealErr);
      return NextResponse.json({ error: "Failed to create deal" }, { status: 500 });
    }

    await supabase
      .from("leads")
      .update({ status: "qualified" })
      .eq("id", lead_id);

    return NextResponse.json({ deal });
  } catch (err) {
    console.error("POST /api/deals error", err);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
