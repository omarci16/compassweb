-- =====================================================================
-- Compass ERP — Phase K: directory lead sources
--
-- Google Maps gives us "businesses with a shopfront in city X". A trade
-- directory gives us a list pre-filtered by profession, including practices
-- whose Maps listing is thin or missing. Same funnel, wider top.
--
-- A directory run reuses the whole existing import path (dedup → contact
-- harvest → verify → score → offer routing); only where the candidates come
-- from differs. These two columns are what carry that difference.
--
-- Additive + idempotent: safe to re-run. `scraping_jobs` already has RLS +
-- set_updated_at from 0002. Existing rows default to the Google Maps path.
-- =====================================================================

-- 'google_maps' | 'directory' — chooses the candidate-collection strategy in
-- the prospecting-process-results Inngest function.
alter table scraping_jobs
  add column if not exists source_type text not null default 'google_maps';

-- Which directory, when source_type = 'directory'. Currently 'fogorvoskereso'.
alter table scraping_jobs add column if not exists source_key text;

-- Directory rows are identified as `<source_key>:<their id>` in
-- leads.gmaps_place_id, which already carries a unique index — so re-running a
-- directory scrape is idempotent for free, exactly like a Maps re-run.
create index if not exists scraping_jobs_source_idx
  on scraping_jobs (source_type, created_at desc);
