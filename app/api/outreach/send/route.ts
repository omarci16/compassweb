import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import { sendEmail, FROM_EMAIL } from "@/lib/resend/client";
import { renderColdOutreachHtml } from "@/lib/resend/templates";

const Input = z.object({
  lead_id: z.string().uuid(),
  to: z.string().email(),
  subject: z.string().min(1).max(180),
  body_html: z.string().min(20),
  body_text: z.string().min(20),
  visual_urls: z.array(z.string().url()).max(4).default([]),
  visual_alt: z.string().max(180).default("Compass koncepció"),
  ai_drafted: z.boolean().default(true),
});

/**
 * Sends a cold outreach email via Resend and logs it. The HTML body
 * passed in is the AI body only (with <p> tags); we wrap it in our
 * email shell server-side so the recipient version is identical to the
 * preview the user approved.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = Input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY not configured" },
      { status: 503 },
    );
  }

  const html = renderColdOutreachHtml({
    bodyHtml: data.body_html,
    visualUrls: data.visual_urls,
    visualAlt: data.visual_alt,
  });

  let messageId: string | null = null;
  try {
    const result = await sendEmail({
      to: data.to,
      subject: data.subject,
      html,
      text: data.body_text,
    });
    messageId = result.data?.id ?? null;
  } catch (err) {
    console.error("cold outreach send failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Resend send failed" },
      { status: 502 },
    );
  }

  if (isSupabaseConfigured()) {
    const supabase = createServiceClient();
    await supabase.from("email_log").insert({
      lead_id: data.lead_id,
      deal_id: null,
      project_id: null,
      direction: "outbound",
      from_address: FROM_EMAIL,
      to_address: data.to,
      subject: data.subject,
      body_html: html,
      body_text: data.body_text,
      sent_at: new Date().toISOString(),
      resend_message_id: messageId,
      type: "cold_outreach",
      ai_drafted: data.ai_drafted,
    });

    // Mark first contact so speed-to-lead stops counting.
    await supabase
      .from("leads")
      .update({
        first_contact_at: new Date().toISOString(),
      })
      .eq("id", data.lead_id)
      .is("first_contact_at", null);
  }

  return NextResponse.json({ ok: true, message_id: messageId });
}
