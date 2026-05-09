# CLAUDE.md — Compass Internal ERP
## Strict Build Guidelines for Claude Code

> This document is the single source of truth for building the Compass internal ERP system.
> Read every section before writing a single line of code. Re-read the relevant section before
> starting each module. Never deviate from these guidelines without explicitly noting why.

---

## 0. WHO WE ARE AND WHAT WE'RE BUILDING

**Compass Marketing Kft.** is a two-person AI-native digital agency based in Hungary, currently
operating one active pillar (web development) with two more in development (content automation,
agentic automations). The founders are Richárd (CEO/client-facing) and his business partner
(technical/build-side).

We are building a **full internal ERP** — not a simple CRM, not a project management tool. This
system replaces manual coordination, eliminates ad-hoc communication overhead, and creates a
**factory-grade operational backbone** that is explicitly designed to:

1. Run the web development pillar end-to-end today
2. Be cloned and adapted for pillars 2 and 3 when they launch
3. Become self-improving through AI scoring and data feedback loops

The system has **three zones** and one **horizontal intelligence backbone**:

- **Zone 1 — Acquisition**: Lead capture, enrichment, qualification, speed-to-lead
- **Zone 2 — Conversion**: Pipeline board, visual delivery, proposal drafting, cold archive
- **Zone 3 — Execution**: Project tracker (stages 0–7), client portal, asset management, invoicing
- **Intelligence Backbone**: Win scoring, smart urgency, performance analytics, template bank

The web interface lives at `https://compass-weboldal.vercel.app/` and already has a proposal/contract
UI (Árajánlat). This ERP is a **separate internal tool** — it is not client-facing, except for the
client portal sub-view.

---

