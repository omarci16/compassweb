import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import {
  mapResendEvent,
  nextSendStatus,
  verifyResendSignature,
} from "@/lib/outreach/resend-webhook";
import { addSuppression } from "@/lib/outreach/suppression";
import type { OutreachSendStatus } from "@/lib/types/app.types";

// Resend delivery webhook: opens / clicks / bounces / complaints. Updates the
// MUTABLE outreach_sends lifecycle only — email_log stays append-only (CLAUDE.md
// rule #4). Auto-suppresses on bounce/complaint to protect the sending domain.
export async function POST(req: Request) {
  const raw = await req.text();

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    // Can't verify authenticity → refuse (a forged bounce could suppress anyone).
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
  }
  const ok = verifyResendSignature(
    secret,
    {
      id: req.headers.get("svix-id"),
      timestamp: req.headers.get("svix-timestamp"),
      signature: req.headers.get("svix-signature"),
    },
    raw,
  );
  if (!ok) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { type?: string; data?: { email_id?: string; to?: string | string[] } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mapped = event.type ? mapResendEvent(event.type) : null;
  if (!mapped) return NextResponse.json({ ok: true, ignored: event.type ?? null });

  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, demo: true });

  const messageId = event.data?.email_id;
  if (!messageId) return NextResponse.json({ ok: true, no_message_id: true });

  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("outreach_sends")
    .select("id, status, to_address")
    .eq("resend_message_id", messageId)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const update: Record<string, unknown> = {
      status: nextSendStatus(existing.status as OutreachSendStatus, mapped.status),
    };
    if (mapped.tsField) update[mapped.tsField] = new Date().toISOString();
    await supabase.from("outreach_sends").update(update).eq("id", existing.id);
  }

  // Auto-suppress on bounce / complaint.
  if (mapped.suppress) {
    const to = Array.isArray(event.data?.to) ? event.data?.to[0] : event.data?.to;
    const email = to ?? existing?.to_address;
    if (email) {
      await addSuppression(supabase, { email, reason: mapped.suppress, notes: event.type });
    }
  }

  return NextResponse.json({ ok: true });
}
