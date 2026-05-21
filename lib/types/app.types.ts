import type {
  AssetRow,
  DealRow,
  EmailLogRow,
  InvoiceRow,
  LeadRow,
  ProjectRow,
  ScrapingJobRow,
  TemplateRow,
} from "./database.types";

// ---------------------------------------------------------------------
// Domain enums (string-literal unions reflect DB text columns)
// ---------------------------------------------------------------------

export type LeadSource =
  | "instagram_dm"
  | "referral"
  | "cold_outreach"
  | "inbound_form"
  | "other";

export type LeadStatus =
  | "new"
  | "enriching"
  | "qualified"
  | "visual_sent"
  | "proposal_sent"
  | "negotiating"
  | "won"
  | "lost"
  | "archived";

export type EnrichmentStatus = "pending" | "running" | "complete" | "failed";

export type LossReason =
  | "price"
  | "timing"
  | "competitor"
  | "no_response"
  | "out_of_scope"
  | "other";

export type Package = "landing" | "business" | "ecommerce";

export type DealStage =
  | "concept_pending"
  | "concept_ready"
  | "visual_sent"
  | "proposal_sent"
  | "negotiating"
  | "closed_won"
  | "closed_lost";

export type ProjectStage = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type WaitingOn = "us" | "client";

export type AssetType =
  | "logo"
  | "brand_colors"
  | "typography"
  | "photo"
  | "product_photo"
  | "team_photo"
  | "copy_text"
  | "brand_book"
  | "reference_site"
  | "competitor_site"
  | "other";

export type InvoiceType =
  | "deposit"
  | "final"
  | "monthly"
  | "change_order"
  | "restart_fee";

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

export type EmailType =
  | "proposal"
  | "follow_up"
  | "contract"
  | "invoice"
  | "staging_delivery"
  | "re_engagement"
  | "general";

export type ReEngagementStatus = "active" | "paused" | "converted" | "unsubscribed";

// ---------------------------------------------------------------------
// Prospecting (cold lead sourcing)
// ---------------------------------------------------------------------

export type ProspectingNiche = "beauty" | "fitness" | "dental" | "real_estate" | "other";

export type ScrapingJobStatus =
  | "queued"
  | "running"
  | "collecting"
  | "processing"
  | "complete"
  | "failed"
  | "cancelled";

export type WebsiteHealthStatus =
  | "no_website"
  | "healthy"
  | "broken"
  | "redirect_social"
  | "tiny"
  | "stale"
  | "unknown";

export const PROSPECTING_NICHE_LABELS: Record<ProspectingNiche, string> = {
  beauty: "Beauty",
  fitness: "Fitness",
  dental: "Dental",
  real_estate: "Real estate",
  other: "Other",
};

export const PROSPECTING_NICHE_LABELS_HU: Record<ProspectingNiche, string> = {
  beauty: "Szépségipar",
  fitness: "Fitness",
  dental: "Fogászat",
  real_estate: "Ingatlan",
  other: "Egyéb",
};

export type SocialLinks = {
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  tiktok?: string;
};

export type WebsiteHealthDetails = {
  http_status?: number;
  response_ms?: number;
  body_size?: number;
  redirect_to?: string;
  last_modified?: string;
  reason?: string;
};

// Tech stack detected from a site's HTML.
export type TechStack = {
  cms: "wordpress" | "wix" | "squarespace" | "webflow" | "shopify" | "joomla" | "drupal" | "custom" | null;
  ecommerce: "shopify" | "woocommerce" | "unas" | "shoprenter" | "magento" | null;
  analytics: ("ga4" | "gtm" | "meta_pixel" | "hotjar" | "matomo" | "linkedin_insight")[];
  booking: "calendly" | "simplybook" | "salonized" | "booksy" | "setmore" | "tidycal" | null;
  has_blog: boolean;
  has_schema_org: boolean;
  has_open_graph: boolean;
  has_viewport_meta: boolean;
  has_https: boolean;
  has_contact_form: boolean;
  has_sitemap: boolean | null;
};

export type PainSignalSeverity = "low" | "medium" | "high";

