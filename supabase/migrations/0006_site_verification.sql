-- =====================================================================
-- Compass ERP — site verification (Lead Scraping 2.0, Phase 2)
--
-- The cheap static probe (site-analyzer.ts) can be wrong on modern sites
-- (SPAs, consent-gated tags, redirects). Before a high-severity claim goes
-- into a pain audit or a cold email, we verify it against the RENDERED final
-- URL via Google PageSpeed Insights (Lighthouse: is-on-https, viewport,
-- performance + a screenshot) and optionally a rendered Apify crawl.
--
-- These columns record the verification result + a homepage screenshot so a
-- human can eyeball the real site before trusting the audit.
-- =====================================================================

-- Public URL of the rendered homepage screenshot (from PSI's final-screenshot).
alter table leads add column if not exists website_screenshot_url text;

-- When verification last ran. NULL = never verified (static probe only).
alter table leads add column if not exists website_verified_at timestamptz;

-- Verification payload. Shape:
-- {
--   method: 'psi' | 'rendered_crawl',
--   final_url: string,
--   psi_performance?: number,     -- 0..1 Lighthouse performance score
--   psi_https_ok?: boolean,       -- audits['is-on-https'].score === 1
--   psi_viewport_ok?: boolean,    -- audits['viewport'].score === 1
--   crawl_run_id?: string,
--   checked_at: string            -- ISO
-- }
alter table leads add column if not exists website_verification jsonb;

-- Speeds up "which cold leads still need verification" scans.
create index if not exists leads_verify_pending_idx
  on leads(scraping_job_id, win_probability desc)
  where source = 'cold_outreach' and website_verified_at is null;

-- ---------------------------------------------------------------------
-- Screenshot storage bucket (public read; mirrors 0005_outreach_visuals).
-- Public so the lead detail page + outreach preview can <img src> it.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-screenshots',
  'site-screenshots',
  true,
  5242880, -- 5 MB per screenshot
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'site_screenshots_public_read'
  ) then
    create policy "site_screenshots_public_read"
      on storage.objects for select
      using (bucket_id = 'site-screenshots');
  end if;
end $$;
