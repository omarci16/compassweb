# GO-LIVE — Email Studio

Two manual steps, ~10 minutes total. Copy the blocks marked `copy this`
**exactly**. Anything inside `«angle brackets»` you replace with your own value.

You need logins for: **Supabase** and **Vercel**.

---

## Part 1 — Run the database migration in Supabase

This creates the two new tables (`email_voice_profiles`, `email_campaigns`) and
adds two columns to `outreach_drafts`. It's safe to run even if you're not sure
whether it already ran — every statement in it is written to skip cleanly if it
already exists.

1. Open **https://supabase.com/dashboard**, click into your Compass project.
2. In the left sidebar, click **SQL Editor**.
3. Click **+ New query**.
4. Open the file **`supabase/migrations/0014_email_voice_profiles.sql`** in this
   repo, select all its contents, and copy it.
5. Paste the whole thing into the SQL Editor box.
6. Click **Run** (bottom right, or `Cmd+Enter`).
7. You should see **"Success. No rows returned"**. That's it — done.

**How to check it worked:** in the left sidebar click **Table Editor**, and
confirm you now see two new tables: `email_voice_profiles` (should already have
6 rows — the seeded defaults) and `email_campaigns` (empty, that's expected).

---

## Part 2 — Add your OpenAI API key to Vercel

Email Studio drafts all client-facing emails via OpenAI instead of Claude, so
the app needs an OpenAI key to actually generate anything (until this is set,
you'll see a clear "OPENAI_API_KEY not configured" message instead of a draft
— that's expected, not a bug).

1. If you don't already have one: go to **https://platform.openai.com/api-keys**,
   sign in, click **Create new secret key**, name it something like
   `compass-erp`, and copy the key immediately (it's shown once).
2. Go to **https://vercel.com/dashboard**, click into your Compass ERP project.
3. Click **Settings** (top nav) → **Environment Variables** (left sidebar).
4. Add a new variable:
   - **Key**: `OPENAI_API_KEY`
   - **Value**: `«paste your key, starts with sk-»`
   - **Environments**: check all three — Production, Preview, Development.
5. Click **Save**.
6. Vercel does **not** auto-redeploy for a new env var on its own — go to the
   **Deployments** tab, click the **⋯** menu on the latest (top) deployment, and
   click **Redeploy** (leave "Use existing Build Cache" checked). Confirm.
7. Wait for the redeploy to finish (~1-2 minutes, shows a green checkmark).

**How to check it worked:** open the live app → **Email Studio** in the sidebar
→ click any profile's pencil icon → **Sandbox** tab → pick a sample lead →
**Előnézet generálása**. You should get back a real generated email instead of
the "OPENAI_API_KEY not configured" error.

---

That's both steps. Everything else (the new `/email-studio` page, the OpenAI
client code, the updated prompts) is already live the moment this PR is merged
and Vercel finishes its normal deploy — no other manual setup needed.