## 1. TECH STACK — LOCKED, NO SUBSTITUTIONS

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript — strict mode, no `any` types without explicit justification comment
- **Styling**: Tailwind CSS v3 — no inline styles except for dynamic values impossible in Tailwind
- **UI Components**: shadcn/ui — install components as needed, do not pre-install everything
- **Icons**: Lucide React — no other icon library
- **State management**: Zustand for global state, React Query (TanStack Query v5) for server state
- **Forms**: React Hook Form + Zod for validation
- **Drag and drop**: @dnd-kit/core + @dnd-kit/sortable (not react-beautiful-dnd, it's unmaintained)
- **Date handling**: date-fns — never use moment.js
- **Rich text**: Tiptap (for proposal editor)
- **Charts**: Recharts

### Backend
- **Runtime**: Next.js API Routes (App Router, Route Handlers)
- **Database**: Supabase (PostgreSQL) — use Supabase client, never raw pg
- **Auth**: Supabase Auth — email/password only, two users (Richárd + partner), no public registration
- **File storage**: Supabase Storage — for client assets, logos, brand files
- **Real-time**: Supabase Realtime for project status updates across both users
- **Background jobs**: Inngest — for async AI tasks, scheduled follow-ups, re-engagement triggers
- **Email**: Resend — for all outbound email (proposals, follow-ups, client notifications)
- **PDF generation**: Puppeteer via API route — for proposal PDF export

### AI & Integrations
- **Primary AI**: Anthropic Claude API (`claude-sonnet-4-20250514`) — for all AI features
- **Web scraping / enrichment**: Apify — specifically the Website Content Crawler and Company Enrichment actors
- **MCP integrations**: As described in Section 9 — configured via Claude Code MCP setup
- **Deployment**: Vercel — same account as the public website

### Development
- **Package manager**: pnpm
- **Linting**: ESLint with Next.js config + Prettier
- **Testing**: Vitest for unit tests on scoring/sorting logic (critical business logic must be tested)
- **Environment**: `.env.local` for local, Vercel environment variables for production

---

## 2. PROJECT STRUCTURE

```
compass-erp/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                    # Sidebar nav, auth guard
│   │   ├── page.tsx                      # Dashboard home / daily briefing
│   │   ├── leads/
│   │   │   ├── page.tsx                  # Lead capture + qualified leads list
│   │   │   └── [id]/
│   │   │       └── page.tsx              # Individual lead detail
│   │   ├── pipeline/
│   │   │   ├── page.tsx                  # Pipeline board (kanban)
│   │   │   └── [id]/
│   │   │       └── page.tsx              # Deal detail
│   │   ├── projects/
│   │   │   ├── page.tsx                  # Project tracker (kanban + table toggle)
│   │   │   └── [id]/
│   │   │       ├── page.tsx              # Project detail
│   │   │       └── portal/
│   │   │           └── page.tsx          # Client portal preview
│   │   ├── archive/
│   │   │   └── page.tsx                  # Cold archive + re-engagement
│   │   ├── outreach/
│   │   │   └── page.tsx                  # Outreach engine + email log
│   │   ├── revenue/
│   │   │   └── page.tsx                  # Revenue & retainer dashboard
│   │   └── intelligence/
│   │       └── page.tsx                  # Analytics + performance data
│   ├── api/
│   │   ├── leads/
│   │   │   ├── route.ts                  # POST: create lead
│   │   │   └── enrich/
│   │   │       └── route.ts              # POST: trigger Apify enrichment
│   │   ├── ai/
│   │   │   ├── score/
│   │   │   │   └── route.ts              # POST: score a lead
│   │   │   ├── draft-proposal/
│   │   │   │   └── route.ts              # POST: draft proposal email + quote
│   │   │   ├── draft-followup/
│   │   │   │   └── route.ts              # POST: draft follow-up email
│   │   │   └── blueprint/
│   │   │       └── route.ts              # POST: generate WPP blueprint
│   │   ├── projects/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       └── stage/
│   │   │           └── route.ts          # PATCH: advance stage with gate check
│   │   ├── invoices/
│   │   │   └── route.ts
│   │   ├── email/
│   │   │   ├── send/
│   │   │   │   └── route.ts              # POST: send email via Resend
│   │   │   └── log/
│   │   │       └── route.ts              # POST: log inbound email (webhook)
│   │   ├── portal/
│   │   │   └── [token]/
│   │   │       └── route.ts              # GET: client portal data (public, token-auth)
│   │   └── webhooks/
│   │       ├── apify/
│   │       │   └── route.ts              # POST: Apify job completion webhook
│   │       └── inngest/
│   │           └── route.ts              # POST: Inngest function handler
│   └── portal/
│       └── [token]/
│           └── page.tsx                  # Public client portal (separate from auth)
├── components/
│   ├── ui/                               # shadcn/ui components (auto-generated)
│   ├── leads/
│   │   ├── LeadCard.tsx
│   │   ├── LeadScoreBadge.tsx
│   │   ├── SpeedToLeadTimer.tsx
│   │   └── EnrichmentStatus.tsx
│   ├── pipeline/
│   │   ├── PipelineBoard.tsx             # Kanban board (dnd-kit)
│   │   ├── DealCard.tsx
│   │   ├── VisualDropZone.tsx            # Drag Vercel URL → auto-attach
│   │   └── ProposalDraftModal.tsx
│   ├── projects/
│   │   ├── ProjectKanban.tsx
│   │   ├── ProjectTable.tsx
│   │   ├── StageGateGuard.tsx
│   │   ├── UrgencyIndicator.tsx
│   │   ├── WaitingOnBadge.tsx            # US | CLIENT indicator
│   │   ├── BlockerField.tsx
│   │   └── OwnerAvatar.tsx
│   ├── portal/
│   │   ├── PortalProgress.tsx
│   │   ├── PortalChecklist.tsx
│   │   └── PortalInvoiceStatus.tsx
│   ├── revenue/
│   │   ├── MRRCard.tsx
│   │   ├── InvoiceRow.tsx
│   │   └── RetainerCard.tsx
│   ├── intelligence/
│   │   ├── WinRateChart.tsx
│   │   ├── NicheBreakdown.tsx
│   │   └── SourceEffectiveness.tsx
│   ├── shared/
│   │   ├── AIActionButton.tsx            # Consistent AI-triggered action button
│   │   ├── EmailLogItem.tsx
│   │   ├── TimelineEvent.tsx
│   │   └── EmptyState.tsx
│   └── layout/
│       ├── Sidebar.tsx
│       ├── TopBar.tsx
│       └── DailyBriefing.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                     # Browser Supabase client
│   │   ├── server.ts                     # Server Supabase client (cookies)
│   │   └── middleware.ts                 # Auth middleware
│   ├── ai/
│   │   ├── anthropic.ts                  # Anthropic client singleton
│   │   ├── prompts/
│   │   │   ├── score-lead.ts             # Lead scoring prompt
│   │   │   ├── draft-proposal.ts         # Proposal drafting prompt
│   │   │   ├── draft-followup.ts         # Follow-up drafting prompt
│   │   │   ├── generate-blueprint.ts     # WPP blueprint generation
│   │   │   └── enrich-summary.ts         # Summarise Apify enrichment data
│   │   └── scoring/
│   │       ├── win-probability.ts        # Win probability calculator (tested)
│   │       └── urgency-score.ts          # Urgency score calculator (tested)
│   ├── apify/
│   │   ├── client.ts                     # Apify client wrapper
│   │   └── actors.ts                     # Actor IDs and input schemas
│   ├── resend/
│   │   └── client.ts                     # Resend client + email templates
│   ├── inngest/
│   │   ├── client.ts
│   │   └── functions/
│   │       ├── re-engagement.ts          # 30/60/90 day follow-up sequences
│   │       ├── speed-to-lead.ts          # Alert if lead uncontacted >2h
│   │       └── stage-reminder.ts         # Alert if stage stuck >N days
│   ├── utils/
│   │   ├── format.ts                     # Currency (HUF), date, percentage formatters
│   │   ├── portal-token.ts               # Client portal token generation/validation
│   │   └── stage-gates.ts               # Stage gate validation logic
│   └── types/
│       ├── database.types.ts             # Auto-generated from Supabase (supabase gen types)
│       └── app.types.ts                  # Application-level types
├── inngest.ts                            # Inngest function registrations
├── middleware.ts                         # Next.js middleware (auth)
├── supabase/
│   └── migrations/                       # SQL migration files, numbered
├── .env.local.example
├── CLAUDE.md                             # This file
└── package.json
```

---

## 3. DATABASE SCHEMA (SUPABASE / POSTGRESQL)

Every table uses UUID primary keys. All timestamps are `timestamptz`. RLS (Row Level Security)
must be enabled on every table. Since this is a two-person internal tool, the RLS policy is
simple: authenticated users can read/write all rows. No per-user data isolation needed.

### 3.1 `leads` table
```sql
create table leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Identity
  company_name text not null,
  contact_name text,
  email text,
  phone text,
  website_url text,

  -- Classification
  source text not null, -- 'instagram_dm' | 'referral' | 'cold_outreach' | 'inbound_form' | 'other'
  niche text,           -- 'restaurant' | 'dentist' | 'law_firm' | 'e-commerce' | etc.
  package_interest text, -- 'landing' | 'business' | 'ecommerce' | null (unknown)

  -- Qualification signals
  budget_confirmed boolean default false,
  decision_maker_confirmed boolean default false,
  has_existing_website boolean,
  existing_website_url text,
  timeline_weeks integer,         -- How many weeks until they want it live

  -- AI scoring
  win_probability integer,        -- 0-100, calculated by AI + rules
  win_probability_reasons jsonb,  -- Array of reason strings
  enrichment_data jsonb,          -- Raw Apify enrichment result
  enrichment_status text default 'pending', -- 'pending' | 'running' | 'complete' | 'failed'
  enrichment_summary text,        -- AI-generated plain-text summary of enrichment

  -- Funnel state
  status text not null default 'new',
  -- 'new' | 'enriching' | 'qualified' | 'visual_sent' | 'proposal_sent' |
  -- 'negotiating' | 'won' | 'lost' | 'archived'

  -- Speed-to-lead
  first_contact_at timestamptz,   -- When we first replied (null = not yet)
  speed_to_lead_minutes integer,  -- Calculated on first_contact_at set

  -- Notes
  internal_notes text,
  loss_reason text,               -- 'price' | 'timing' | 'competitor' | 'no_response' | 'out_of_scope' | 'other'
  loss_notes text,

  -- Relations
  assigned_to uuid references auth.users(id),
  converted_to_project_id uuid references projects(id)
);
```

### 3.2 `deals` table
```sql
create table deals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  lead_id uuid references leads(id) not null,

  -- Stage in conversion funnel
  stage text not null default 'concept_pending',
  -- 'concept_pending' | 'concept_ready' | 'visual_sent' | 'proposal_sent' |
  -- 'negotiating' | 'closed_won' | 'closed_lost'

  -- Visual / concept
  vercel_preview_url text,
  vercel_preview_attached_at timestamptz,
  vercel_preview_attached_by uuid references auth.users(id),

  -- Proposal
  proposed_package text,          -- 'landing' | 'business' | 'ecommerce'
  proposed_price_huf integer,
  monthly_fee_huf integer,
  proposal_draft text,            -- AI-drafted email body (Tiptap JSON or plain text)
  proposal_sent_at timestamptz,

  -- Urgency & sorting
  urgency_score integer,          -- 0-100, recalculated on update
  last_client_contact_at timestamptz,
  next_followup_at timestamptz,
  followup_count integer default 0,

  -- Assignment
  assigned_to uuid references auth.users(id),

  internal_notes text
);
```

### 3.3 `projects` table
```sql
create table projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  lead_id uuid references leads(id),
  deal_id uuid references deals(id),

  -- Client info (denormalized for quick access)
  client_name text not null,
  client_email text not null,
  client_company text,

  -- Package
  package text not null,          -- 'landing' | 'business' | 'ecommerce'
  agreed_price_huf integer not null,
  monthly_fee_huf integer not null default 25000,

  -- Pipeline stage (mirrors the 7-stage process)
  current_stage integer not null default 0,
  -- 0: lead_qualified | 1: discovery_complete | 2: contract_signed |
  -- 3: materials_intake | 4: blueprint_build | 5: revision | 6: payment_launch | 7: retainer

  stage_entered_at timestamptz default now(),
  days_in_current_stage integer generated always as
    (extract(day from now() - stage_entered_at)::integer) stored,

  -- Waiting on
  waiting_on text not null default 'us',  -- 'us' | 'client'

  -- Urgency (recalculated by Inngest nightly)
  urgency_score integer default 50,
  urgency_factors jsonb,          -- Breakdown of what's driving urgency

  -- Blocker
  blocker text,                   -- Free text: what is stuck right now
  blocker_set_at timestamptz,

  -- Assignment
  owner_id uuid references auth.users(id),

  -- Key dates
  contract_signed_at timestamptz,
  deposit_paid_at timestamptz,
  materials_deadline timestamptz, -- contract_signed_at + 7 days
  materials_received_at timestamptz,
  blueprint_approved_at timestamptz,
  staging_url text,
  staging_sent_at timestamptz,
  revision_deadline timestamptz,  -- staging_sent_at + 5 working days
  revision_received_at timestamptz,
  final_payment_at timestamptz,
  launched_at timestamptz,
  launch_url text,

  -- Restart fee
  paused_at timestamptz,
  restart_fee_charged boolean default false,

  -- Portal
  portal_token text unique default encode(gen_random_bytes(32), 'hex'),
  portal_last_viewed_at timestamptz,

  -- Blueprint
  blueprint_data jsonb,           -- Full WPP blueprint JSON

  internal_notes text
);
```

### 3.4 `project_stage_history` table
```sql
create table project_stage_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) not null,
  from_stage integer,
  to_stage integer not null,
  changed_at timestamptz default now(),
  changed_by uuid references auth.users(id),
  notes text
);
```

### 3.5 `assets` table
```sql
create table assets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  project_id uuid references projects(id) not null,

  type text not null,
  -- 'logo' | 'brand_colors' | 'typography' | 'photo' | 'product_photo' |
  -- 'team_photo' | 'copy_text' | 'brand_book' | 'reference_site' | 'competitor_site' | 'other'

  label text,                     -- Human-readable label
  file_path text,                 -- Supabase Storage path
  file_name text,
  file_size_bytes integer,
  mime_type text,
  external_url text,              -- For reference/competitor sites (no file)

  approval_status text default 'pending', -- 'pending' | 'approved' | 'needs_revision'
  notes text,

  uploaded_by text                -- 'client' | 'team'
);
```

### 3.6 `invoices` table
```sql
create table invoices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  project_id uuid references projects(id) not null,

  type text not null,             -- 'deposit' | 'final' | 'monthly' | 'change_order' | 'restart_fee'
  amount_huf integer not null,
  amount_net_huf integer,         -- Without VAT
  vat_rate numeric default 0.27,

  status text not null default 'draft', -- 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'

  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,

  invoice_number text,
  notes text,
  pdf_path text                   -- Supabase Storage path for generated PDF
);
```

### 3.7 `email_log` table
```sql
create table email_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),

  lead_id uuid references leads(id),
  deal_id uuid references deals(id),
  project_id uuid references projects(id),

  direction text not null,        -- 'outbound' | 'inbound'
  from_address text not null,
  to_address text not null,
  subject text not null,
  body_text text,
  body_html text,

  sent_at timestamptz,
  resend_message_id text,         -- For tracking delivery

  type text,
  -- 'proposal' | 'follow_up' | 'contract' | 'invoice' | 'staging_delivery' |
  -- 're_engagement' | 'general'

  ai_drafted boolean default false
);
```

### 3.8 `re_engagement_sequences` table
```sql
create table re_engagement_sequences (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  lead_id uuid references leads(id) not null,

  status text default 'active',   -- 'active' | 'paused' | 'converted' | 'unsubscribed'
  next_touch_at timestamptz,
  touch_count integer default 0,
  last_touch_at timestamptz,
  last_touch_type text            -- '30_day' | '60_day' | '90_day' | 'custom'
);
```

### 3.9 `users_profile` table
```sql
create table users_profile (
  id uuid primary key references auth.users(id),
  full_name text not null,
  display_name text,              -- 'Richard' or 'Partner'
  avatar_initials text,           -- 'RB' or 'Partner initials'
  role text default 'owner'
);
```

### 3.10 Required indexes
```sql
-- Performance-critical queries
create index on leads(status, win_probability desc);
create index on leads(created_at desc);
create index on deals(stage, urgency_score desc);
create index on projects(current_stage, urgency_score desc);
create index on projects(owner_id, current_stage);
create index on projects(portal_token);
create index on email_log(lead_id, created_at desc);
create index on email_log(project_id, created_at desc);
create index on invoices(project_id, status);
create index on invoices(status, due_at);
```

---

## 4. ZONE 1 — LEAD CAPTURE MODULE

### 4.1 Purpose
Capture every incoming inquiry from any channel, enrich it automatically, qualify it against
our criteria, and surface the highest-probability leads at the top of the pipeline.

### 4.2 Lead entry sources

**Manual entry** (primary for now): A quick-add form in the ERP dashboard sidebar. Fields:
- Company name (required)
- Contact name
- Email (required)
- Phone
- Source: dropdown (Instagram DM / Referral / Cold Outreach / Inbound Form / Other)
- Website URL
- Niche: text input with autocomplete from historical niches
- Package interest: dropdown (Landing / Business / E-commerce / Unknown)
- Budget confirmed: toggle
- Decision-maker confirmed: toggle
- Timeline (weeks): number input
- Notes: textarea

On form submit: create the lead record, set status to `enriching`, trigger Apify enrichment
immediately via Inngest background job.

**Future webhook** (build the endpoint now, document it): `POST /api/leads` — accepts JSON with
the above fields. This is for when we build Instagram DM automation.

### 4.3 Apify enrichment

When a lead is created with a `website_url`, trigger the Apify Website Content Crawler:
```
Actor: apify/website-content-crawler
Purpose: Extract company info, services, social proof, tech stack, contact info
Max pages: 5 (homepage + about + services + contact + blog if exists)
```

The raw Apify result is stored in `leads.enrichment_data`. After Apify completes (webhook at
`/api/webhooks/apify`), call Claude to generate a 3–5 sentence `enrichment_summary` covering:
- What the company does
- Their apparent digital maturity (how bad/good is current site)
- Signals about budget (premium brand vs budget appearance)
- Any obvious pain points visible from their current site

If no website URL provided: skip Apify, set `enrichment_status = 'failed'`, note "No website URL"
in the summary field.

### 4.4 Win probability scoring

Called automatically after enrichment completes. Also callable manually via "Re-score" button.

The scoring uses `lib/ai/scoring/win-probability.ts` (tested with Vitest):

**Rule-based signals** (deterministic, not AI):
```
budget_confirmed = true              → +25 points
decision_maker_confirmed = true      → +15 points
has_existing_website = true          → +10 points (knows value of web presence)
timeline_weeks <= 4                  → +10 points (urgent = motivated)
timeline_weeks <= 2                  → +5 additional points
package_interest = 'landing'         → -5 points (smallest deal, sometimes tire-kicker)
source = 'referral'                  → +15 points (referrals close at 2x rate)
source = 'instagram_dm' (cold)       → -10 points (cold, unqualified intent)
niche has historical win_rate > 60%  → +10 points (look up from past closed deals)
```

**AI scoring layer**: After rules, pass the lead data + enrichment summary to Claude with the
prompt in `lib/ai/prompts/score-lead.ts`. Claude adjusts the base score by ±20 points max and
returns: adjusted score + array of 3–5 reason strings.

Final score = clamped to 0–100. Store in `leads.win_probability` and `leads.win_probability_reasons`.

**The scoring logic MUST be covered by unit tests.** Create `__tests__/scoring/win-probability.test.ts`.

### 4.5 Speed-to-lead

When a lead's status changes from `new` to any further status (indicating we've reviewed it),
log the timestamp and calculate `speed_to_lead_minutes`. If a new lead has been sitting for >120
minutes without `first_contact_at` being set, Inngest fires a notification (see Section 8).

