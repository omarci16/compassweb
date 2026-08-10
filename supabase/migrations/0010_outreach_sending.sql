-- =====================================================================
-- Compass ERP — Scraping 2.1: sending infrastructure (Phase E)
--
-- Owns deliverability: rotated inboxes with per-inbox daily caps + warmup, a
-- mutable per-send lifecycle table (opens/bounces/complaints), and a suppression
-- list. email_log stays APPEND-ONLY (CLAUDE.md rule #4) — the immutable sent
-- record still goes there; all mutable delivery state lives in outreach_sends.
--
-- Idempotent: safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- sending_inboxes — the addresses we rotate cold sends across
-- ---------------------------------------------------------------------
create table if not exists sending_inboxes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  address text not null unique,
  from_name text,
  daily_cap integer not null default 30,
  -- null = no warmup ramp (send straight at daily_cap). Set to the day warmup
  -- began to ramp 5/day → +5/week up to daily_cap.
  warmup_started_at timestamptz,
  active boolean not null default true
);

-- ---------------------------------------------------------------------
-- outreach_sends — mutable delivery lifecycle for one sent email
-- ---------------------------------------------------------------------
create table if not exists outreach_sends (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  draft_id uuid references outreach_drafts(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  inbox text,
  resend_message_id text,
  -- queued | sent | delivered | opened | clicked | bounced | complained | unsubscribed | failed
  status text not null default 'sent',
  to_address text not null,
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  unsubscribed_at timestamptz,
  error_message text
);

create index if not exists outreach_sends_status_idx on outreach_sends(status, created_at desc);
create index if not exists outreach_sends_msgid_idx on outreach_sends(resend_message_id);
-- Per-inbox daily cap counting.
create index if not exists outreach_sends_inbox_sent_idx on outreach_sends(inbox, sent_at);

-- ---------------------------------------------------------------------
-- suppression_list — never contact these again
-- ---------------------------------------------------------------------
create table if not exists suppression_list (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  email text,
  domain text,
  reason text not null,   -- unsubscribe | bounce | complaint | manual | invalid
  notes text
);

create unique index if not exists suppression_email_idx
  on suppression_list(lower(email)) where email is not null;
create index if not exists suppression_domain_idx
  on suppression_list(lower(domain)) where domain is not null;

-- ---------------------------------------------------------------------
-- RLS (auth read all / auth write all) — mirrors the rest of the system
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['sending_inboxes','outreach_sends','suppression_list']
  loop
    execute format('alter table %I enable row level security', t);
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'auth read all') then
      execute format('create policy "auth read all" on %I for select using (auth.role() = ''authenticated'')', t);
    end if;
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'auth write all') then
      execute format('create policy "auth write all" on %I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')', t);
    end if;
  end loop;
end $$;

create or replace trigger sending_inboxes_updated_at before update on sending_inboxes
  for each row execute function set_updated_at();
create or replace trigger outreach_sends_updated_at before update on outreach_sends
  for each row execute function set_updated_at();
