import { Mail, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { formatRelativeHu } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const QUEUE = [
  {
    id: "q1",
    type: "follow_up",
    recipient: "Horváth Optika",
    subject: "Nem akarom túl sokat zavarni — frissítjük a koncepciót?",
    drafted_at: new Date(Date.now() - 3600_000 * 6).toISOString(),
    why: "6 napja semmi visszajelzés a proposalra",
  },
  {
    id: "q2",
    type: "re_engagement",
    recipient: "Mosonyi Café (archived)",
    subject: "Hogyan állnak a Q2-es terveik?",
    drafted_at: new Date(Date.now() - 3600_000 * 24).toISOString(),
    why: "30 napos re-engagement sequence triggered",
  },
];

const SENT_LOG = [
  { id: "s1", type: "proposal", recipient: "Kovács Dental", sent_at: new Date(Date.now() - 86400_000 * 2).toISOString() },
  { id: "s2", type: "invoice", recipient: "Szabó Kft.", sent_at: new Date(Date.now() - 86400_000 * 8).toISOString() },
  { id: "s3", type: "staging_delivery", recipient: "Tóth Borászat", sent_at: new Date(Date.now() - 86400_000 * 6).toISOString() },
];

export default function OutreachPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Outreach</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI-drafted emails awaiting your review, and a complete log of what's gone out.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Draft queue
            <Badge variant="purple" className="font-normal">{QUEUE.length} pending</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {QUEUE.length === 0 ? (
            <EmptyState icon={Mail} title="Nothing to review" description="When AI drafts emails (re-engagement, follow-ups, reminders), they land here." />
          ) : (
            <div className="space-y-2">
              {QUEUE.map((q) => (
                <div key={q.id} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="info" className="font-normal capitalize">{q.type.replace("_", " ")}</Badge>
                        <span className="text-sm font-medium">{q.recipient}</span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-foreground/90 truncate">
                        {q.subject}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Drafted {formatRelativeHu(q.drafted_at)} · {q.why}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline">Review</Button>
                      <Button size="sm">Approve & send</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Recent sent</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {SENT_LOG.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium truncate">{s.recipient}</span>
                <Badge variant="outline" className="font-normal capitalize">{s.type.replace("_", " ")}</Badge>
              </div>
              <span className="text-xs text-muted-foreground">{formatRelativeHu(s.sent_at)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