Display a live elapsed timer on new leads in the pipeline view. Use amber color for 60–120 min,
red for >120 min.

### 4.6 Lead list display

Default sort: `win_probability DESC, created_at DESC`

Show columns:
- Company name + niche tag
- Source badge
- Win probability (colored bar: green >70, amber 40–70, red <40)
- Enrichment status indicator
- Speed-to-lead timer (if first contact not yet made)
- Assigned to avatar
- Actions: View / Score / Move to pipeline

Filter by: status, niche, source, assigned to, date range

---

## 5. ZONE 2 — CONVERSION MODULE

### 5.1 Pipeline board

A kanban board built with `@dnd-kit`. Columns match the deal stages:

1. **Concept pending** — lead qualified, need to build/assign a visual
2. **Concept ready** — visual attached, not yet sent
3. **Visual sent** — concept sent to client, awaiting reaction
4. **Proposal sent** — formal quote sent, awaiting decision
5. **Negotiating** — in active back-and-forth
6. **Closed (won/lost)** — terminal columns (collapsed by default, expandable)

Cards show:
- Client name + company
- Niche tag
- Package badge
- Urgency score indicator (colored left border: green/amber/red)
- Assigned to avatar
- Days in current stage
- Preview thumbnail of Vercel URL (if attached)
- "Waiting on" chip: US or CLIENT

