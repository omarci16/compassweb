import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/server";

export const speedToLeadAlert = inngest.createFunction(
  { id: "speed-to-lead-alert" },
  { cron: "*/30 * * * *" },
  async ({ step }) => {
    const supabase = createServiceClient();
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: stale } = await step.run("query", async () =>
      supabase
        .from("leads")
        .select("id, company_name, created_at")
        .eq("status", "new")
        .is("first_contact_at", null)
        .lt("created_at", cutoff),
    );

    if (!stale || stale.length === 0) return { alerted: 0 };

    // In production this would notify Slack/email. For now, log.
    console.log(`[speed-to-lead] ${stale.length} stale leads:`, stale.map((s) => s.company_name));
    return { alerted: stale.length };
  },
);
