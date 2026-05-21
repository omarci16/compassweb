// Stand-in for Supabase-generated types. Regenerate via:
//   supabase gen types typescript --project-id <id> > lib/types/database.types.ts
// The shapes here mirror the schema in supabase/migrations/0001_initial_schema.sql.
//
// Row types are `type` (not `interface`) so they satisfy Record<string, unknown>
// which Supabase's GenericTable constraint requires for typed .update() calls.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TableDef<Row extends Record<string, unknown>> = {
  Row: Row;
  Insert: any;
  Update: any;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      leads: TableDef<LeadRow>;
      deals: TableDef<DealRow>;
      projects: TableDef<ProjectRow>;
      project_stage_history: TableDef<StageHistoryRow>;
      assets: TableDef<AssetRow>;
      invoices: TableDef<InvoiceRow>;
      email_log: TableDef<EmailLogRow>;
      re_engagement_sequences: TableDef<ReEngagementRow>;
      templates: TableDef<TemplateRow>;
      users_profile: TableDef<UserProfileRow>;
      scraping_jobs: TableDef<ScrapingJobRow>;
    };
    Views: {
      [key: string]: {
        Row: Record<string, unknown>;
        Relationships: [];
      };
    };
    Functions: {
      [key: string]: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
    };
    Enums: { [key: string]: string };
    CompositeTypes: { [key: string]: Record<string, unknown> };
  };
};

export type LeadRow = {
  id: string;
  created_at: string;
  updated_at: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website_url: string | null;
  source: string;
  niche: string | null;
  package_interest: string | null;
  budget_confirmed: boolean;
  decision_maker_confirmed: boolean;
  has_existing_website: boolean | null;
  existing_website_url: string | null;
  timeline_weeks: number | null;
  win_probability: number | null;
  win_probability_reasons: Json | null;
  enrichment_data: Json | null;
  enrichment_status: string;
  enrichment_summary: string | null;
  status: string;
  first_contact_at: string | null;
  speed_to_lead_minutes: number | null;
  internal_notes: string | null;
  loss_reason: string | null;
  loss_notes: string | null;
  assigned_to: string | null;
  converted_to_project_id: string | null;
  // Prospecting fields (added in 0002_prospecting.sql)
  scraping_job_id: string | null;
  gmaps_place_id: string | null;
  gmaps_category: string | null;
  gmaps_address: string | null;
  gmaps_city: string | null;
  gmaps_rating: number | null;
  gmaps_review_count: number | null;
  gmaps_phone: string | null;
  gmaps_url: string | null;
  social_links: Json | null;
  website_health_status: string | null;
  website_health_checked_at: string | null;
  website_health_details: Json | null;
  // Pain intelligence (added in 0003_pain_intelligence.sql)
  tech_stack: Json | null;
  pain_signals: Json | null;
  pain_audit: string | null;
  pain_audit_generated_at: string | null;
};

export type DealRow = {
  id: string;
  created_at: string;
  updated_at: string;
  lead_id: string;
  stage: string;
  vercel_preview_url: string | null;
  vercel_preview_attached_at: string | null;
  vercel_preview_attached_by: string | null;
  proposed_package: string | null;
  proposed_price_huf: number | null;
  monthly_fee_huf: number | null;
  proposal_draft: string | null;
  proposal_sent_at: string | null;
  urgency_score: number | null;
  last_client_contact_at: string | null;
  next_followup_at: string | null;
  followup_count: number;
  assigned_to: string | null;
  internal_notes: string | null;
};

export type ProjectRow = {
  id: string;
  created_at: string;
  updated_at: string;
  lead_id: string | null;
  deal_id: string | null;
  client_name: string;
  client_email: string;
  client_company: string | null;
  package: string;
  agreed_price_huf: number;
  monthly_fee_huf: number;
  current_stage: number;
  stage_entered_at: string;
  days_in_current_stage: number; // computed client-side from stage_entered_at
  waiting_on: string;
  urgency_score: number;
  urgency_factors: Json | null;
  blocker: string | null;
  blocker_set_at: string | null;
  owner_id: string | null;
  contract_signed_at: string | null;
  deposit_paid_at: string | null;
  materials_deadline: string | null;
  materials_received_at: string | null;
  blueprint_approved_at: string | null;
  staging_url: string | null;
  staging_sent_at: string | null;
  revision_deadline: string | null;
  revision_received_at: string | null;
  final_payment_at: string | null;
  launched_at: string | null;
  launch_url: string | null;
  paused_at: string | null;
  restart_fee_charged: boolean;
  portal_token: string;
  portal_last_viewed_at: string | null;
  blueprint_data: Json | null;
  internal_notes: string | null;
};

export type StageHistoryRow = {
  id: string;
  project_id: string;
  from_stage: number | null;
  to_stage: number;
  changed_at: string;
  changed_by: string | null;
  notes: string | null;
};

export type AssetRow = {
  id: string;
  created_at: string;
  project_id: string;
  type: string;
  label: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  external_url: string | null;
  approval_status: string;
  notes: string | null;
  uploaded_by: string | null;
};

export type InvoiceRow = {
  id: string;
  created_at: string;
  project_id: string;
  type: string;
  amount_huf: number;
  amount_net_huf: number | null;
  vat_rate: number;
  status: string;
  issued_at: string | null;
  due_at: string | null;
  paid_at: string | null;
  invoice_number: string | null;
  notes: string | null;
  pdf_path: string | null;
};

export type EmailLogRow = {
  id: string;
  created_at: string;
  lead_id: string | null;
  deal_id: string | null;
  project_id: string | null;
  direction: string;
  from_address: string;
  to_address: string;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  sent_at: string | null;
  resend_message_id: string | null;
  type: string | null;
  ai_drafted: boolean;
};

export type ReEngagementRow = {
  id: string;
  created_at: string;
  lead_id: string;
  status: string;
  next_touch_at: string | null;
  touch_count: number;
  last_touch_at: string | null;
  last_touch_type: string | null;
};

export type TemplateRow = {
  id: string;
  type: string;
  name: string;
  niche: string | null;
  subject: string | null;
  body: string;
  variables: Json | null;
  created_at: string;
  updated_at: string;
};

export type UserProfileRow = {
  id: string;
  full_name: string;
  display_name: string | null;
  avatar_initials: string | null;
  role: string;
  created_at: string;
};

export type ScrapingJobRow = {
  id: string;
  created_at: string;
  updated_at: string;
  niche: string;
  search_terms: string[];
  city: string;
  country: string;
  max_results: number;
  apify_run_id: string | null;
  apify_dataset_id: string | null;
  apify_actor_id: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  total_scraped: number;
  total_duplicates: number;
  total_imported: number;
  total_top_tier: number;
  estimated_cost_usd: number | null;
  triggered_by: string | null;
  notes: string | null;
};
