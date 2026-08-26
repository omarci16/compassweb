import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react";
import type { Json } from "@/lib/types/database.types";

/*
 * The five answers from the website's contact brief (public/contact.html).
 *
 * This is the strongest qualifying signal we ever get from an inbound lead —
 * the prospect naming their own bottleneck, their current response time, the
 * systems we would have to integrate with, and a budget band — so it sits at
 * the top of the lead, above the enrichment guesswork.
 */

interface BriefShape {
  bottleneck?: string[];
  response_speed?: string;
  tools?: string[];
  budget?: string;
  message?: string;
  lang?: string;
}

function asBrief(value: Json | null): BriefShape | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as BriefShape;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[168px_1fr] sm:gap-4">
      <div className="mono-label pt-0.5">{label}</div>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

export function BriefCard({ brief }: { brief: Json | null }) {
  const b = asBrief(brief);
  if (!b) return null;

  const bottleneck = b.bottleneck ?? [];
  const tools = b.tools ?? [];
  const hasAnswers =
    bottleneck.length > 0 ||
    tools.length > 0 ||
    !!b.response_speed ||
    !!b.budget ||
    !!b.message;
  if (!hasAnswers) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          Website brief
          {b.lang && (
            <Badge variant="outline" className="ml-1">
              {b.lang.toUpperCase()}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {bottleneck.length > 0 && (
          <Row label="Bottleneck">
            <div className="flex flex-wrap gap-1.5">
              {bottleneck.map((v) => (
                <Badge key={v} variant="secondary">
                  {v}
                </Badge>
              ))}
            </div>
          </Row>
        )}
        {b.response_speed && (
          <Row label="Responds in">
            {/* Their own answer to "how fast do you reply to an inquiry" —
                the opening for a speed-to-lead conversation. */}
            <span className="mono-num">{b.response_speed}</span>
          </Row>
        )}
        {tools.length > 0 && (
          <Row label="Must connect to">
            <div className="flex flex-wrap gap-1.5">
              {tools.map((v) => (
                <Badge key={v} variant="outline">
                  {v}
                </Badge>
              ))}
            </div>
          </Row>
        )}
        {b.budget && (
          <Row label="Budget band">
            <span className="mono-num text-compass-green">{b.budget}</span>
          </Row>
        )}
        {b.message && (
          <Row label="Message">
            <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
              {b.message}
            </p>
          </Row>
        )}
      </CardContent>
    </Card>
  );
}