Drag a card between columns to advance its stage. Stage transitions trigger auto-actions (see 5.3).

### 5.2 Visual drop zone

Every deal card has a drop zone for attaching a Vercel preview URL. Two methods:

**Method A — URL paste**: In the deal detail sidebar, paste a Vercel URL. System validates it
resolves (HEAD request), stores as `deals.vercel_preview_url`, sets `vercel_preview_attached_at`.

**Method B — Drag and drop**: Drag a browser tab URL onto the deal card. This uses the
`dragover` event with `dataTransfer.getData('text/plain')`. Same validation + storage.

When a Vercel URL is attached, immediately:
1. Move deal to "Concept ready" stage
2. Fire the proposal drafting AI (see 5.3)
3. Set `vercel_preview_attached_by` to current user

The card should show a live iframe preview of the Vercel URL (small, ~200px tall) in the
deal detail view. Not on the kanban card itself (too slow).

### 5.3 AI proposal drafting

Triggered when a visual is attached OR manually via "Draft proposal" button.

Calls `POST /api/ai/draft-proposal` which:
1. Pulls lead data, deal data, enrichment summary
2. Calls Claude with `lib/ai/prompts/draft-proposal.ts`
3. Returns a structured draft:
   ```typescript
   {
     email_subject: string,
     email_body: string,         // Hungarian language
     proposed_package: string,
     proposed_price_huf: number,
     monthly_fee_huf: number,
     talking_points: string[],   // 3 bullets: why this package for this client
   }
   ```
4. Store draft in `deals.proposal_draft`
5. Open the ProposalDraftModal with the draft pre-filled

The proposal modal has:
- Email subject (editable)
- Email body (Tiptap rich text editor, pre-filled with AI draft)
- Proposed price (editable number field)
- Monthly fee (editable)
- "Copy to clipboard" button
- "Log as sent" button (stores in email_log, advances deal stage to "Proposal sent")
- "Send via Resend" button (actually sends the email)

**Important**: the AI drafts in Hungarian. The prompt explicitly instructs this. The AI should
match the tone already established in the Compass website (professional but warm, not corporate-stiff).

### 5.4 Urgency scoring for deals

The urgency score is not the same as win probability. It answers: "how urgently do WE need to
act on this deal right now?"

Factors (implemented in `lib/ai/scoring/urgency-score.ts`, unit tested):
```
days_since_last_client_contact >= 5    → +30 points
days_since_last_client_contact >= 3    → +15 points
followup_count = 0 and proposal_sent   → +20 points
vercel_attached but not sent > 2 days  → +25 points
days_in_current_stage >= 7             → +20 points
high win_probability (>70) + no action → +15 points
```

Score is clamped 0–100. Recalculated on any deal update and nightly via Inngest.

Sort order on pipeline board: by `urgency_score DESC` within each column.

### 5.5 Cold archive

When a deal is closed lost OR a lead goes cold (no response after 3 follow-ups), move to archive.

Archive list shows all cold leads with:
- Company name, niche, package interest
- Loss reason tag (color-coded)
- Days in archive
- Next scheduled re-engagement date
- Re-engagement sequence status

Re-engagement is handled by Inngest `re-engagement.ts` function:
- Day 30: Check in email — "Checking if timing has improved…"
- Day 60: Value add email — share a relevant case study or tip (AI-drafted)
- Day 90: Final attempt — "If you're ready to move forward, here's where we left off…"

Each re-engagement email is AI-drafted, reviewed by team, then sent. Never auto-sent without
human review. The Inngest function creates a draft and flags it for review in the outreach module.

---

## 6. ZONE 3 — EXECUTION MODULE

### 6.1 Project tracker — the core

This is the primary working surface once a deal is won. It tracks projects through the 8-stage
pipeline (stages 0–7) defined in the strategy document.

**Stage definitions** (stored as integers 0–7, mapped to labels everywhere):
```
0 → Lead qualified (pre-contract)
1 → Discovery complete (post-discovery call)
2 → Contract + deposit (gate: contract signed AND 50% invoice paid)
3 → Materials intake (gate: intake form link sent; deadline = +7 days)
4 → Blueprint + build (gate: blueprint approved)
5 → Revision (gate: staging URL delivered; deadline = +5 working days)
6 → Final payment + launch (gate: 100% invoice paid)
7 → Retainer active (ongoing)
```

### 6.2 Stage gate system

**Critical**: Stages cannot be advanced without gate conditions being met. This is enforced
both in the UI (buttons disabled with tooltip explaining why) AND in the API.

`lib/utils/stage-gates.ts` exports:
```typescript
function checkGate(project: Project, targetStage: number): GateResult {
  // Returns { allowed: boolean, blockers: string[] }
}
```

