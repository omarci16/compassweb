import { getLeads } from "@/lib/data/queries";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { Inbox } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  // Filtering and bulk delete happen client-side over this set, so the limit is
  // also the cleanup ceiling — you cannot delete a junk lead you cannot see.
  const leads = await getLeads({ limit: 500 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sorted by win probability. Use Cmd+K to add a lead.
        </p>
      </div>

      {leads.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No leads yet"
          description="Click 'New lead' in the top bar to capture your first inquiry. Enrichment + AI scoring start automatically."
        />
      ) : (
        <LeadsTable leads={leads} />
      )}
    </div>
  );
}
