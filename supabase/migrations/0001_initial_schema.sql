-- =====================================================================
-- Compass ERP — initial schema
-- All tables: UUID primary keys, timestamptz, RLS enabled
-- =====================================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. users_profile (mirrors auth.users for display fields)
-- ---------------------------------------------------------------------
create table if not exists users_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  display_name text,
  avatar_initials text,
  role text default 'owner',
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 2. projects (declared early because leads/deals reference it)
-- ---------------------------------------------------------------------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  lead_id uuid,
  deal_id uuid,

  client_name text not null,
  client_email text not null,
  client_company text,

  package text not null,
  agreed_price_huf integer not null,
  monthly_fee_huf integer not null default 25000,

  current_stage integer not null default 0,
  stage_entered_at timestamptz default now(),

  waiting_on text not null default 'us',

  urgency_score integer default 50,
  urgency_factors jsonb,

  blocker text,
  blocker_set_at timestamptz,

  owner_id uuid references auth.users(id),

  contract_signed_at timestamptz,
  deposit_paid_at timestamptz,
  materials_deadline timestamptz,
  materials_received_at timestamptz,
  blueprint_approved_at timestamptz,
  staging_url text,
  staging_sent_at timestamptz,
  revision_deadline timestamptz,
  revision_received_at timestamptz,
  final_payment_at timestamptz,
  launched_at timestamptz,
  launch_url text,

  paused_at timestamptz,
  restart_fee_charged boolean default false,

  portal_token text unique default encode(gen_random_bytes(32), 'hex'),
  portal_last_viewed_at timestamptz,

  blueprint_data jsonb,

  internal_notes text
);

-- ---------------------------------------------------------------------
-- 3. leads
-- ---------------------------------------------------------------------
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  company_name text not null,
  contact_name text,
  email text,
  phone text,
  website_url text,

  source text not null,
  niche text,
  package_interest text,

  budget_confirmed boolean default false,
  decision_maker_confirmed boolean default false,
  has_existing_website boolean,
  existing_website_url text,
  timeline_weeks integer,

  win_probability integer,
  win_probability_reasons jsonb,
  enrichment_data jsonb,
  enrichment_status text default 'pending',
  enrichment_summary text,

  status text not null default 'new',

  first_contact_at timestamptz,
  speed_to_lead_minutes integer,

  internal_notes text,
  loss_reason text,
  loss_notes text,

  assigned_to uuid references auth.users(id),
  converted_to_project_id uuid references projects(id)
);

-- ---------------------------------------------------------------------
-- 4. deals
-- ---------------------------------------------------------------------
create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  lead_id uuid references leads(id) on delete cascade not null,

  stage text not null default 'concept_pending',

  vercel_preview_url text,
  vercel_preview_attached_at timestamptz,
  vercel_preview_attached_by uuid references auth.users(id),

  proposed_package text,
  proposed_price_huf integer,
  monthly_fee_huf integer,
  proposal_draft text,
  proposal_sent_at timestamptz,

  urgency_score integer,
  last_client_contact_at timestamptz,
  next_followup_at timestamptz,
  followup_count integer default 0,

  assigned_to uuid references auth.users(id),

  internal_notes text
);

-- Late FK back-references now that both tables exist
alter table projects
  add constraint projects_lead_id_fkey
  foreign key (lead_id) references leads(id) on delete set null;

alter table projects
  add constraint projects_deal_id_fkey
  foreign key (deal_id) references deals(id) on delete set null;

-- ---------------------------------------------------------------------
-- 5. project_stage_history
-- ---------------------------------------------------------------------
create table if not exists project_stage_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  from_stage integer,
  to_stage integer not null,
  changed_at timestamptz default now(),
  changed_by uuid references auth.users(id),
  notes text
);

-- ---------------------------------------------------------------------
-- 6. assets
-- ---------------------------------------------------------------------
create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  project_id uuid references projects(id) on delete cascade not null,

  type text not null,
  label text,
  file_path text,
  file_name text,
  file_size_bytes integer,
  mime_type text,
  external_url text,

  approval_status text default 'pending',
  notes text,
  uploaded_by text
);