Gate rules (implement ALL of these):
```
Stage 0 → 1: No gate (manual advance)
Stage 1 → 2: No gate (manual advance after call)
Stage 2 → 3: contract_signed_at IS NOT NULL AND deposit invoice status = 'paid'
Stage 3 → 4: materials_received_at IS NOT NULL (all required assets uploaded)
Stage 4 → 5: blueprint_data IS NOT NULL AND blueprint_approved_at IS NOT NULL
Stage 5 → 6: revision_received_at IS NOT NULL (or 5 working days elapsed = auto-approve)
Stage 6 → 7: final_payment_at IS NOT NULL (final invoice status = 'paid')
Stage 7 → end: N/A (retainer is terminal)
```

When a gate blocks, show a clear UI message: "Cannot advance — waiting for: [list of blockers]"

### 6.3 Smart urgency scoring for projects

Projects need a different urgency model than deals. The project urgency answers:
"which active project needs our attention most urgently RIGHT NOW?"

Factors:
```
days_in_current_stage > 3 AND waiting_on = 'us'       → +40 points
days_in_current_stage > 7 AND waiting_on = 'us'       → +60 points (cumulative)
deadline_breach_imminent (< 2 days to any deadline)    → +50 points
blocker is set                                         → +20 points
invoice overdue                                        → +30 points
materials_deadline is tomorrow or past                 → +45 points
revision_deadline is tomorrow or past                  → +45 points
current_stage = 6 AND final_payment not received       → +35 points
```

The default project list sort is by `urgency_score DESC`. This is NOT configurable — it is the
only sort order. The one exception is a manual "sort by client name" toggle for navigational use,
but urgency is always the default.

### 6.4 "Waiting on" indicator

Every project must always have a `waiting_on` value: either `'us'` or `'client'`. This field
is updated manually but the system should suggest the correct value based on stage transitions:

```
Stage advances to 3 (materials)     → suggest waiting_on = 'client'
Stage advances to 4 (build)         → suggest waiting_on = 'us'
Stage advances to 5 (revision)      → suggest waiting_on = 'client'
Stage advances to 6 (final payment) → suggest waiting_on = 'client'
```

Display as a prominent badge on every project card and in the project detail header.
Colors: US = purple, CLIENT = amber.

### 6.5 Blocker field

A single free-text field: "What is blocking this project right now?"

When a blocker is set:
- Show a red/orange indicator on the project card
- Include in daily briefing (see Section 10)
- Ask at each login: "Still blocked on [X]?" with quick resolve/still-blocked buttons

Blockers automatically suggest resolution emails when the blocker involves client inaction
(e.g., "Waiting for logo files from client" → offer to draft a chaser email).

### 6.6 Owner assignment

Each project has exactly one owner (`owner_id`). For a two-person team, this creates clear
accountability. The daily briefing separates "your projects" from "partner's projects."

Show workload balance indicator: how many active projects each person owns, with urgency
distribution. If one person has all the urgent items, flag it.

### 6.7 Client portal

Each project has a unique portal URL: `/portal/[token]`

The portal is **public but token-authenticated** — no login required, just the right URL.
Token is a 64-character hex string stored in `projects.portal_token`.

Portal shows (read-only for client):
- Project name + company logo (if uploaded)
- Current stage progress bar (visual, stages labeled simply)
- Materials checklist: what's been uploaded, what's still needed
- Blueprint summary (if approved): their niche, tone, tagline, USP
- Staging URL with preview (when available)
- Invoice status: paid / pending (amounts shown, not bank details)
- "Questions? Email us" link (opens mailto to Compass email)

The portal is intentionally minimal. No messaging, no editing. Its purpose is psychological:
the client sees progress, sees what's needed from them, feels the project is organized.

Portal token can be regenerated (invalidates old link) from project settings.

---

## 7. REVENUE & RETAINER MODULE

### 7.1 Invoice management

Every project should have exactly these invoices (created automatically at the right stage):
- **Deposit invoice** (50% of agreed price): created when Stage 2 gate is reached
- **Final invoice** (50% of agreed price): created when Stage 5 → 6 transition
- **Monthly retainer invoice**: created on launch date, then recurring monthly via Inngest
- **Change order invoices**: created manually as needed

Invoice display shows: issued date, amount (net + VAT), due date, status badge.

Overdue invoices (past due date and not paid): shown in red, flagged in daily briefing.

### 7.2 MRR dashboard

Key metrics displayed at the top of the revenue page:

- **MRR (current)**: sum of all active monthly retainer fees
- **MRR (projected)**: current + all projects in stage 5–6 that will add retainers
- **One-time revenue (current month)**: deposit + final invoices issued this month
- **Outstanding invoices**: total unpaid across all projects
- **Overdue invoices**: total overdue (separate, more urgent)
- **Clients on retainer**: count of projects in stage 7

### 7.3 Client health score

For retainer clients (stage 7), track health:
```
Last login to portal > 90 days      → -10 health
No communication for 30 days        → -20 health
Invoice paid on time every month    → +10 health
Change order activity               → +15 health (engaged, buying more)
```

Low health score (<40) = churn risk. Flag these in the revenue page for proactive outreach.

### 7.4 Upsell signals

When a retainer client shows certain signals, flag for upsell to pillar 2/3:
- Has a blog (content automation pitch)
- Runs ads (leads to pillar 2)
- Has a repetitive manual workflow visible from site (pillar 3)

These signals are identified during the initial Apify enrichment and stored in enrichment_data.
Surface them in the revenue dashboard as "Upsell opportunity" chips per client.

---

## 8. INTELLIGENCE BACKBONE

### 8.1 Win scoring evolution

The win probability model starts with the rule-based system described in Section 4.4. Over time,
it must improve. The mechanism:

Every time a deal closes (won OR lost), log the lead's signals at the time of closure into a
training signal table. After 20+ closed deals, include historical win rates by niche and source
in the Claude scoring prompt. The system becomes more accurate with each deal.

This is not machine learning — it is prompt-based improvement. The historical data is passed as
context to Claude in the scoring prompt.

### 8.2 Performance analytics page

Shows (filterable by date range):
- Win rate overall and by niche, source, package type
- Average deal cycle (days from lead → closed won)
- Average time stuck per stage (identifies bottlenecks)
- Speed-to-lead distribution histogram
- Revenue per niche
- Loss reason breakdown (pie chart)

All charts use Recharts. All data comes from Supabase queries — no client-side computation
beyond formatting.

### 8.3 Template bank

A managed collection of:
- **Email templates**: proposal, follow-up 1/2/3, re-engagement 30/60/90, staging delivery,
  launch announcement, invoice chaser
- **Blueprint templates**: by niche (restaurant, dental, law firm, etc.)
- **Proposal document templates**: by package

Templates are editable in the ERP. When AI drafts an email, it uses the relevant template as
a base and personalizes it — not a blank canvas every time.

