import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import { generatePortalToken } from "@/lib/utils/portal-token";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, demo: true, token: generatePortalToken() });
  }

  const supabase = createClient();
  const token = generatePortalToken();
  const { error } = await supabase
    .from("projects")
    .update({ portal_token: token, portal_last_viewed_at: null })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });
  return NextResponse.json({ ok: true, token });
}
