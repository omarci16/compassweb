-- =====================================================================
-- Compass ERP — pain intelligence
-- Adds tech-stack detection, pain signals, AI-generated audit, and
-- a typed "what we sell against" view for cold outreach personalisation.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extend leads with pain intelligence
-- ---------------------------------------------------------------------

-- Tech stack signals detected from the homepage HTML.
-- Shape: {
--   cms?: string,            -- 'wordpress' | 'wix' | 'squarespace' | 'webflow' | 'shopify' | 'custom' | null
--   ecommerce?: string,      -- 'shopify' | 'woocommerce' | 'unas' | 'shoprenter' | null
--   analytics?: string[],    -- ['ga4', 'gtm', 'meta_pixel', 'hotjar', 'matomo']
--   booking?: string,        -- 'calendly' | 'simplybook' | 'salonized' | 'booksy' | null
--   has_blog?: boolean,
--   has_schema_org?: boolean,
--   has_open_graph?: boolean,
--   has_viewport_meta?: boolean,
--   has_https?: boolean,
--   has_contact_form?: boolean,
--   has_sitemap?: boolean
-- }
alter table leads add column if not exists tech_stack jsonb;

-- Detected pain signals, in priority order. Each entry:
-- { code: string, severity: 'low'|'medium'|'high', label_hu: string, label_en: string }
alter table leads add column if not exists pain_signals jsonb;

-- AI-generated audit paragraph (Hungarian, 3–5 specific findings).
alter table leads add column if not exists pain_audit text;
alter table leads add column if not exists pain_audit_generated_at timestamptz;

-- ---------------------------------------------------------------------
-- Source effectiveness: we compute this on the fly from leads joined on
-- scraping_job_id. No denormalised columns — keeps data integrity simple.
-- ---------------------------------------------------------------------

-- Helpful index for the source-effectiveness join.
create index if not exists leads_scraping_job_status_idx
  on leads(scraping_job_id, status)
  where scraping_job_id is not null;
