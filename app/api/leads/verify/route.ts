import { NextResponse } from "next/server";
import { z } from "zod";
import { inngest } from "@/lib/inngest/client";
import { isSupabaseConfigured } from "@/lib/data/queries";

const Input = z.object({
  lead_id: z.string().uuid(),
  audit_after: z.boolean().default(false),
});

/**
 * Kicks off site verification (PSI + optional rendered crawl) for a single lead
 * from the lead detail page. Async — the work runs in the verify-website Inngest
 * function; the UI refreshes when it lands.
 */
export async function POST(req: Request) {
  const parsed = Input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad input" }, { status: 400 });
  }
  if (!isSupabaseConfigured() || !process.env.INNGEST_EVENT_KEY) {
    return NextResponse.json(
      { error: "Verification needs Supabase + Inngest configured." },
      { status: 503 },
    );
  }

  await inngest.send({
    name: "lead/verify-site",
    data: { lead_id: parsed.data.lead_id, audit_after: parsed.data.audit_after },
  });

  return NextResponse.json({ ok: true, status: "queued" });
}