Store templates in Supabase in a `templates` table:
```sql
create table templates (
  id uuid primary key default gen_random_uuid(),
  type text not null,   -- 'email' | 'blueprint' | 'proposal'
  name text not null,
  niche text,           -- null = universal
  subject text,         -- For email templates
  body text not null,
  variables jsonb,      -- List of {{variable}} tokens used in the template
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

## 9. MCP INTEGRATIONS

Claude Code should configure MCP servers in `.mcp.json` at the project root. The following
MCPs are to be used:

### 9.1 Supabase MCP
- Used for: database introspection, running migrations, checking schema
- Do not use for runtime data access (use the Supabase JS client in code)

### 9.2 Apify MCP (if available)
- If Apify provides an MCP server, use it for triggering actors during development
- Otherwise, use the Apify REST API directly via `lib/apify/client.ts`

### 9.3 Custom MCP considerations
- The Instagram DM scraper integration: when building, research if there is an MCP server
  for Instagram automation tools (e.g., PhantomBuster, Dripify) that could pipe leads in
- Do not block on this — build the manual entry flow first

---

## 10. INNGEST BACKGROUND FUNCTIONS

### 10.1 `speed-to-lead-alert`
```
Trigger: scheduled, every 30 minutes
Logic: find leads where status = 'new' AND created_at < now() - interval '2 hours'
       AND first_contact_at IS NULL
Action: create an in-app notification + send a Slack/email alert to both founders
```

### 10.2 `enrich-lead`
```
Trigger: event 'lead/created' with website_url present
Logic: call Apify Website Content Crawler, store result, call Claude to summarize
Action: update leads.enrichment_data, enrichment_summary, enrichment_status
        then trigger 'lead/enriched' event
```

### 10.3 `score-lead`
```
Trigger: event 'lead/enriched'
Logic: run win probability scoring
Action: update leads.win_probability, win_probability_reasons
```

### 10.4 `recalculate-urgency`
```
Trigger: scheduled, every night at 02:00 Budapest time (Europe/Budapest)
Logic: recalculate urgency_score for all active deals and projects
Action: bulk update urgency_score + urgency_factors
```

### 10.5 `materials-deadline-reminder`
```
Trigger: scheduled, daily at 09:00 Budapest time
Logic: find projects where current_stage = 3 AND materials_deadline = today + 2 days
       AND materials_received_at IS NULL
Action: draft a reminder email, flag for review in outreach module
```

### 10.6 `revision-deadline-auto-approve`
```
Trigger: scheduled, daily at 09:00 Budapest time
Logic: find projects where current_stage = 5 AND revision_deadline < now()
       AND revision_received_at IS NULL
Action: set revision_received_at = revision_deadline (auto-approve per contract)
        advance stage to 6, create final invoice, notify team
```

### 10.7 `re-engagement-sequence`
```
Trigger: event 're_engagement/schedule' + scheduled daily at 10:00 Budapest time
Logic: find re_engagement_sequences where status = 'active' AND next_touch_at <= today
Action: draft re-engagement email, add to outreach queue for human review
        update touch_count, set next_touch_at
```

### 10.8 `monthly-retainer-invoice`
```
Trigger: scheduled, 1st of every month at 08:00 Budapest time
Logic: find all projects where current_stage = 7
Action: create monthly invoice record, flag for sending in revenue module
```

### 10.9 `project-paused-notify`
```
Trigger: event 'project/materials-overdue'
Logic: when materials_deadline passes with no materials received
Action: set project status to paused, create restart_fee invoice (draft)
        send notification to team
```

---

## 11. AI PROMPTS — SPECIFICATIONS

All prompts live in `lib/ai/prompts/`. All Claude calls use `claude-sonnet-4-20250514`.
Always set `max_tokens: 1000` unless the task requires more (blueprint: 2000, proposal: 1500).

### 11.1 `score-lead.ts`
```
System: You are a business development analyst for Compass Marketing, a Hungarian digital
agency. You score sales leads for web development projects.

Input: {lead_data as JSON} + {enrichment_summary} + {historical_win_rates by niche/source}

Task: Given the current base score of {base_score}, adjust it by a maximum of ±20 points
based on your analysis. Return ONLY valid JSON.

Output schema:
{
  "adjusted_score": number (0-100),
  "reasons": string[] (3-5 items, in Hungarian, each max 15 words),
  "top_concern": string | null
}
```

### 11.2 `draft-proposal.ts`
```
System: You are writing a sales proposal email in Hungarian for Compass Marketing Kft.
You write in a confident, warm, professional tone — not corporate, not casual.
The email must feel personalized to the specific client.
You know their business because you've analyzed their website.

Input: {client_name}, {company_name}, {niche}, {enrichment_summary},
       {package_recommendation}, {price_range}, {vercel_preview_url}

Task: Draft a proposal email and recommend a specific package and price.

Output schema (JSON only, no markdown):
{
  "email_subject": string,
  "email_body": string (HTML allowed, use <p> and <strong> only),
  "proposed_package": "landing" | "business" | "ecommerce",
  "proposed_price_huf": number,
  "monthly_fee_huf": number,
  "talking_points": string[] (exactly 3, why this package fits this client)
}
```

### 11.3 `draft-followup.ts`
```
System: You are writing a follow-up email in Hungarian for Compass Marketing Kft.
Be brief. The client has seen the proposal. This is a soft, non-pushy nudge.
Reference the specific project concept we showed them.

Input: {client_name}, {company_name}, {days_since_proposal}, {followup_count},
       {vercel_preview_url}, {proposed_package}, {previous_email_summary}

Output schema (JSON):
{
  "email_subject": string,
  "email_body": string
}
```

### 11.4 `generate-blueprint.ts`
```
System: You are generating a strategic website blueprint for Compass Marketing.
This blueprint is the strict construction guide for a Claude Code build.
Be precise, specific, and actionable. No fluff.

Input: {wpp_form_data as JSON} (all intake form fields)

Output schema (JSON, max 2000 tokens):
{
  "company_name": string,
  "tagline": string,
  "niche": string,
  "target_audience": string,
  "usp": string,
  "differentiators": string[] (3-5),
  "tone_of_voice": string,
  "color_direction": string,
  "typography_direction": string,
  "visual_style": string,
  "page_structure": { page_name: string, sections: string[], cta: string }[],
  "copy_guidelines": string,
  "seo_keywords": string[],
  "build_instructions": string (detailed paragraph for Claude Code)
}
```

### 11.5 `enrich-summary.ts`
```
System: You are analyzing a company's website data to help a sales team qualify a lead.
Be concise and factual. Note the most relevant signals for selling web development.

Input: {apify_result as JSON}

Task: Write a 3-5 sentence summary covering:
1. What this company does
2. Their current digital presence quality (be honest and specific)
3. Apparent budget signals
4. Key pain points or opportunities visible from their current site

Output: plain text, no JSON, no markdown, in English.
```

---

## 12. UI/UX DESIGN RULES

### 12.1 Color system (Tailwind)

```
Primary purple: #534AB7 → purple-600 (Compass brand)
Success green: #1D9E75 → teal-600
Warning amber: #EF9F27 → amber-500
Danger red: #E24B4A → red-500
Info blue: #378ADD → blue-500
Neutral: gray-* scale

