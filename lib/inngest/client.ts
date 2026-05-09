import { Inngest, EventSchemas } from "inngest";

type Events = {
  "lead/created": { data: { lead_id: string; website_url?: string | null } };
  "lead/enriched": { data: { lead_id: string } };
  "lead/score": { data: { lead_id: string } };
  "deal/visual-attached": { data: { deal_id: string } };
  "project/materials-overdue": { data: { project_id: string } };
  "re_engagement/schedule": { data: { lead_id: string } };
};

export const inngest = new Inngest({
  id: "compass-erp",
  schemas: new EventSchemas().fromRecord<Events>(),
});
