import { NextResponse } from "next/server";
import { z } from "zod";
import { callClaude, extractJson } from "@/lib/ai/anthropic";
import { createServiceClient } from "@/lib/supabase/server";
import {
  GENERATE_BLUEPRINT_SYSTEM,
  generateBlueprintUserPrompt,
} from "@/lib/ai/prompts/generate-blueprint";
import type { BlueprintResult } from "@/lib/types/app.types";
import type { Json } from "@/lib/types/database.types";
import { isSupabaseConfigured } from "@/lib/data/queries";

const Input = z.object({
  project_id: z.string().optional(),
  wpp_form_data: z.record(z.unknown()),
});

export async function POST(req: Request) {
  const parsed = Input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad input" }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Anthropic not configured" }, { status: 503 });
  }

  const text = await callClaude({
    system: GENERATE_BLUEPRINT_SYSTEM,
    user: generateBlueprintUserPrompt(parsed.data.wpp_form_data),
    maxTokens: 2000,
    temperature: 0.5,
  });
  const result = extractJson<BlueprintResult>(text);

  if (parsed.data.project_id && isSupabaseConfigured()) {
    const supabase = createServiceClient();
    await supabase
      .from("projects")
      .update({ blueprint_data: result as unknown as Json })
      .eq("id", parsed.data.project_id);
  }

  return NextResponse.json(result);
}
