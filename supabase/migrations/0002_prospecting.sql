-- =====================================================================
-- Compass ERP — prospecting engine
-- Adds scraping_jobs table + extends leads with cold-source provenance,
-- Google Maps signals, and website-health fields.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. scraping_jobs — one row per scrape run
-- ---------------------------------------------------------------------
create table if not exists scraping_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Targeting
  niche text not null,                -- 'beauty' | 'fitness' | 'dental' | 'real_estate' | 'other'
  search_terms text[] not null,       -- raw search strings sent to Apify
  city text not null,                 -- 'Budapest' | 'Debrecen' | 'Hungary' | etc.
  country text not null default 'Hungary',
  max_results integer not null default 200,

  -- Apify
  apify_run_id text,
  apify_dataset_id text,
  apify_actor_id text not null default 'compass/crawler-google-places',

  -- Lifecycle
  status text not null default 'queued',
  -- 'queued' | 'running' | 'collecting' | 'processing' | 'complete' | 'failed' | 'cancelled'
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,

  -- Outcome metrics
  total_scraped integer default 0,    -- raw count from Apify
  total_duplicates integer default 0, -- skipped by dedupe
  total_imported integer default 0,   -- created as leads
  total_top_tier integer default 0,   -- leads with rule score >= threshold
  estimated_cost_usd numeric(8, 4),   -- Apify cost estimate

  -- Audit
  triggered_by uuid references auth.users(id),
  notes text
);

create index if not exists scraping_jobs_status_idx on scraping_jobs(status, created_at desc);
create index if not exists scraping_jobs_niche_city_idx on scraping_jobs(niche, city, created_at desc);

-- ---------------------------------------------------------------------
-- 2. Extend leads with prospecting metadata
-- All additive — existing rows keep working with NULLs.
-- ---------------------------------------------------------------------
alter table leads add column if not exists scraping_job_id uuid references scraping_jobs(id) on delete set null;

-- Google Maps signals (only populated for cold-sourced leads)
alter table leads add column if not exists gmaps_place_id text;
alter table leads add column if not exists gmaps_category text;
alter table leads add column if not exists gmaps_address text;
alter table leads add column if not exists gmaps_city text;
alter table leads add column if not exists gmaps_rating numeric(3, 2);
alter table leads add column if not exists gmaps_review_count integer;
alter table leads add column if not exists gmaps_phone text;
alter table leads add column if not exists gmaps_url text;
alter table leads add column if not exists social_links jsonb;
-- jsonb shape: { instagram?: string, facebook?: string, linkedin?: string, tiktok?: string }

-- Website health (populated by health-check probe)
alter table leads add column if not exists website_health_status text;
-- 'no_website' | 'healthy' | 'broken' | 'redirect_social' | 'tiny' | 'stale' | 'unknown'
alter table leads add column if not exists website_health_checked_at timestamptz;
alter table leads add column if not exists website_health_details jsonb;
-- jsonb shape: { http_status?: number, response_ms?: number, body_size?: number, redirect_to?: string, last_modified?: string }

-- Dedup key: unique-ish identity. We dedupe in code but a partial unique index
-- on gmaps_place_id prevents accidental dupes from a re-run.
create unique index if not exists leads_gmaps_place_unique
  on leads(gmaps_place_id)
  where gmaps_place_id is not null;

-- ---------------------------------------------------------------------
-- 3. RLS for scraping_jobs (mirrors the rest of the system)
-- ---------------------------------------------------------------------
alter table scraping_jobs enable row level security;

create policy "auth read all" on scraping_jobs
  for select using (auth.role() = 'authenticated');

create policy "auth write all" on scraping_jobs
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------
-- 4. updated_at trigger for scraping_jobs
-- ---------------------------------------------------------------------
create trigger scraping_jobs_updated_at before update on scraping_jobs
  for each row execute function set_updated_at();
