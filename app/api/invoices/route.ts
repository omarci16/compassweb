import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";

const Input = z.object({
  project_id: z.string().uuid(),
  type: z.enum(["deposit", "final", "monthly", "change_order", "restart_fee"]),
  amount_huf: z.number().int().positive(),
  due_at: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const parsed = Input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad input" }, { status: 400 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, demo: true });

  const supabase = createClient();
  const net = Math.round(parsed.data.amount_huf / 1.27);
  const { data, error } = await supabase
    .from("invoices")
    .insert({
      ...parsed.data,
      amount_net_huf: net,
      vat_rate: 0.27,
      status: "draft",
      issued_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