"Waiting on US": purple badge
"Waiting on CLIENT": amber badge
Urgency high (>70): red left border on cards
Urgency medium (40-70): amber left border
Urgency low (<40): green left border
Win probability high (>70): green progress bar
Win probability medium (40-70): amber
Win probability low (<40): red
```

### 12.2 Layout

The dashboard uses a fixed left sidebar (240px wide) and a main content area. No top navbar
except a thin topbar showing: current page breadcrumb, current user avatar, daily briefing
notification bell.

Sidebar nav items (in order):
1. Dashboard (home)
2. Leads
3. Pipeline
4. Projects
5. Archive
6. Outreach
7. Revenue
8. Intelligence
9. — separator —
10. Settings (at bottom)

### 12.3 Daily briefing

The home page (`/`) shows a "Daily briefing" — AI-generated, updated each morning at 09:00:

```
"Good morning, Richárd. Today's priorities:

🔴 URGENT: Kovács Dental — revision deadline TODAY (5 days elapsed)
🟡 ACTION NEEDED: 3 new leads scored >70, none contacted yet
🟡 PAYMENT PENDING: Szabó Kft — final invoice 5 days overdue
✅ ON TRACK: 4 projects in progress, all on schedule

Suggested first action: Open Kovács Dental project →"
```

The briefing is generated by Claude at login if it hasn't been generated today. It reads from
the database, identifies urgencies, and outputs structured priorities. It is shown as a banner
at the top of the dashboard, dismissible until next day.

### 12.4 Component conventions

- All data tables: use a custom Table component built on shadcn/ui Table. Sortable columns,
  filterable. Never use a third-party table library — they're overkill and hard to style.
- All modals: shadcn/ui Dialog. Max width 640px for forms, 900px for previews.
- All AI-triggered buttons: show a loading spinner with the text "AI is working..." while
  the API route is running. Use `AIActionButton` shared component consistently.
- Empty states: always show a meaningful empty state with a primary action button. Use the
  `EmptyState` shared component.
- Dates: always display in Hungarian format (YYYY. MM. DD.) for formal dates,
  relative format (3 napja, 2 hete) for recent events. Use `format.ts` helpers exclusively.
- Currency: always display in HUF with thousands separator (500 000 Ft). Never display
  EUR unless explicitly needed for a specific field.

---

## 13. SECURITY & DATA RULES

### 13.1 Authentication
- Supabase Auth with email/password
- Two users only: both founders. No registration allowed (disable it in Supabase dashboard)
- Session persists via Supabase cookies (handled by middleware)
- The only public routes: `/login`, `/portal/[token]`
- All other routes: require valid session, enforced in middleware

### 13.2 Client portal security
- Portal token is 64-character random hex. Unguessable.
- Token can be regenerated, which invalidates the old URL
- Portal shows NO sensitive business data: no other clients, no internal pricing notes,
  no communication logs beyond their own project
- Portal is read-only: no actions, no uploads from the portal (keep it simple)

### 13.3 Environment variables
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # Server-side only, never exposed to browser

# Anthropic
ANTHROPIC_API_KEY=           # Server-side only

# Apify
APIFY_API_TOKEN=             # Server-side only

# Resend
RESEND_API_KEY=              # Server-side only
RESEND_FROM_EMAIL=           # e.g. info@compassmarketing.hu

# Inngest
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# App
NEXT_PUBLIC_APP_URL=         # Full URL including https://
PORTAL_BASE_URL=             # Same as above unless separate domain
```

Never log API keys. Never expose service role key to the browser. Never return raw
Supabase error messages to the client (sanitize all API error responses).

### 13.4 Email logging (legal requirement)
Per the contract (Section 20.1), only email communications have legal effect. Therefore:
- Every email sent via Resend MUST be logged in `email_log` with full body text
- The email log is append-only (no deletes, no edits after creation)
- Inbound emails: when the founders forward a client email to the system (via Resend
  inbound webhook), it is automatically logged against the correct project/lead

---

## 14. BUILD ORDER — PHASES

Follow this exact order. Do not build Phase N+1 until Phase N is working and manually tested.

### Phase 1 — Foundation (start here)
1. Initialize Next.js 14 project with TypeScript, Tailwind, shadcn/ui
2. Set up Supabase project, run all migrations from Section 3
3. Implement Supabase Auth (login page, middleware, session management)
4. Build sidebar layout with all nav items (empty pages with "Coming soon" placeholder)
5. Create `lib/types/app.types.ts` with all application types
6. Generate `lib/types/database.types.ts` from Supabase

**Checkpoint**: Two users can log in. Sidebar navigation works. Pages exist but are empty.

### Phase 2 — Lead Capture (Zone 1 core)
1. Build manual lead entry form (sidebar quick-add)
2. Build leads list page with filtering and sorting
3. Build lead detail page
4. Implement rule-based win probability scoring (no AI yet)
5. Write Vitest tests for scoring logic
6. Build `LeadScoreBadge` and `SpeedToLeadTimer` components

**Checkpoint**: Can create leads manually, see them sorted by win probability, view detail.

### Phase 3 — AI Integration
1. Set up Anthropic client singleton
2. Write all prompts in `lib/ai/prompts/`
3. Implement `POST /api/ai/score` route
4. Connect AI scoring to lead creation flow
5. Set up Apify client
6. Implement `POST /api/leads/enrich` route
7. Set up Inngest: `enrich-lead` and `score-lead` functions
8. Implement Apify webhook receiver

**Checkpoint**: Creating a lead with a website URL triggers enrichment, then AI scoring.
Win probability is calculated with AI adjustment.

### Phase 4 — Pipeline Board (Zone 2)
1. Build kanban board with dnd-kit
2. Build deal card component with urgency indicator
3. Implement visual drop zone (URL paste + drag)
4. Build ProposalDraftModal with Tiptap editor
5. Implement `POST /api/ai/draft-proposal` route
6. Set up Resend client and email sending
7. Build cold archive view
8. Implement re-engagement sequence foundation in Inngest

**Checkpoint**: Can move deals through pipeline, attach a Vercel URL, get an AI-drafted
proposal, send it via email, and it gets logged.

### Phase 5 — Project Tracker (Zone 3)
1. Build project kanban view (stage columns 0–7)
2. Build project table view (toggle)
3. Implement stage gate logic in `lib/utils/stage-gates.ts`
4. Write Vitest tests for stage gates
5. Build urgency scoring for projects (tested)
6. Build `WaitingOnBadge`, `UrgencyIndicator`, `BlockerField`, `OwnerAvatar`
7. Build project detail page (all fields, stage advance buttons)
8. Implement stage history tracking
9. Set up all remaining Inngest functions (materials reminder, revision auto-approve, etc.)

**Checkpoint**: Full project lifecycle trackable. Stage gates enforced. Urgency works.

