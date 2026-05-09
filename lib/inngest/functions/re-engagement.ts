import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/server";

export const reEngagementSequence = inngest.createFunction(
  { id: "re-engagement-sequence" },
  { cron: "TZ=Europe/Budapest 0 10 * * *" },
  async ({ step }) => {
    const supabase = createServiceClient();
    const today = new Date().toISOString();
    const { data } = await step.run("query", async () =>
      supabase
        .from("re_engagement_sequences")
        .select("*")
        .eq("status", "active")
        .lte("next_touch_at", today),
    );

    if (!data || data.length === 0) return { queued: 0 };

    let queued = 0;
    for (const s of data) {
      const touchType =
        s.touch_count === 0 ? "30_day" :
        s.touch_count === 1 ? "60_day" : "90_day";

      const next = new Date();
      next.setDate(next.getDate() + 30);

      await supabase
        .from("re_engagement_sequences")
        .update({
          touch_count: s.touch_count + 1,
          last_touch_at: today,
          last_touch_type: touchType,
          next_touch_at: s.touch_count >= 2 ? null : next.toISOString(),
          status: s.touch_count >= 2 ? "paused" : "active",
        })
        .eq("id", s.id);

      // Drafting + queueing into the outreach review queue handled here in production.
      queued++;
    }
    return { queued };
  },
);
