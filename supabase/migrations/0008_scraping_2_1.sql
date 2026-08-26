-- =====================================================================
-- Compass ERP — Scraping 2.1: lead contactability + buying signals
--
-- Additive columns on `leads` (all null/false defaults so existing rows keep
-- working). New tables for the outreach machine live in 0009.
--
-- Phase B — free in-code email verification (syntax + DNS MX + disposable/role).
-- Phase C — buying signals (ads / recently-opened) + offer-track routing.
--
-- Idempotent: safe to re-run. `leads` already has RLS + set_updated_at from 0001.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Phase B: email verification
-- ---------------------------------------------------------------------
-- 'valid' | 'risky' | 'invalid' | 'unknown' — see EmailStatus in app.types.ts.
-- Gate: a lead with email_status='invalid' is never queued for sending.
alter table leads add column if not exists email_status text;
alter table leads add column if not exists email_verified boolean default false;
alter table leads add column if not exists email_checked_at timestamptz;

-- ---------------------------------------------------------------------
-- Phase C: buying signals + offer routing
-- ---------------------------------------------------------------------
-- ads_signal jsonb: { runs_ads: boolean, source: 'meta_ad_library', ad_count?: number, checked_at: string }
alter table leads add column if not exists ads_signal jsonb;
-- recently_opened: heuristic "new business" flag (few reviews + high rating).
alter table leads add column if not exists recently_opened boolean default false;
-- offer_track: 'needs_site' | 'upgrade' | 'low_priority' — which pitch to run.
alter table leads add column if not exists offer_track text;

-- Surface sendable, routed cold leads quickly (approval queue / control tower).
create index if not exists leads_offer_track_idx
  on leads(offer_track, win_probability desc)
  where source = 'cold_outreach';

create index if not exists leads_email_status_idx
  on leads(email_status)
  where source = 'cold_outreach';
