# Compass ERP

Internal operating system for Compass Marketing Kft. — Zone 1 (acquisition),
Zone 2 (conversion), Zone 3 (execution), plus the intelligence backbone and
client portal. Built per [`CLAUDE.md`](./CLAUDE.md).

## Stack

- Next.js 14 (App Router) + TypeScript strict
- Tailwind CSS v3 + shadcn-style primitives + Lucide
- Supabase (Postgres + Auth + Storage + Realtime + RLS)
- Anthropic Claude (`claude-sonnet-5`) for all AI
- Apify Website Content Crawler for lead enrichment
- Google PageSpeed Insights for site verification (HTTPS / viewport / performance / screenshot)
- Resend for outbound email (+ rotated inboxes, suppression, unsubscribe, webhooks)
- Inngest for background jobs
- React Query + Zustand, dnd-kit for kanban, Tiptap for proposals, Recharts
- Vitest for scoring + stage-gate tests

## Lead Scraping 2.0 / 2.1 — the outbound machine

The prospecting pipeline (Google Maps → verify → score) plus a full cold-outreach
sending stack, built on **free tools only**:

- **Targeting**: 6 verticals (beauty, fitness, dental, real estate, **legal**,
  **hospitality**) × cities, launched one-off or via a **batch launcher**.
- **Contactability**: free in-code email verification (syntax + DNS MX +
  disposable/role) gates bounces before they touch the sending domain.
- **Offer routing**: every lead is routed to `needs_site` / `upgrade` /
  `low_priority`; the AI writes a track-specific pitch, `upgrade` grounded only
  in *verified* signals.