### Phase 6 — Client Portal
1. Build portal page at `/portal/[token]`
2. Build `PortalProgress`, `PortalChecklist`, `PortalInvoiceStatus` components
3. Build asset upload in project detail (team uploads assets for client review)
4. Implement blueprint display in portal
5. Add portal token regeneration to project settings
6. Build `portal_last_viewed_at` tracking

**Checkpoint**: Client can open portal link, see progress, see what's needed.

### Phase 7 — Revenue Module
1. Build revenue page with MRR dashboard
2. Implement invoice creation (auto on stage transitions)
3. Build invoice management UI (mark paid, view history)
4. Implement client health scoring
5. Implement upsell signal display
6. Set up monthly retainer invoice Inngest function

**Checkpoint**: Full invoice lifecycle. MRR visible. Health scores shown.

### Phase 8 — Intelligence & Analytics
1. Build intelligence/analytics page
2. Implement all Recharts visualizations
3. Build template bank management UI
4. Implement daily briefing generation (Claude + Inngest)
5. Build email log viewer (per project/lead)

**Checkpoint**: Analytics visible. Briefing generates on first login of the day.

### Phase 9 — Polish & Hardening
1. Add all empty states
2. Add all loading states and error boundaries
3. Implement real-time updates via Supabase Realtime
4. Add keyboard shortcuts (K = quick lead add, / = search)
5. Performance audit: check all Supabase queries have appropriate indexes
6. Security audit: verify RLS policies, check for any exposed keys
7. Mobile review: the ERP is desktop-first but should not break on tablet

---

## 15. CODING STANDARDS

### 15.1 TypeScript
- Strict mode on. No `any`. Use `unknown` when type is truly unknown and narrow it.
- All database operations: use the generated `database.types.ts` types
- All API routes return typed responses: define a response type for every route
- Use `zod` for all input validation in API routes

### 15.2 Error handling
- All API routes: wrap in try/catch, return `{ error: string }` on failure
- Never return raw database errors to the client
- Use error boundaries at page level
- Log errors to console in development, use a structured format

### 15.3 Performance
- All Supabase queries: select only the columns you need (never `select *` in production queries)
- Paginate any list that could exceed 50 items
- Use React Query's `staleTime` appropriately (leads: 1 minute, projects: 30 seconds)
- Suspense boundaries around data-fetching components

### 15.4 Naming conventions
- Files: `PascalCase` for components, `camelCase` for utilities and hooks
- Database columns: `snake_case`
- TypeScript types: `PascalCase`
- Zustand stores: `use[Name]Store.ts`
- React Query keys: constants exported from a `queryKeys.ts` file per domain

### 15.5 Comments
- Comment the "why", not the "what"
- All AI prompt files: include a comment block explaining what signals the prompt uses
- All scoring functions: include a comment block explaining the scoring logic
- Stage gate logic: comment each gate with the business reason

---

## 16. THINGS TO NEVER DO

1. **Never auto-send any email without human review.** AI drafts, human sends. Every time.
   The only exception is the re-engagement sequence, where Inngest drafts and flags for review.

2. **Never advance a stage programmatically without gate validation.** Even if it seems safe.
   All stage advances go through `checkGate()`.

3. **Never expose `SUPABASE_SERVICE_ROLE_KEY` or `ANTHROPIC_API_KEY` to the browser.**
   These are server-side only. If you find yourself importing either in a `use client`
   component or a file that could be bundled client-side: stop, you've made an error.

4. **Never delete email log entries.** The email log is append-only. If an email needs to be
   "cancelled", mark it as cancelled in a status field — never delete the row.

5. **Never skip the enrichment summary step.** Raw Apify JSON is large and expensive to pass
   to Claude repeatedly. Always summarize first, then use the summary in downstream prompts.

6. **Never display a win probability to the client** (in the portal or any client-facing surface).
   This is internal sales intelligence only.

7. **Never use `select *` in Supabase queries in production code.** Always specify columns.

8. **Never hardcode HUF amounts** for packages. Always read from a configuration or the deal record.
   Prices will change as we gain market intelligence.

9. **Never build the custom dashboard before Phase 1–8 are complete.** The strategy document
   is explicit: build in Notion-equivalent simplicity first, add complexity only when the
   operational patterns are proven. This codebase is the eventual replacement for Notion —
   it must work before it must be beautiful.

10. **Never add a feature not in this spec without asking.** If you think something is missing
    or would be helpful, leave a `// TODO: consider adding X` comment and continue. Do not
    scope-creep the build.

---

## 17. FIRST SESSION CHECKLIST

When starting a Claude Code session on this project for the first time:

- [ ] Read this entire document
- [ ] Confirm pnpm is available (`pnpm --version`)
- [ ] Run `pnpm create next-app@latest compass-erp --typescript --tailwind --app`
- [ ] Install core dependencies:
  ```
  pnpm add @supabase/supabase-js @supabase/ssr
  pnpm add @tanstack/react-query zustand
  pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
  pnpm add react-hook-form @hookform/resolvers zod
  pnpm add @anthropic-ai/sdk
  pnpm add apify-client
  pnpm add resend
  pnpm add inngest
  pnpm add date-fns
  pnpm add recharts
  pnpm add @tiptap/react @tiptap/starter-kit
  pnpm add lucide-react
  pnpm add -D vitest @vitejs/plugin-react
  ```
- [ ] Initialize shadcn/ui: `pnpm dlx shadcn@latest init`
- [ ] Create `.env.local` from `.env.local.example`
- [ ] Create Supabase project and run Phase 1 migrations
- [ ] Generate Supabase types: `pnpm dlx supabase gen types typescript --project-id [id] > lib/types/database.types.ts`
- [ ] Create two Supabase auth users (both founders)
- [ ] Commit initial setup

---

## 18. REFERENCE — COMPASS WORKFLOW (the 7 stages in plain language)

This is the business context behind the code. Re-read when confused about why a feature works
the way it does.

**Stage 0**: A lead fills a qualification form (or we add them manually). We decide if they're
worth a discovery call. Gate: we've reviewed them and said yes.

**Stage 1**: We hold ONE discovery call. We show a niche-level concept (not client-specific).
We get their goals, brand, competitors. We give a quote within 24h.

**Stage 2**: They sign the contract and pay 50%. Nothing starts until money is in the bank.

**Stage 3**: They fill the intake form (WPP form) with all assets. 7-day deadline. If they
miss it, the project pauses and a restart fee applies. We are strict about this.

**Stage 4**: We generate the strategic blueprint from their intake data. We get it approved.
Then we build — no client interruptions during build.

**Stage 5**: We deliver the staging URL + structured revision form. They have 5 working days.
If they don't respond: auto-approved. One revision round included. Everything else is a
change order.

**Stage 6**: Revision done, final invoice sent, 50% collected. Then we deploy to Vercel,
hand over DNS, confirm everything live.

**Stage 7**: Monthly retainer begins. We maintain, update, and upsell to the other pillars.

---

*This document is version 1.0. Update the version number and add a changelog entry
when making significant changes to the spec.*

*Last updated: 2026-05-09*
*Authors: Compass Marketing Kft. founders*
