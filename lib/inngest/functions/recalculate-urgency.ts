import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/server";
import {
  computeDealUrgency,
  computeProjectUrgency,
} from "@/lib/ai/scoring/urgency-score";
import { differenceInDays } from "date-fns";

export const recalculateUrgency = inngest.createFunction(
  { id: "recalculate-urgency" },
  { cron: "TZ=Europe/Budapest 0 2 * * *" },
  async ({ step }) => {
    const supabase = createServiceClient();

    // Deals
    const dealsResult = await step.run("update-deals", async () => {
      const { data: deals } = await supabase.from("deals").select("*");
      if (!deals) return 0;
      let updated = 0;
      for (const d of deals) {
        const days_in_current_stage = differenceInDays(new Date(), new Date(d.updated_at));
        const u = computeDealUrgency({
          last_client_contact_at: d.last_client_contact_at,
          followup_count: d.followup_count,
          proposal_sent_at: d.proposal_sent_at,
          vercel_preview_attached_at: d.vercel_preview_attached_at,
          vercel_preview_sent: d.stage === "visual_sent" || d.stage === "proposal_sent",
          days_in_current_stage,
          win_probability: null,
          any_action_taken: d.followup_count > 0,
        });
        await supabase
          .from("deals")
          .update({ urgency_score: u.score })
          .eq("id", d.id);
        updated++;
      }
      return updated;
    });

    // Projects
    const projectsResult = await step.run("update-projects", async () => {
      const { data: projects } = await supabase.from("projects").select("*");
      if (!projects) return 0;
      let updated = 0;
      for (const p of projects) {
        const { data: invoices } = await supabase
          .from("invoices")
          .select("status")
          .eq("project_id", p.id);
        const has_overdue_invoice = (invoices ?? []).some((i) => i.status === "overdue");

        const u = computeProjectUrgency({
          current_stage: p.current_stage,
          days_in_current_stage: p.days_in_current_stage ?? 0,
          waiting_on: p.waiting_on as never,
          blocker: p.blocker,
          materials_deadline: p.materials_deadline,
          revision_deadline: p.revision_deadline,
          has_overdue_invoice,
          final_payment_received: !!p.final_payment_at,
        });
        await supabase
          .from("projects")
          .update({ urgency_score: u.score, urgency_factors: u.factors })
          .eq("id", p.id);
        updated++;
      }
      return updated;
    });

    return { deals_updated: dealsResult, projects_updated: projectsResult };
  },
);
