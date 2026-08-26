-- =====================================================================
-- Compass ERP — Scraping 2.1: cold follow-up sequences (Phase F)
--
-- Reuses re_engagement_sequences for the cold outreach follow-up cadence
-- (touch 1 → 2 → 3). A `kind` discriminator keeps the two cadences apart:
--   're_engagement' — the 30/60/90-day win-back of leads that went cold
--   'cold_followup' — the 2 nudges after a first cold email
--
-- Existing rows default to 're_engagement' so the current cron is unaffected.
-- Idempotent.
-- =====================================================================

alter table re_engagement_sequences
  add column if not exists kind text not null default 're_engagement';

create index if not exists re_engagement_kind_idx
  on re_engagement_sequences(kind, status, next_touch_at);
