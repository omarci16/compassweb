import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/shared/Stat";
import { Activity, Award, Target, Timer } from "lucide-react";
import {
  CycleTrendChart,
  LossReasonPie,
  WinRateChart,
} from "@/components/intelligence/Charts";

export const dynamic = "force-dynamic";

const winRates = [
  { niche: "Dental", rate: 72 },
  { niche: "Restaurant", rate: 41 },
  { niche: "Law firm", rate: 65 },
  { niche: "Retail", rate: 38 },
  { niche: "Spa", rate: 80 },
  { niche: "Fitness", rate: 55 },
];

const lossReasons = [
  { name: "Price", value: 32 },
  { name: "Timing", value: 24 },
  { name: "Competitor", value: 18 },
  { name: "No response", value: 14 },
  { name: "Out of scope", value: 8 },
  { name: "Other", value: 4 },
];

const cycle = [
  { month: "Jan", days: 28 },
  { month: "Feb", days: 26 },
  { month: "Mar", days: 22 },
  { month: "Apr", days: 19 },
  { month: "May", days: 17 },
];

export default function IntelligencePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Intelligence</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Performance analytics and the data feedback loop. The longer the system runs,
          the sharper the AI scoring becomes.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Win rate (90d)" value="58%" hint="vs 49% last quarter" trend={{ value: "+9pts", positive: true }} icon={Target} tone="positive" />
        <Stat label="Avg deal cycle" value="17d" hint="lead → won" icon={Timer} tone="positive" />
        <Stat label="Speed-to-lead" value="42m" hint="median, last 30d" icon={Activity} />
        <Stat label="Wins this month" value="6" hint="of 11 closed" icon={Award} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Win rate by niche</CardTitle>
          </CardHeader>
          <CardContent>
            <WinRateChart data={winRates} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Loss reasons</CardTitle>
          </CardHeader>
          <CardContent>
            <LossReasonPie data={lossReasons} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Deal cycle (monthly avg)</CardTitle>
          </CardHeader>
          <CardContent>
            <CycleTrendChart data={cycle} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