- **Approval queue**: AI drafts land in `outreach_drafts` (status `draft`); a
  human approves every send — nothing auto-sends (CLAUDE.md rule #1).
- **Sending**: rotated inboxes with per-inbox daily caps + warmup ramp, 3–7 min
  spacing, one-click unsubscribe + suppression list, Resend delivery webhooks.
  Immutable record → `email_log`; mutable lifecycle → `outreach_sends`.
- **Follow-ups**: up to 2 nudges, each AI-drafted into the queue, auto-stopped on
  reply / unsubscribe / bounce.
- **Control tower**: the dashboard home surfaces drafts to approve, today's
  sent/opened/replied/bounced, top targets, and the next 3 actions.

Going live is a copy-paste tutorial: **[`GO-LIVE-2.1.md`](./GO-LIVE-2.1.md)**.

## Setup

```bash
pnpm install
cp .env.local.example .env.local      # fill in keys
pnpm dlx supabase db push             # apply supabase/migrations/0001_initial_schema.sql
pnpm dlx supabase gen types typescript --project-id <id> > lib/types/database.types.ts
pnpm dev
```

The app runs in **demo mode** when `NEXT_PUBLIC_SUPABASE_URL` is unset — every
page is browseable with the in-memory dataset in `lib/data/demo.ts`. Set the
env vars to switch to real persistence.

### Environment variables

See [`.env.local.example`](./.env.local.example) for the full list. Scraping 2.1
adds:

| Var | Required? | Purpose |
| --- | --- | --- |
| `RESEND_WEBHOOK_SECRET` | for delivery tracking | Verifies `/api/webhooks/resend` (opens/bounces/complaints). |
| `SENDING_INBOXES` | optional | Comma-separated `address[:From Name]` to rotate cold sends across. Falls back to the `sending_inboxes` table, then `RESEND_FROM_EMAIL`. |
| `SENDING_DAILY_CAP` | optional | Per-inbox daily cap before warmup ramp (default 30). |
| `UNSUBSCRIBE_SECRET` | optional | Signs unsubscribe tokens; falls back to `INNGEST_SIGNING_KEY`. |
| `META_AD_LIBRARY_TOKEN` | optional | Ads buying-signal; no-ops cleanly if unset. |

### Zero-ops (no manual Inngest resync / SQL paste)

- **Inngest ↔ Vercel Marketplace integration** auto-syncs the functions in
  `app/api/webhooks/inngest` on every deploy.
- **Supabase ↔ GitHub integration** auto-runs `supabase/migrations/*.sql` on
  merge to production (see `supabase/config.toml`).

Both are one-time dashboard setups — the exact clicks are in
[`GO-LIVE-2.1.md`](./GO-LIVE-2.1.md).

## Tests

```bash
pnpm test
```

Unit tests cover the win-probability scorer, urgency scorer, and stage gates —
the three pieces of business logic that *must* be deterministic.

## Folder map

```
app/
  (auth)/login              — Supabase email+password sign in
  (dashboard)/              — sidebar + topbar shell, auth-guarded
    page                    — daily briefing + KPIs + hot leads + urgent projects
    leads/                  — list, detail, AI re-score
    pipeline/               — kanban (dnd-kit), deal detail, visual drop zone, AI proposal
    projects/               — kanban + table, stage progress, gate-guarded advance, blockers
    archive/                — cold leads + re-engagement schedule
    outreach/               — AI draft queue + sent log
    revenue/                — MRR, invoices, retainer roster
    intelligence/           — win rate, loss reasons, deal cycle (Recharts)
    settings/               — profile, integration env list, sign out
  portal/[token]            — public client portal (token-auth, read-only)
  api/
    leads, leads/enrich     — POST create + manual enrichment trigger
    ai/score, ai/draft-*    — Claude-powered scoring/drafts
    deals/[id]/stage,
      attach-visual         — drag-drop endpoints
    projects/[id],
      projects/[id]/stage   — gate-enforced stage advance
    email/send, email/log   — Resend send + audit-log insert
    invoices                — POST create
    portal/[token]          — public read-only project state
    webhooks/inngest        — Inngest function endpoint
    webhooks/apify          — Apify webhook receiver
components/
  ui/                       — Tailwind primitives (button, dialog, table…)
  layout/, leads/, pipeline/, projects/, intelligence/, portal/, shared/
lib/
  ai/anthropic.ts           — Claude singleton + JSON extraction
  ai/prompts/               — score-lead, draft-proposal, draft-followup,
                              generate-blueprint, enrich-summary, daily-briefing
  ai/scoring/               — win-probability + urgency-score (TESTED)
  apify/, resend/           — third-party clients
  inngest/client.ts         — typed Inngest client + event registry
  inngest/functions/        — enrich, score, urgency, deadlines, retainer, re-engagement
  supabase/                 — browser, server, middleware
  utils/                    — format (HUF, date, relative), portal-token, stage-gates (TESTED)
  data/queries.ts           — server-side queries with demo fallback
  data/demo.ts              — in-memory dataset for preview/demo mode
  types/                    — database.types + app.types
supabase/migrations/        — 0001 initial schema with RLS
__tests__/                  — Vitest specs for scoring + gates
```

## Strict rules respected (per CLAUDE.md §16)

1. AI never auto-sends — every email goes through human review (`logAsSent` /
   `Send via Resend` are explicit user actions).
2. Stage advances always go through `checkGate()` — both UI and API.
3. Service-role Supabase key is server-only (`createServiceClient`).
4. `email_log` has insert-only RLS; no delete/update policies.
5. Apify result is summarised once via Claude, then the summary feeds all
   downstream prompts (never the raw 18kb+ JSON).
6. Win probability is internal-only — never rendered in `/portal/[token]`.
7. All Supabase queries select explicit columns or use the `*` hint only on
   `getProject*`/`getInvoices` where the full row is needed by the UI.
8. Package prices are read from the deal/project record, never hardcoded.

## Build phases

The codebase is structured so each phase from CLAUDE.md §14 is testable end-to-
end. With env vars set: log in, capture a lead, score it, attach a Vercel URL,
draft a proposal, send it, win the deal, advance the project through every
stage gate, hand the client a portal link, collect MRR.

## Future hooks

- The `templates` table is empty — populate via SQL or build a UI in
  `/intelligence` once volume justifies it.
- The `daily-briefing` prompt is wired but not yet driven by a cron — the
  dashboard currently uses `demoBriefing`; swap it for a Claude call backed by
  `getRevenueMetrics` + `getProjects` once you want it live.
- Tiptap is in dependencies but not yet rendered — the proposal modal is
  textarea-based for v0; upgrade to rich text when the team wants it.
