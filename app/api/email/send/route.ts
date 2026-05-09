import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, FROM_EMAIL } from "@/lib/resend/client";
import { isSupabaseConfigured } from "@/lib/data/queries";

const Input = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  html: z.string().optional(),
  text: z.string().optional(),
  type: z.enum([
    "proposal",
    "follow_up",
    "contract",
    "invoice",
    "staging_delivery",
    "re_engagement",
    "general",
  ]),
  ai_drafted: z.boolean().default(false),
  lead_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const parsed = Input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad input" }, { status: 400 });

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Resend not configured" }, { status: 503 });
  }

  const result = await sendEmail({
    to: parsed.data.to,
    subject: parsed.data.subject,
    html: parsed.data.html,
    text: parsed.data.text,
  });

  if (isSupabaseConfigured()) {
    const supabase = createClient();
    await supabase.from("email_log").insert({
      lead_id: parsed.data.lead_id ?? null,
      deal_id: parsed.data.deal_id ?? null,
      project_id: parsed.data.project_id ?? null,
      direction: "outbound",
      from_address: FROM_EMAIL,
      to_address: parsed.data.to,
      subject: parsed.data.subject,
      body_html: parsed.data.html ?? null,
      body_text: parsed.data.text ?? null,
      sent_at: new Date().toISOString(),
      resend_message_id: result.data?.id ?? null,
      type: parsed.data.type,
      ai_drafted: parsed.data.ai_drafted,
    });

    // If proposal sent, advance deal
    if (parsed.data.deal_id && parsed.data.type === "proposal") {
      await supabase
        .from("deals")
        .update({
          stage: "proposal_sent",
          proposal_sent_at: new Date().toISOString(),
        })
        .eq("id", parsed.data.deal_id);
    }
  }

  return NextResponse.json({ ok: true, message_id: result.data?.id });
}
