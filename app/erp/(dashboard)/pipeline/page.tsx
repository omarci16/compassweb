import { getDeals, getLeads } from "@/lib/data/queries";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const [deals, leads] = await Promise.all([getDeals(), getLeads({ limit: 500 })]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Drag deals between stages. Cards sorted by urgency within each column.
        </p>
      </div>
      <PipelineBoard deals={deals} leads={leads} />
    </div>
  );
}
