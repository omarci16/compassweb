# Compass Systems

One Vercel deployment serving two things on `compassaisystems.hu`:

| Path | What it is | How it's served |
|---|---|---|
| `/`, `/*.html` | The public marketing site | Static files in `public/` — no framework, no build output, no JS runtime |
| `/erp`, `/erp/*` | The internal ERP (leads, pipeline, projects, outreach, revenue) | Next.js 14 App Router, Supabase auth |
| `/api/*` | ERP API routes, webhooks, public brief intake | Next.js route handlers |
| `/portal/[token]` | Token-linked client project portal | Next.js, public by token |
| `/admin.html` | Blog editor | Static, its own Supabase project |

## The marketing site is deliberately not React

`public/` holds hand-written HTML, `styles.css` and `script.js`. Vercel serves
those straight off the CDN — Next.js never touches them, so they cost no
hydration, no bundle and no framework overhead, and every URL kept its original
`.html` form when the ERP was merged in. Edit them directly; there is nothing to
compile.

Two consequences worth knowing:

- **`middleware.ts` is scoped to `/erp` and `/api` on purpose.** The default
  Next matcher would run a Supabase auth round-trip on every marketing page hit
  and redirect visitors to the ERP login. Do not widen it.
- **`/` needs the rewrite in `next.config.mjs`.** Next does not map a bare root
  to `public/index.html` on its own.

## Two Supabase projects

They are separate, with a clean split:

- **Website project** — `posts` (the blog) and the legacy `inquiries` table.
  Used by `public/admin.js` and `public/supabase-public.js` via the anon key.
- **ERP project** — `leads`, `deals`, `projects` and everything else. Used by
  the Next app via `NEXT_PUBLIC_SUPABASE_*` and `SUPABASE_SERVICE_ROLE_KEY`.

They have separate auth user pools, so the blog editor and the ERP are separate
logins.

## Website briefs become leads

`public/contact.html` is a five-step brief. It POSTs to `/api/leads/brief`,
which writes a `leads` row with `source: 'contact_brief'` and the answers intact
in the `brief` jsonb column, then fires `lead/created` so enrichment and scoring
run exactly as they do for scraped prospects.

That route is public and same-origin — it checks `Origin`, runs a honeypot and
rate-limits per IP. It is deliberately separate from `/api/leads/inbound`, which
is the secret-authenticated server-to-server endpoint. Do not merge them.

Historical rows from the old `inquiries` table migrate across with
`scripts/migrate-inquiries.mjs` (dry-run by default).

## Development

```bash
pnpm install
pnpm dev          # marketing site and ERP both on :3000
pnpm typecheck
pnpm test
pnpm build
```

Without Supabase env vars the ERP runs in demo mode against fixtures in
`lib/data/demo.ts`. That bypass is refused in production — see the guard in
`lib/supabase/middleware.ts` — so a missing env var fails closed instead of
serving the back-office to the public internet.

Env vars: copy `.env.local.example` to `.env.local`.

## Design

The ERP's theme in `app/globals.css` mirrors the tokens in `public/styles.css`
(`#0A0A0A` ground, warm off-white text, white accent, Host Grotesk + Space
Mono). `public/styles.css` is the source of truth — change it there first.
Status colours live in `tailwind.config.ts` under `compass.*`; the class names
are used at ~130 call sites, so reskinning means changing those five values, not
the call sites.
