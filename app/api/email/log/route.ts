import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import { FROM_EMAIL } from "@/lib/resend/client";

const Input = z.object({
  direction: z.enum(["inbound", "outbound"]).default("outbound"),
  to_address: z.string().email().optional(),
  from_address: z.string().email().optional(),
  subject: z.string().min(1),
  body_html: z.string().optional(),
  body_text: z.string().optional(),
  type: z.string(),
  ai_drafted: z.boolean().default(false),
  lead_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const parsed = Input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad input" }, { status: 400 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, demo: true });

  const supabase = createClient();
  const { error } = await supabase.from("email_log").insert({
    direction: parsed.data.direction,
    from_address: parsed.data.from_address ?? FROM_EMAIL,
    to_address: parsed.data.to_address ?? "",
    subject: parsed.data.subject,
    body_html: parsed.data.body_html ?? null,
    body_text: parsed.data.body_text ?? null,
    type: parsed.data.type,
    ai_drafted: parsed.data.ai_drafted,
    sent_at: new Date().toISOString(),
    lead_id: parsed.data.lead_id ?? null,
    deal_id: parsed.data.deal_id ?? null,
    project_id: parsed.data.project_id ?? null,
  });

  if (error) return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
