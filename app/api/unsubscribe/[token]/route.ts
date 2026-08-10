import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import { verifyUnsubToken } from "@/lib/outreach/unsubscribe-token";
import { addSuppression } from "@/lib/outreach/suppression";

// One-click unsubscribe (public, token-authenticated). GET renders a small
// confirmation page for a clicked link; POST answers RFC 8058 one-click. Both
// add the address to the suppression list — it will never be contacted again.

async function unsubscribe(token: string): Promise<{ ok: boolean; email?: string }> {
  const email = verifyUnsubToken(token);
  if (!email) return { ok: false };
  if (!isSupabaseConfigured()) return { ok: true, email };

  const supabase = createServiceClient();
  await addSuppression(supabase, { email, reason: "unsubscribe" });
  await supabase
    .from("outreach_sends")
    .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
    .ilike("to_address", email)
    .is("unsubscribed_at", null);
  return { ok: true, email };
}

function page(ok: boolean): string {
  const msg = ok
    ? "Sikeresen leiratkozott. Nem küldünk több levelet erre a címre."
    : "Érvénytelen vagy lejárt leiratkozási link.";
  return `<!doctype html><html lang="hu"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Leiratkozás — Compass Marketing</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f6f6f4;color:#111827;">
<div style="max-width:520px;margin:80px auto;padding:32px;background:#fff;border:1px solid #ececec;border-radius:12px;text-align:center;">
<div style="font-size:13px;font-weight:600;letter-spacing:.08em;color:#534AB7;text-transform:uppercase;margin-bottom:12px;">Compass Marketing</div>
<p style="font-size:15px;line-height:1.6;">${msg}</p>
</div></body></html>`;
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const r = await unsubscribe(params.token);
  return new NextResponse(page(r.ok), {
    status: r.ok ? 200 : 400,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const r = await unsubscribe(params.token);
  return NextResponse.json({ ok: r.ok }, { status: r.ok ? 200 : 400 });
}
