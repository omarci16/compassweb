# GO-LIVE — Scraping 2.1

This is the **only** manual setup for Scraping 2.1. Everything else deploys
itself when the PR is merged. Follow the parts in order. Copy the blocks marked
`copy this` **exactly**. Anything inside `«angle brackets»` you replace with your
own value.

You need logins for: **Vercel**, **Supabase**, **Resend**, **Inngest**, and your
**domain registrar** (wherever you bought `compassmarketing.hu` — e.g. GoDaddy,
Namecheap, Rackhost, Cloudflare). ~30 minutes, one time.

> Your app URL is your Vercel URL, e.g. `https://compassweberp.vercel.app`.
> Wherever you see `«APP_URL»` below, paste that (no trailing slash).

---

## Part 1 — Turn on auto-deploy (so you never paste SQL or click "Resync" again)

### 1A. Inngest → auto-sync functions on every deploy

1. Go to **https://vercel.com/integrations/inngest** and click **Add Integration**.
2. Choose your Vercel team, then select the **compass-erp** project. Click **Install**.
3. It opens Inngest. Sign in, and when asked, **connect it to your existing
   Inngest app** (the one named `compass-erp`). Approve.
4. Done. From now on, every time the app deploys, Inngest automatically picks up
   any new or changed background function. **You never click "Resync" again.**

> This replaces the manual "Apps → compass-erp → Resync" step from 2.0.

### 1B. Supabase → auto-run database migrations on merge

1. Go to **Supabase Dashboard → your project → Project Settings → General** and
   copy the **Reference ID** (looks like `abcdefghijklmnop`).
2. In the repo, open **`supabase/config.toml`** and replace the placeholder:
   ```toml
   project_id = "«paste your Reference ID here»"
   ```
   (If you're not comfortable editing files, send me the Reference ID and I'll
   commit it.)
3. In **Supabase Dashboard → Project Settings → Integrations → GitHub**, click
   **Connect / Enable**, authorize GitHub, and pick the **compasserp** repo.
4. Set **Supabase directory** to `supabase` and enable **"Deploy migrations to
   production"** on the `main` branch. Save.
5. Done. When a PR is merged to `main`, Supabase runs the new files in
   `supabase/migrations/` automatically. **You never paste SQL again.**

> If you prefer to run this batch's migrations by hand once instead, open
> **Supabase → SQL Editor** and run these files in order:
> `0008_scraping_2_1.sql`, `0009_outreach_drafts.sql`, `0010_outreach_sending.sql`,
> `0011_cold_followups.sql`, `0012_contact_harvest.sql`.

---

## Part 2 — Set up the sending domain (protects your main domain's reputation)

Cold email should **not** go from `info@compassmarketing.hu`. Use a separate
subdomain so any spam complaints never hurt your real inbox. We'll use
`send.compassmarketing.hu` as the example — pick your own subdomain if you like.

### 2A. Add the domain in Resend

1. Go to **Resend Dashboard → Domains → Add Domain**.
2. Enter **`send.compassmarketing.hu`** and click **Add**.
3. Resend now shows you a **list of DNS records** (an MX record, a couple of
   TXT/CNAME records for DKIM, and an SPF record). Keep this screen open — you'll
   copy these in the next step.

### 2B. Paste the DNS records at your registrar

Open your registrar's DNS settings for `compassmarketing.hu` (usually
**DNS / Zone Editor / Manage DNS**). Add each record Resend showed you. There are
four kinds:

