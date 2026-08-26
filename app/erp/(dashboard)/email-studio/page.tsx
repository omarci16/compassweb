import { Wand2 } from "lucide-react";
import {
  getEmailCampaigns,
  getVoiceProfilePerformance,
  getVoiceProfiles,
} from "@/lib/data/queries";
import { EmailStudioClient } from "@/components/email-studio/EmailStudioClient";

export const dynamic = "force-dynamic";

export default async function EmailStudioPage() {
  const [profiles, campaigns, performance] = await Promise.all([
    getVoiceProfiles(),
    getEmailCampaigns(),
    getVoiceProfilePerformance(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-primary" />
          Email Studio
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Taníts be hangnem-profilokat niche-enként és szituációnként. Az AI (OpenAI) ezeket
          használja minden kimenő levél megírásához — próbáld ki a sandboxban, mielőtt élesbe
          mennél.
        </p>
      </div>

      <EmailStudioClient
        initialProfiles={profiles}
        initialCampaigns={campaigns}
        performance={performance}
      />
    </div>
  );
}
