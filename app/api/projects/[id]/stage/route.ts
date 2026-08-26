import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/queries";
import { checkGate, suggestedWaitingOn } from "@/lib/utils/stage-gates";
import type { ProjectStage } from "@/lib/types/app.types";

const Input = z.object({
  stage: z.number().int().min(0).max(7),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const parsed = Input.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad input" }, { status: 400 });
  const targetStage = parsed.data.stage as ProjectStage;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, demo: true });
  }

  const supabase = createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { data: invoices } = await supabase
    .from("invoices")
    .select("type, status")
    .eq("project_id", params.id);

  const depositInvoice = invoices?.find((i) => i.type === "deposit") ?? null;
  const finalInvoice = invoices?.find((i) => i.type === "final") ?? null;

  const gate = checkGate(
    {
      project: project as never,
      depositInvoice,
      finalInvoice,
    },
    targetStage,
  );

  if (!gate.allowed) {
    return NextResponse.json(
      { error: `Stage gate refused: ${gate.blockers.join(", ")}` },
      { status: 409 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const update: Record<string, unknown> = {
    current_stage: targetStage,
    stage_entered_at: new Date().toISOString(),
    waiting_on: suggestedWaitingOn(targetStage),
  };

  // Stage-specific timestamp side effects
  if (targetStage === 3 && !project.materials_deadline) {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);
    update.materials_deadline = deadline.toISOString();
  }
  if (targetStage === 5 && !project.revision_deadline) {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7); // 5 working days approximation
    update.revision_deadline = deadline.toISOString();
    update.staging_sent_at = new Date().toISOString();
  }
  if (targetStage === 7 && !project.launched_at) {
    update.launched_at = new Date().toISOString();
  }

  const { error } = await supabase.from("projects").update(update).eq("id", params.id);
  if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });

  await supabase.from("project_stage_history").insert({
    project_id: params.id,
    from_stage: project.current_stage,
    to_stage: targetStage,
    changed_by: user?.id ?? null,
  });

  return NextResponse.json({ ok: true, stage: targetStage });
}
