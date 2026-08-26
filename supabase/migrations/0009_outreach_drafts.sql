-- =====================================================================
-- Compass ERP — Scraping 2.1: persisted outreach draft queue (Phase D)
--
-- Cold outreach used to live only in ephemeral React state: a draft was
-- generated in a modal and either sent or lost. This table persists every
-- AI-drafted touch so a HUMAN can review + approve it before it is ever sent
-- (CLAUDE.md rule #1 — never auto-send). Phase E's send queue only pulls rows
-- with status='approved'.
--
-- email_log stays append-only (CLAUDE.md rule #4): this is the mutable draft
-- lifecycle; the immutable sent record still goes to email_log at send time.
--
-- Idempotent: safe to re-run.
-- =====================================================================

create table if not exists outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  lead_id uuid references leads(id) on delete cascade not null,

  -- Which pitch this is: needs_site | upgrade | low_priority
  track text not null default 'needs_site',

  -- The reviewable, editable content.
  subject text not null,
  body_html text not null,
  body_text text not null,
  visual_urls jsonb default '[]'::jsonb,
  visual_concept text,

  -- Sequence position (Phase F): touch 1 = first cold email, 2/3 = follow-ups.
  sequence_id uuid,
  touch_number integer not null default 1,

  -- Deliverability: which spintax variant was rendered into the body.
  spintax_variant text,

  -- Lifecycle: draft | approved | scheduled | sent | skipped
  status text not null default 'draft',
  approved_at timestamptz,
  approved_by uuid references auth.users(id),

  -- AI provenance (primary_pain_point_used, hook, tone_notes) for auditing.
  ai_meta jsonb
);

create index if not exists outreach_drafts_status_idx
  on outreach_drafts(status, created_at desc);
create index if not exists outreach_drafts_lead_idx
  on outreach_drafts(lead_id, created_at desc);

-- ---------------------------------------------------------------------
-- RLS — mirrors the rest of the system (auth read all / auth write all)
-- ---------------------------------------------------------------------
alter table outreach_drafts enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'outreach_drafts' and policyname = 'auth read all'
  ) then
    create policy "auth read all" on outreach_drafts
      for select using (auth.role() = 'authenticated');
  end if;
  if not exists (
    select 1 from pg_policies
    where tablename = 'outreach_drafts' and policyname = 'auth write all'
  ) then
    create policy "auth write all" on outreach_drafts
      for all using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;

create or replace trigger outreach_drafts_updated_at before update on outreach_drafts
  for each row execute function set_updated_at();
