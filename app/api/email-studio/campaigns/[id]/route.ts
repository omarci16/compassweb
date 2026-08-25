import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";

const UpdateInput = z.object({
  status: z.enum(["draft", "active", "completed", "archived"]),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = UpdateInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, demo: true });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("email_campaigns")
    .update({ status: parsed.data.status })
    .eq("id", params.id)
    .select("id, status")
    .single();
  if (error || !data) {
    console.error("update campaign error", error);
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, campaign: data });
}
