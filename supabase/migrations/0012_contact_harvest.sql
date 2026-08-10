-- =====================================================================
-- Compass ERP — Phase I: contact harvesting
--
-- Mines emails / phones / social profiles out of HTML the pipeline ALREADY
-- downloads (the static probe in site-analyzer, plus the rendered Apify crawl
-- in verify-website). No new network calls, no AI, no new services.
--
-- Why it matters: Google Maps rarely carries an email, and a lead we cannot
-- reach is worth nothing regardless of how well it scores. These columns record
-- every channel we found and where the primary one came from.
--
-- Additive + idempotent: safe to re-run. `leads` already has RLS +
-- set_updated_at from 0001. Existing rows keep working (all nullable).
-- =====================================================================

-- Ranked candidates, best first. Shape (DiscoveredEmail in contact-extract.ts):
--   [{ email, rank, kind: 'personal'|'role'|'freemail', own_domain, from_mailto }]
-- The lead's `email` column holds the winner; this keeps the alternates so a
-- human can pick differently without a re-scrape.
alter table leads add column if not exists discovered_emails jsonb;

-- Normalised Hungarian numbers, e.g. ["+36 30 123 4567"]. Distinct from
-- gmaps_phone: these come from the site itself and often reach a person.
alter table leads add column if not exists discovered_phones jsonb;

-- Provenance of `leads.email`: 'gmaps' | 'website' | 'manual'.
-- Drives the "honnan" badge in the lead detail contact card, and lets us
-- measure how many addresses harvesting added on top of Google Maps.
alter table leads add column if not exists contact_source text;

-- Discovered social profiles merge into the EXISTING leads.social_links column
-- (same shape), so they also feed social_links_count in the cold-lead scorer.
-- No new column needed for those.

-- Contactability is the funnel stage this phase exists to lift, and the leads
-- list filters on it constantly.
create index if not exists leads_contactability_idx
  on leads (email_status, contact_source)
  where status = 'new';