export type PainSignal = {
  code: string;
  severity: PainSignalSeverity;
  label_hu: string;
  label_en: string;
};

// ---------------------------------------------------------------------
// Stage labels (Hungarian + English)
// ---------------------------------------------------------------------

export const PROJECT_STAGE_LABELS: Record<ProjectStage, string> = {
  0: "Lead qualified",
  1: "Discovery complete",
  2: "Contract + deposit",
  3: "Materials intake",
  4: "Blueprint + build",
  5: "Revision",
  6: "Final payment + launch",
  7: "Retainer active",
};

export const PROJECT_STAGE_LABELS_HU: Record<ProjectStage, string> = {
  0: "Lead minősítve",
  1: "Discovery kész",
  2: "Szerződés + előleg",
  3: "Anyaggyűjtés",
  4: "Blueprint + építés",
  5: "Revízió",
  6: "Végszámla + indítás",
  7: "Retainer aktív",
};

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  concept_pending: "Concept pending",
  concept_ready: "Concept ready",
  visual_sent: "Visual sent",
  proposal_sent: "Proposal sent",
  negotiating: "Negotiating",
  closed_won: "Closed won",
  closed_lost: "Closed lost",
};

export const PACKAGE_LABELS: Record<Package, string> = {
  landing: "Landing",
  business: "Business",
  ecommerce: "E-commerce",
};

export const SOURCE_LABELS: Record<LeadSource, string> = {
  instagram_dm: "Instagram DM",
  referral: "Referral",
  cold_outreach: "Cold outreach",
  inbound_form: "Inbound form",
  other: "Other",
};

// ---------------------------------------------------------------------
// Strongly typed re-exports (so domain code never deals with `string` enum cols)
// ---------------------------------------------------------------------

export type Lead = Omit<LeadRow, "source" | "status" | "enrichment_status" | "loss_reason" | "package_interest"> & {
  source: LeadSource;
  status: LeadStatus;
  enrichment_status: EnrichmentStatus;
  loss_reason: LossReason | null;
  package_interest: Package | null;
};

export type Deal = Omit<DealRow, "stage" | "proposed_package"> & {
  stage: DealStage;
  proposed_package: Package | null;
};

export type Project = Omit<ProjectRow, "package" | "current_stage" | "waiting_on"> & {
  package: Package;
  current_stage: ProjectStage;
  waiting_on: WaitingOn;
};

export type Invoice = Omit<InvoiceRow, "type" | "status"> & {
  type: InvoiceType;
  status: InvoiceStatus;
};

export type Asset = Omit<AssetRow, "type"> & { type: AssetType };

export type EmailLog = Omit<EmailLogRow, "type" | "direction"> & {
  type: EmailType | null;
  direction: "inbound" | "outbound";
};

export type Template = TemplateRow;

export type ScrapingJob = Omit<ScrapingJobRow, "niche" | "status"> & {
  niche: ProspectingNiche;
  status: ScrapingJobStatus;
};

// ---------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------

export interface ScoreLeadResult {
  win_probability: number;
  reasons: string[];
  base_score: number;
  ai_adjustment: number;
}

export interface DraftProposalResult {
  email_subject: string;
  email_body: string;
  proposed_package: Package;
  proposed_price_huf: number;
  monthly_fee_huf: number;
  talking_points: string[];
}

export interface DraftFollowupResult {
  email_subject: string;
  email_body: string;
}

export interface BlueprintResult {
  company_name: string;
  tagline: string;
  niche: string;
  target_audience: string;
  usp: string;
  differentiators: string[];
  tone_of_voice: string;
  color_direction: string;
  typography_direction: string;
  visual_style: string;
  page_structure: { page_name: string; sections: string[]; cta: string }[];
  copy_guidelines: string;
  seo_keywords: string[];
  build_instructions: string;
}

export interface DailyBriefingItem {
  severity: "urgent" | "action" | "info" | "ok";
  title: string;
  detail: string;
  href?: string;
}

export interface DailyBriefing {
  generated_at: string;
  greeting: string;
  items: DailyBriefingItem[];
  suggested_first_action: { label: string; href: string } | null;
}
