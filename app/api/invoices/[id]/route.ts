import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";

const PatchInput = z
  .object({
    status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).optional(),
    paid_at: z.string().datetime().nullable().optional(),
    due_at: z.string().datetime().nullable().optional(),
    invoice_number: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict();

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const parsed = PatchInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad input" }, { status: 400 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, demo: true });

  const supabase = createClient();
  const update = { ...parsed.data };

  // If marking paid, stamp paid_at unless caller supplied it
  if (update.status === "paid" && update.paid_at === undefined) {
    update.paid_at = new Date().toISOString();
  }
  if (update.status && update.status !== "paid" && update.paid_at === undefined) {
    update.paid_at = null;
  }

  const { data: invoice, error } = await supabase
    .from("invoices")
    .update(update)
    .eq("id", params.id)
    .select("project_id, type")
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  // Side effects: when deposit / final invoice marked paid, stamp the project too
  if (update.status === "paid" && invoice.project_id) {
    if (invoice.type === "deposit") {
      await supabase
        .from("projects")
        .update({ deposit_paid_at: new Date().toISOString() })
        .eq("id", invoice.project_id)
        .is("deposit_paid_at", null);
    } else if (invoice.type === "final") {
      await supabase
        .from("projects")
        .update({ final_payment_at: new Date().toISOString() })
        .eq("id", invoice.project_id)
        .is("final_payment_at", null);
    }
  }

  return NextResponse.json({ ok: true });
}
