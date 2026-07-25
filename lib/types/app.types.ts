import type {
  AssetRow,
  DealRow,
  EmailLogRow,
  InvoiceRow,
  LeadRow,
  OutreachDraftRow,
  OutreachSendRow,
  ProjectRow,
  ScrapingJobRow,
  SendingInboxRow,
  SuppressionRow,
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

export type EnrichmentStatus =
  | "pending"
  | "running"
  | "complete"
  | "crawl_failed"
  | "blocked"
  | "empty_site"
  // "failed" is legacy — kept so old rows type-check until backfill remaps them.
  | "failed";

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
  | "cold_outreach"
  | "general";

export type ReEngagementStatus = "active" | "paused" | "converted" | "unsubscribed";

// Free in-code email verification (Scraping 2.1, Phase B).
//   valid   — syntax ok, not disposable, domain has MX
//   risky   — role account (info@/office@…) or MX unverifiable — sendable, low trust
//   invalid — bad syntax, disposable, or no mail server → never queued for sending
//   unknown — no email on the lead / not yet checked
export type EmailStatus = "valid" | "risky" | "invalid" | "unknown";

// Offer routing (Scraping 2.1, Phase C) — which pitch this lead gets.
//   needs_site   — no usable site (no_website/broken/redirect_social/tiny): pitch "here's a concept"
//   upgrade      — working site + a concrete hook (stale, Wix, no analytics, runs ads…): pitch "convert more"
//   low_priority — healthy, strong, no hook / unverifiable: don't spend a touch yet
export type OfferTrack = "needs_site" | "upgrade" | "low_priority";

// Buying signal: does the business currently run paid ads? (Meta Ad Library.)
export type AdsSignal = {
  runs_ads: boolean;
  source: "meta_ad_library";
  ad_count?: number;
  checked_at: string; // ISO
};

// ---------------------------------------------------------------------
// Prospecting (cold lead sourcing)
// ---------------------------------------------------------------------

export type ProspectingNiche =
  | "beauty"
  | "fitness"
  | "dental"
  | "real_estate"
  | "legal"
  | "hospitality"
  | "other";

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
  | "unknown"
  // We reached the server but a bot wall / WAF / challenge blocked us — we
  // couldn't actually see the site, so it must never score as a buy signal.
  | "blocked"
  // Network error / timeout on BOTH https and http after a retry.
  | "unreachable"
  // Small HTML body but framework markers present — a JS-rendered shell that
  // needs a rendered crawl before we claim it's a placeholder.
  | "js_shell";

export const PROSPECTING_NICHE_LABELS: Record<ProspectingNiche, string> = {
  beauty: "Beauty",
  fitness: "Fitness",
  dental: "Dental",
  real_estate: "Real estate",
  legal: "Legal",
  hospitality: "Hospitality",
  other: "Other",
};

export const PROSPECTING_NICHE_LABELS_HU: Record<ProspectingNiche, string> = {
  beauty: "Szépségipar",
  fitness: "Fitness",
  dental: "Fogászat",
  real_estate: "Ingatlan",
  legal: "Ügyvéd / jog",
  hospitality: "Vendéglátás",
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
  /** The URL we actually requested (after dual-scheme resolution). */
  requested_url?: string;
  /** The URL that finally responded, after redirects. */
  final_url?: string;
  /** True when https:// itself answered (measured, not inferred from the string). */
  https_ok?: boolean;
  /** True when the listed scheme differed from the one that actually served content. */
  scheme_mismatch?: boolean;
  /** True when we retried after a first-attempt network error/timeout. */
  retried?: boolean;
};

// How much we trust a pain signal.
//   "verified"  — measured against the real (rendered / TLS-checked) site.
//   "heuristic" — inferred from a single static-HTML fetch; may be a false
//                 positive on SPAs, consent-gated tags, or JS-injected content.
export type SignalConfidence = "verified" | "heuristic";

export type ProbeMethod = "static_probe" | "rendered_crawl" | "psi";

export type SignalEvidence = {
  requested_url: string;
  final_url: string;
  http_status?: number;
  content_bytes?: number;
  checked_at: string; // ISO
  method: ProbeMethod;
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
  // Optional so pre-existing jsonb rows (written before Lead Scraping 2.0)
  // still satisfy the type. New signals always set both.
  confidence?: SignalConfidence;
  evidence?: SignalEvidence;
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

export type Lead = Omit<
  LeadRow,
  | "source"
  | "status"
  | "enrichment_status"
  | "loss_reason"
  | "package_interest"
  | "email_status"
  | "offer_track"
> & {
  source: LeadSource;
  status: LeadStatus;
  enrichment_status: EnrichmentStatus;
  loss_reason: LossReason | null;
  package_interest: Package | null;
  email_status: EmailStatus | null;
  offer_track: OfferTrack | null;
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
// Outreach machine (Scraping 2.1)
// ---------------------------------------------------------------------

export type OutreachDraftStatus =
  | "draft"
  | "approved"
  | "scheduled"
  | "sent"
  | "skipped";

// Delivery lifecycle for a single send (mutable — lives in outreach_sends,
// NOT email_log which is append-only).
export type OutreachSendStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "unsubscribed"
  | "failed";

export type SuppressionReason =
  | "unsubscribe"
  | "bounce"
  | "complaint"
  | "manual"
  | "invalid";

export type OutreachDraft = Omit<OutreachDraftRow, "track" | "status" | "visual_urls"> & {
  track: OfferTrack;
  status: OutreachDraftStatus;
  visual_urls: string[];
};

export type OutreachSend = Omit<OutreachSendRow, "status"> & {
  status: OutreachSendStatus;
};

export type Suppression = Omit<SuppressionRow, "reason"> & {
  reason: SuppressionReason;
};

export type SendingInbox = SendingInboxRow;

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
