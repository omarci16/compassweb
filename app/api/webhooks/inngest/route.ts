import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import {
  enrichLead,
  generatePainAudit,
  monthlyRetainerInvoice,
  materialsDeadlineReminder,
  projectMaterialsOverdue,
  prospectingBackfillReverify,
  prospectingProcessResults,
  prospectingRunScrape,
  reEngagementSequence,
  recalculateUrgency,
  revisionAutoApprove,
  scoreLead,
  speedToLeadAlert,
  verifyWebsite,
} from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    enrichLead,
    scoreLead,
    speedToLeadAlert,
    recalculateUrgency,
    materialsDeadlineReminder,
    revisionAutoApprove,
    projectMaterialsOverdue,
    reEngagementSequence,
    monthlyRetainerInvoice,
    prospectingRunScrape,
    prospectingProcessResults,
    generatePainAudit,
    verifyWebsite,
    prospectingBackfillReverify,
  ],
});
