import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/server";

export const materialsDeadlineReminder = inngest.createFunction(
  { id: "materials-deadline-reminder" },
  { cron: "TZ=Europe/Budapest 0 9 * * *" },
  async ({ step }) => {
    const supabase = createServiceClient();
    const in2days = new Date(Date.now() + 2 * 86_400_000);
    const startOfWindow = new Date(in2days);
    startOfWindow.setHours(0, 0, 0, 0);
    const endOfWindow = new Date(in2days);
    endOfWindow.setHours(23, 59, 59, 999);

    const { data } = await step.run("query", async () =>
      supabase
        .from("projects")
        .select("id, client_name, client_email, materials_deadline")
        .eq("current_stage", 3)
        .is("materials_received_at", null)
        .gte("materials_deadline", startOfWindow.toISOString())
        .lte("materials_deadline", endOfWindow.toISOString()),
    );

    return { drafts_queued: data?.length ?? 0 };
    // (Drafting + queueing for review handled in outreach module.)
  },
);

export const revisionAutoApprove = inngest.createFunction(
  { id: "revision-deadline-auto-approve" },
  { cron: "TZ=Europe/Budapest 0 9 * * *" },
  async ({ step }) => {
    const supabase = createServiceClient();
    const now = new Date().toISOString();
    const { data } = await step.run("query", async () =>
      supabase
        .from("projects")
        .select("id, revision_deadline")
        .eq("current_stage", 5)
        .is("revision_received_at", null)
        .lt("revision_deadline", now),
    );

    if (!data || data.length === 0) return { approved: 0 };

    let approved = 0;
    for (const p of data) {
      await supabase
        .from("projects")
        .update({
          revision_received_at: p.revision_deadline,
        })
        .eq("id", p.id);
      approved++;
    }
    return { approved };
  },
);

export const projectMaterialsOverdue = inngest.createFunction(
  { id: "project-paused-notify" },
  { event: "project/materials-overdue" },
  async ({ event, step }) => {
    const supabase = createServiceClient();
    await step.run("pause", async () => {
      await supabase
        .from("projects")
        .update({ paused_at: new Date().toISOString() })
        .eq("id", event.data.project_id);
    });
    // Restart fee invoice draft created here in production.
  },
);
