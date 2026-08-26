import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/server";

export const monthlyRetainerInvoice = inngest.createFunction(
  { id: "monthly-retainer-invoice" },
  { cron: "TZ=Europe/Budapest 0 8 1 * *" },
  async ({ step }) => {
    const supabase = createServiceClient();
    const { data: projects } = await step.run("fetch", async () =>
      supabase
        .from("projects")
        .select("id, monthly_fee_huf")
        .eq("current_stage", 7),
    );

    if (!projects) return { created: 0 };

    let created = 0;
    const now = new Date();
    const due = new Date(now);
    due.setDate(now.getDate() + 14);

    for (const p of projects) {
      const net = Math.round(p.monthly_fee_huf / 1.27);
      await supabase.from("invoices").insert({
        project_id: p.id,
        type: "monthly",
        amount_huf: p.monthly_fee_huf,
        amount_net_huf: net,
        vat_rate: 0.27,
        status: "draft",
        issued_at: now.toISOString(),
        due_at: due.toISOString(),
      });
      created++;
    }
    return { created };
  },
);
