import Link from "next/link";
import { Archive } from "lucide-react";
import { getLeads } from "@/lib/data/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { differenceInDays } from "date-fns";
import { formatRelativeHu } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const leads = await getLeads({ limit: 500 });
  const cold = leads.filter((l) => l.status === "lost" || l.status === "archived");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cold archive</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Lost or unresponsive leads. Re-engagement sequences run automatically and queue
          drafts for review in the Outreach module.
        </p>
      </div>

      {cold.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="Nothing in the cold archive"
          description="Lost leads and unresponsive prospects will land here. Nothing to clean up right now."
        />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{cold.length} archived leads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cold.map((l) => {
              const daysCold = differenceInDays(new Date(), new Date(l.updated_at));
              const nextTouchDays =
                daysCold < 30 ? 30 - daysCold :
                daysCold < 60 ? 60 - daysCold :
                daysCold < 90 ? 90 - daysCold : null;

              return (
                <Link
                  key={l.id}
                  href={`/erp/leads/${l.id}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 hover:bg-accent/50"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{l.company_name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {l.niche ?? "—"} · cold for {daysCold}d · last update {formatRelativeHu(l.updated_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {l.loss_reason && (
                      <Badge variant="destructive" className="font-normal capitalize">
                        {l.loss_reason.replace("_", " ")}
                      </Badge>
                    )}
                    {nextTouchDays != null && (
                      <Badge variant="info" className="font-normal">
                        Touch in {nextTouchDays}d
                      </Badge>
                    )}
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
