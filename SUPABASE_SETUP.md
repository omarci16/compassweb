# Compass Admin — Supabase setup (one-time, ~10 minutes)

The admin panel (`admin.html`) is a static, password-gated tool — exactly like the
Árajánlat builder — but it stores **blog posts** and **website inquiries** in a free
[Supabase](https://supabase.com) project so the data syncs across every device and
published posts appear live on the public blog.

You only do this once.

---

## 1. Create the project

1. Go to <https://supabase.com> → **Start your project** → sign in with GitHub/Google.
2. **New project**. Name it `compass`, pick a strong database password (save it),
   region **Frankfurt (eu-central-1)** (closest to Hungary, GDPR-friendly).
3. Wait ~2 minutes for it to provision.

## 2. Paste your keys into `supabase-config.js`

Project → **Settings** (gear) → **API**. Copy two values:

| Field in Supabase            | Paste into `supabase-config.js` |
|------------------------------|---------------------------------|
| **Project URL**              | `url`                           |
| **Project API keys → `anon` `public`** | `anonKey`              |

> The `anon` key is **public and safe to commit**. Never paste the `service_role` key anywhere in this repo.

```js
window.COMPASS_SUPABASE = {
  url: 'https://xxxxxxxx.supabase.co',
  anonKey: 'eyJhbGciOi....(long string)....',
  bucket: 'blog-covers'
};
```

## 3. Create the tables + security rules

Project → **SQL Editor** → **New query** → paste **all** of the SQL below → **Run**.

```sql
-- ============ POSTS ============
create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  published_at  timestamptz,
  status        text not null default 'draft',   -- draft | published
  lang          text not null default 'hu',      -- hu | en
  slug          text unique not null,
  title         text not null,
  excerpt       text,
  body          text,                            -- HTML
  cover_url     text,
  category      text,                            -- websites | marketing | operations | seo
  tags          text[] default '{}',
  author        text default 'Compass Systems',
  read_minutes  int,
  featured      boolean not null default false
);

-- ============ INQUIRIES ============
create table if not exists public.inquiries (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  status          text not null default 'new',   -- new | read | replied | archived
  lang            text default 'hu',
  name            text,
  company         text,
  email           text,
  phone           text,
  message         text,
  bottleneck      text[] default '{}',           -- step 1 (multi)
  response_speed  text,                           -- step 2
  tools           text[] default '{}',           -- step 3 (multi)
  budget          text,                           -- step 4
  source          text default 'contact-brief'
);

-- ============ ROW LEVEL SECURITY ============
alter table public.posts     enable row level security;
alter table public.inquiries enable row level security;

-- Public (anon) may READ only published posts.
create policy "public reads published posts"
  on public.posts for select
  to anon
  using (status = 'published');

-- Signed-in admin has full control of posts.
create policy "admin manages posts"
  on public.posts for all
  to authenticated
  using (true) with check (true);

-- Public (anon) may SUBMIT an inquiry, but never read them.
create policy "public submits inquiries"
  on public.inquiries for insert
  to anon
  with check (true);

-- Signed-in admin can read / update / delete inquiries.
create policy "admin reads inquiries"
  on public.inquiries for select to authenticated using (true);
create policy "admin updates inquiries"
  on public.inquiries for update to authenticated using (true) with check (true);
create policy "admin deletes inquiries"
  on public.inquiries for delete to authenticated using (true);

-- keep updated_at fresh on posts
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists posts_touch on public.posts;
create trigger posts_touch before update on public.posts
  for each row execute function public.touch_updated_at();
```

## 4. Create the cover-image storage bucket

Project → **Storage** → **New bucket**:

- Name: `blog-covers`
- **Public bucket: ON** (cover images must be readable by visitors)
- Create.

Then allow the signed-in admin to upload. **Storage → Policies → `blog-covers` → New policy → custom**, paste:

```sql
create policy "admin uploads covers"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'blog-covers');

create policy "admin updates covers"
  on storage.objects for update to authenticated
  using (bucket_id = 'blog-covers');

create policy "public reads covers"
  on storage.objects for select to anon
  using (bucket_id = 'blog-covers');
```

## 5. Create your admin login

Project → **Authentication** → **Users** → **Add user** → **Create new user**:

- Email: e.g. `marton.orosz16@gmail.com`
- Password: a strong one (this is what you'll type into the admin gate)
- **Auto Confirm User: ON**

Do this for each founder who needs access. That's it — no public sign-ups are
possible (email confirmations / sign-ups stay disabled by default).

---

## Done

- Open `admin.html` (linked as the small **Admin** button in the site footer).
- Sign in with the email + password from step 5.
- Write posts in **Blog**. Website briefs no longer land here — they go straight
  into the ERP as leads (`/erp/leads`), in the ERP's own Supabase project.
  The `inquiries` table below is kept only so historical rows stay readable.
- Published posts appear automatically on `blog.html` / `blog-en.html` and open in `blog-post.html`.

If `supabase-config.js` still has the placeholder values, the public site keeps its
existing static demo content and the contact form falls back to an email link — nothing breaks.
