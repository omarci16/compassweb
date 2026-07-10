import { NextResponse } from "next/server";
import { z } from "zod";
import { inngest } from "@/lib/inngest/client";
import { isSupabaseConfigured } from "@/lib/data/queries";

const Input = z.object({
  batch_size: z.number().int().min(1).max(100).optional(),
  dry_run: z.boolean().default(true),
});

/**
 * Kicks off the one-off re-verification backfill of existing cold leads.
 * Defaults to a DRY RUN — inspect the Inngest run's would_downgrade /
 * would_null_audit counts before running for real with { dry_run: false }.
 */
export async function POST(req: Request) {
  const parsed = Input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad input" }, { status: 400 });
  }
  if (!isSupabaseConfigured() || !process.env.INNGEST_EVENT_KEY) {
    return NextResponse.json(
      { error: "Backfill needs Supabase + Inngest configured." },
      { status: 503 },
    );
  }

  await inngest.send({
    name: "prospecting/backfill-reverify",
    data: { batch_size: parsed.data.batch_size, dry_run: parsed.data.dry_run, cursor: "" },
  });

  return NextResponse.json({ ok: true, dry_run: parsed.data.dry_run, status: "queued" });
}