-- ---------------------------------------------------------------------
-- 7. invoices
-- ---------------------------------------------------------------------
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  project_id uuid references projects(id) on delete cascade not null,

  type text not null,
  amount_huf integer not null,
  amount_net_huf integer,
  vat_rate numeric default 0.27,

  status text not null default 'draft',

  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,

  invoice_number text,
  notes text,
  pdf_path text
);

-- ---------------------------------------------------------------------
-- 8. email_log
-- ---------------------------------------------------------------------
create table if not exists email_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),

  lead_id uuid references leads(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  project_id uuid references projects(id) on delete set null,

  direction text not null,
  from_address text not null,
  to_address text not null,
  subject text not null,
  body_text text,
  body_html text,

  sent_at timestamptz,
  resend_message_id text,

  type text,
  ai_drafted boolean default false
);

-- ---------------------------------------------------------------------
-- 9. re_engagement_sequences
-- ---------------------------------------------------------------------
create table if not exists re_engagement_sequences (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  lead_id uuid references leads(id) on delete cascade not null,

  status text default 'active',
  next_touch_at timestamptz,
  touch_count integer default 0,
  last_touch_at timestamptz,
  last_touch_type text
);

-- ---------------------------------------------------------------------
-- 10. templates
-- ---------------------------------------------------------------------
create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  name text not null,
  niche text,
  subject text,
  body text not null,
  variables jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------
create index if not exists leads_status_score_idx on leads(status, win_probability desc);
create index if not exists leads_created_idx on leads(created_at desc);
create index if not exists deals_stage_urgency_idx on deals(stage, urgency_score desc);
create index if not exists projects_stage_urgency_idx on projects(current_stage, urgency_score desc);
create index if not exists projects_owner_stage_idx on projects(owner_id, current_stage);
create index if not exists projects_portal_token_idx on projects(portal_token);
create index if not exists email_log_lead_idx on email_log(lead_id, created_at desc);
create index if not exists email_log_project_idx on email_log(project_id, created_at desc);
create index if not exists invoices_project_status_idx on invoices(project_id, status);
create index if not exists invoices_status_due_idx on invoices(status, due_at);

-- ---------------------------------------------------------------------
-- Updated_at trigger
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger leads_updated_at before update on leads
  for each row execute function set_updated_at();
create trigger deals_updated_at before update on deals
  for each row execute function set_updated_at();
create trigger projects_updated_at before update on projects
  for each row execute function set_updated_at();
create trigger templates_updated_at before update on templates
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- RLS — internal two-person tool, all authenticated users read/write everything
-- ---------------------------------------------------------------------
alter table users_profile enable row level security;
alter table leads enable row level security;
alter table deals enable row level security;
alter table projects enable row level security;
alter table project_stage_history enable row level security;
alter table assets enable row level security;
alter table invoices enable row level security;
alter table email_log enable row level security;
alter table re_engagement_sequences enable row level security;
alter table templates enable row level security;

create policy "auth read all" on users_profile for select using (auth.role() = 'authenticated');
create policy "auth write all" on users_profile for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "auth read all" on leads for select using (auth.role() = 'authenticated');
create policy "auth write all" on leads for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "auth read all" on deals for select using (auth.role() = 'authenticated');
create policy "auth write all" on deals for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "auth read all" on projects for select using (auth.role() = 'authenticated');
create policy "auth write all" on projects for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "auth read all" on project_stage_history for select using (auth.role() = 'authenticated');
create policy "auth write all" on project_stage_history for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "auth read all" on assets for select using (auth.role() = 'authenticated');
create policy "auth write all" on assets for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "auth read all" on invoices for select using (auth.role() = 'authenticated');
create policy "auth write all" on invoices for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "auth read all" on email_log for select using (auth.role() = 'authenticated');
create policy "auth insert all" on email_log for insert with check (auth.role() = 'authenticated');
-- email_log is append-only — no update/delete policies

create policy "auth read all" on re_engagement_sequences for select using (auth.role() = 'authenticated');
create policy "auth write all" on re_engagement_sequences for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "auth read all" on templates for select using (auth.role() = 'authenticated');
create policy "auth write all" on templates for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