1. **MX** and **DKIM** records → **copy these exactly from the Resend screen**
   (they're unique to your domain — Resend generates them). Typically:
   - one **MX** record on `send` → `feedback-smtp.«region».amazonses.com`, priority `10`
   - one or more **DKIM** records (TXT or CNAME) named like `resend._domainkey`
   Copy the **Name/Host** and **Value** columns verbatim into your registrar.

2. **SPF** — add a **TXT** record:
   - **Name / Host:** `send`
   - **Value (copy this):**
     ```
     v=spf1 include:amazonses.com ~all
     ```

3. **DMARC** — add a **TXT** record:
   - **Name / Host:** `_dmarc.send`
   - **Value (copy this):**
     ```
     v=DMARC1; p=none; rua=mailto:dmarc@compassmarketing.hu; adkim=r; aspf=r
     ```
   (`p=none` just monitors at first — safe. Tighten to `p=quarantine` after a few
   weeks of clean sending.)

> **Unsubscribe needs no DNS.** The app adds the one-click unsubscribe link and
> the `List-Unsubscribe` header automatically. Just make sure `NEXT_PUBLIC_APP_URL`
> is set in Part 4 so the unsubscribe link points at your app.

### 2C. Verify

1. Back in **Resend → Domains**, wait a few minutes and click **Verify** until
   every record shows a green check. (DNS can take up to an hour; usually minutes.)
2. Once verified, decide the address you'll send from, e.g.
   **`szia@send.compassmarketing.hu`** — you'll use it in Part 4.

---

## Part 3 — Turn on delivery tracking (opens, bounces, complaints)

1. Go to **Resend Dashboard → Webhooks → Add Webhook**.
2. **Endpoint URL (copy this, with your app URL):**
   ```
   «APP_URL»/api/webhooks/resend
   ```
3. Select these events: **email.sent, email.delivered, email.opened,
   email.clicked, email.bounced, email.complained**.
4. Click **Add**, then open the webhook and copy its **Signing Secret** (starts
   with `whsec_`). You'll paste it as `RESEND_WEBHOOK_SECRET` in Part 4.

> This is what auto-adds bounced/complained addresses to your suppression list so
> your domain stays healthy.

---

## Part 4 — Set the environment variables in Vercel

Go to **Vercel → compass-erp → Settings → Environment Variables**. Add each of
these (Environment: **Production**), then **redeploy** once so they take effect.

| Name | Value | Notes |
| --- | --- | --- |
| `RESEND_FROM_EMAIL` | `szia@send.compassmarketing.hu` | the verified sending address from Part 2C |
| `RESEND_WEBHOOK_SECRET` | `whsec_…` | from Part 3 |
| `SENDING_INBOXES` | `szia@send.compassmarketing.hu:Compass` | one or more, comma-separated (see Part 5) |
| `SENDING_DAILY_CAP` | `30` | max emails/inbox/day (before warmup) |
| `NEXT_PUBLIC_APP_URL` | `«APP_URL»` | already set for 2.0 — just confirm it's correct |
| `UNSUBSCRIBE_SECRET` | *(optional)* a random 64-char hex | if empty, reuses `INNGEST_SIGNING_KEY` |
| `META_AD_LIBRARY_TOKEN` | *(optional)* | leave empty — the ads signal just stays off |

To generate a random `UNSUBSCRIBE_SECRET`, run this in a terminal and paste the output:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Part 5 — (Optional) add more sending inboxes for higher volume

More inboxes = more emails/day, safely. Two ways:

- **Easy:** put several in `SENDING_INBOXES`, comma-separated:
  ```
  szia@send.compassmarketing.hu:Compass, hello@send.compassmarketing.hu:Compass
  ```
  (Each address must exist as a real mailbox and its domain must be verified in
  Resend.)

- **Advanced (per-inbox warmup):** in **Supabase → Table Editor →
  `sending_inboxes`**, add a row per inbox and set `warmup_started_at` to today's
  date. The app then ramps that inbox from 5 emails/day, +5 each week, up to
  `daily_cap`. Leave `warmup_started_at` empty to send at full cap immediately.

> Start slow. One inbox at 20–30/day for the first two weeks is the safe default.

---

## Part 6 — First run (verify it all works)

1. **Prospecting → Batch indítás:** pick a couple of verticals × cities, click
   the launch button. Leads appear in **Leads** within a minute or two.
2. **Outreach → Jóváhagyási sor → "Piszkozatok generálása":** the AI drafts cold
   emails for the top routed leads into the queue.
3. Review a draft, click **Jóváhagy** (approve). Nothing sends yet.
4. Click **"Jóváhagyottak küldése"** to start the send queue. Emails go out from
   your rotated inbox(es), spaced 3–7 minutes apart, within the daily cap.
5. **Dashboard home → Outbound irányítótorony:** watch *sent / opened / replied /
   bounced* update as Resend fires webhooks.
6. Send yourself a test lead first if you want to see the unsubscribe link and
   confirm a real email arrives cleanly.

**That's it.** After this one-time setup, the loop is: batch-scrape → approve
drafts → send → the machine handles rotation, follow-ups, bounces, and
unsubscribes on its own. You only ever click **approve**.
