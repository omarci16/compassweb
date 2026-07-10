# Lead Scraping 2.0 — Go-Live Runbook

This branch fixes the false-audit bug (a lead with a perfectly good website was
scored top-tier and audited as "no HTTPS / placeholder" — the windingatlan.hu
incident). The code is merged and tested (`pnpm vitest run`, `pnpm tsc`, `pnpm
build` all green), but three steps need production access only you have.

> ⚠️ **Order matters.** The new code writes to columns that don't exist until
> migration `0006` runs. **Apply the migrations BEFORE deploying the code**, or
> enrichment/verification writes will fail in production.

## Step 1 — Apply the migrations (BEFORE deploying)

Two new migrations: `supabase/migrations/0006_site_verification.sql` (adds
`website_screenshot_url`, `website_verified_at`, `website_verification` columns
+ the public `site-screenshots` storage bucket) and
`0007_reverify_backfill.sql` (remaps legacy `enrichment_status='failed'` →
`crawl_failed`).

Pick whichever you already use:

```bash
# Option A — Supabase CLI (needs `supabase link` to the project once)
supabase db push

# Option B — paste each file's SQL into the Supabase dashboard SQL editor
#   (Dashboard → SQL Editor → run 0006, then 0007)
```

## Step 2 — Add the PageSpeed key (optional but recommended)

Verification uses Google PageSpeed Insights (free, 25k req/day). It works
without a key at low volume; a key raises the quota.

1. Create a key: https://developers.google.com/speed/docs/insights/v5/get-started
2. Add it in Vercel → Project → Settings → Environment Variables:
   `PAGESPEED_API_KEY = <your key>`

## Step 3 — Deploy the code

Push this branch and merge to your production branch (Vercel auto-deploys), or
`vercel deploy --prod`. Confirm the build succeeds on Vercel.

## Step 4 — Backfill existing false-audited leads

Existing cold leads were scored/audited under the old buggy probe. Re-verify
them via the backfill job (dry run first):

```bash
# Dry run — writes nothing; check the Inngest run for would_downgrade /
# would_null_audit counts.
curl -X POST https://<your-app>/api/prospecting/backfill \
  -H 'content-type: application/json' -d '{"dry_run": true}'

# Real run — re-analyses, re-scores, nulls stale audits, re-verifies.
curl -X POST https://<your-app>/api/prospecting/backfill \
  -H 'content-type: application/json' -d '{"dry_run": false}'
```

Watch progress in the Inngest dashboard (`prospecting-backfill-reverify`
self-continues by id cursor until done). Then spot-check ~10 leads —
including windingatlan.hu — on the leads page.

## Verify it worked

- windingatlan.hu (and similar http-stub-but-https-real sites) now show as
  `healthy` with no false "no HTTPS / placeholder" signals.
- Each pain signal shows an "Ellenőrzött / Nem ellenőrzött" badge.
- The lead detail page shows a rendered homepage screenshot once verified.
- Pain audits only generate after verification and cite verified findings.
