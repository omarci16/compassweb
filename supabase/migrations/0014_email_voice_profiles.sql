-- =====================================================================
-- Compass ERP — Email Studio: trainable Voice Profiles + Campaigns
--
-- Today every outreach/proposal/follow-up email comes from a single
-- hardcoded system prompt per situation (lib/ai/prompts/*.ts) — no way for
-- the founders to adjust tone, and no way to run two tones head-to-head.
--
-- email_voice_profiles holds a trainable "voice" (tone, few-shot examples,
-- banned phrases, visual style) scoped to a situation + optionally a niche/
-- offer_track. email_campaigns assigns one profile to a lead segment and
-- gives outreach_drafts something to roll performance up by.
--
-- Zero-regression on day one: this migration seeds one global-default
-- profile per situation, transcribing today's hardcoded prompt content
-- verbatim, so generated output is unchanged until founders customize.
--
-- Idempotent: safe to re-run.
-- =====================================================================

create table if not exists email_voice_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  name text not null,

  -- Which drafting call site this profile applies to.
  -- cold_first_touch | cold_followup | re_engagement | proposal | deal_followup
  situation text not null,

  -- Scope. null = universal (applies across all niches / both offer tracks).
  niche text,
  offer_track text,

  -- Automatic resolution only ever picks an is_default=true, active=true row.
  -- Non-default profiles are reachable only via explicit Campaign assignment
  -- or the Email Studio sandbox picker.
  is_default boolean not null default false,
  active boolean not null default true,

  -- The trainable voice itself.
  tone_traits jsonb not null default '{}'::jsonb,
  voice_description text,
  few_shot_examples jsonb not null default '[]'::jsonb,  -- [{subject, body_html, note}]
  banned_phrases text[] not null default '{}',
  required_elements text[] not null default '{}',
  word_count_min integer,
  word_count_max integer,
  signature_block text,
  visual_style_prompt text,
  model_override text,

  created_by uuid references auth.users(id)
);

-- At most one active default per (situation, niche, offer_track) scope.
-- Coalesce nulls to a sentinel so multiple "universal" defaults collide too.
create unique index if not exists email_voice_profiles_one_default_per_scope
  on email_voice_profiles (situation, coalesce(niche, '\0'), coalesce(offer_track, '\0'))
  where active and is_default;

create index if not exists email_voice_profiles_lookup_idx
  on email_voice_profiles (situation, niche, offer_track) where active;

alter table email_voice_profiles enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'email_voice_profiles' and policyname = 'auth read all'
  ) then
    create policy "auth read all" on email_voice_profiles
      for select using (auth.role() = 'authenticated');
  end if;
  if not exists (
    select 1 from pg_policies
    where tablename = 'email_voice_profiles' and policyname = 'auth write all'
  ) then
    create policy "auth write all" on email_voice_profiles
      for all using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;

create or replace trigger email_voice_profiles_updated_at before update on email_voice_profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Campaigns: a lead segment + an assigned Voice Profile + batch tracking.
-- ---------------------------------------------------------------------

create table if not exists email_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  name text not null,
  situation text not null,
  niche text,
  offer_track text,

  voice_profile_id uuid references email_voice_profiles(id) not null,

  status text not null default 'draft',  -- draft | active | completed | archived
  lead_filter jsonb not null default '{}'::jsonb,  -- frozen segment-criteria snapshot
  target_count integer,

  created_by uuid references auth.users(id)
);

create index if not exists email_campaigns_status_idx
  on email_campaigns(status, created_at desc);

alter table email_campaigns enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'email_campaigns' and policyname = 'auth read all'
  ) then
    create policy "auth read all" on email_campaigns
      for select using (auth.role() = 'authenticated');
  end if;
  if not exists (
    select 1 from pg_policies
    where tablename = 'email_campaigns' and policyname = 'auth write all'
  ) then
    create policy "auth write all" on email_campaigns
      for all using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;

create or replace trigger email_campaigns_updated_at before update on email_campaigns
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- outreach_drafts: attribute every draft to the profile that wrote it (and,
-- when generated through a campaign push, to that campaign) so performance
-- can be rolled up by profile/campaign later.
-- ---------------------------------------------------------------------

alter table outreach_drafts
  add column if not exists campaign_id uuid references email_campaigns(id) on delete set null,
  add column if not exists voice_profile_id uuid references email_voice_profiles(id);

create index if not exists outreach_drafts_campaign_idx
  on outreach_drafts(campaign_id) where campaign_id is not null;
create index if not exists outreach_drafts_voice_profile_idx
  on outreach_drafts(voice_profile_id) where voice_profile_id is not null;

-- ---------------------------------------------------------------------
-- Seed: one global default per situation, transcribing today's hardcoded
-- prompts verbatim (lib/ai/prompts/cold-outreach.ts, draft-proposal.ts,
-- draft-followup.ts) — plus one exact needs_site/upgrade split since that
-- branch already differs in the current hardcoded prompts.
-- ---------------------------------------------------------------------

insert into email_voice_profiles (
  name, situation, niche, offer_track, is_default, active,
  tone_traits, voice_description, banned_phrases, word_count_min, word_count_max,
  signature_block, visual_style_prompt
)
select * from (values
  (
    'Alapértelmezett — első megkeresés (nincs oldal)',
    'cold_first_touch', null::text, 'needs_site', true, true,
    '{"register": "magazas", "warmth": "constructive", "directness": "soft"}'::jsonb,
    'Anyanyelvi szintű, kifogástalan magyar, következetes magázás. A hiányosságokat lehetőségként mutatja be, soha nem bántja a meglévő weboldalt (vagy annak hiányát). A vizuális koncepció a fő horog, ajándékként bevezetve.',
    array[
      'Remélem, levelem jó egészségben éri',
      'Remélem, jól van',
      'Bemutatkozni szeretnék',
      'Engedjék meg, hogy bemutatkozzam',
      'Lehetőséget látunk arra, hogy',
      'A mai gyorsan változó digitális világban',
      'értéket teremteni',
      'lehetőséget feltárni'
    ],
    90, 140,
    E'Üdvözlettel,\nCompass Marketing',
    null::text
  ),
  (
    'Alapértelmezett — első megkeresés (van oldal, upgrade)',
    'cold_first_touch', null::text, 'upgrade', true, true,
    '{"register": "magazas", "warmth": "constructive", "directness": "soft", "grounding": "verified_signals_only"}'::jsonb,
    'Elismeri, hogy a meglévő oldal szolid alap, majd 2-3 konkrét, ELLENŐRZÖTT jelre alapozott fejlesztési lehetőséget mutat be üzleti haszonként megfogalmazva. Soha nem talál ki hiányosságot.',
    array[
      'Remélem, jól van',
      'Bemutatkozni szeretnék',
      'A mai gyorsan változó digitális világban',
      'értéket teremteni',
      'lehetőséget feltárni'
    ],
    90, 150,
    E'Üdvözlettel,\nCompass Marketing',
    null::text
  ),
  (
    'Alapértelmezett — követő levél (cold follow-up)',
    'cold_followup', null::text, null::text, true, true,
    '{"register": "magazas", "warmth": "light", "directness": "soft"}'::jsonb,
    'Nagyon rövid, nem tolakodó emlékeztető a korábban küldött vizuális koncepcióra. Nem ismétli meg az első levelet.',
    array['nem kaptam választ', 'csak rákérdeznék'],
    40, 70,
    E'Üdvözlettel,\nCompass Marketing',
    null::text
  ),
  (
    'Alapértelmezett — re-engagement (30/60/90 nap)',
    're_engagement', null::text, null::text, true, true,
    '{"register": "magazas", "warmth": "light", "directness": "soft"}'::jsonb,
    'Visszatérő megkeresés egy régebben elhidegült lead felé — barátságos, nyomásmentes, nem hivatkozik kudarcra.',
    array['nem kaptam választ', 'sajnálatos módon'],
    40, 90,
    E'Üdvözlettel,\nCompass Marketing',
    null::text
  ),
  (
    'Alapértelmezett — ajánlat (proposal)',
    'proposal', null::text, null::text, true, true,
    '{"register": "confident_warm_professional"}'::jsonb,
    'Magabiztos, meleg, professzionális hangnem — sosem száraz vállalati stílus, sosem túl laza. Az olvasó egy magyar KKV-tulajdonos; konkrétan hivatkozik az ő vállalkozásukra az enrichment summary alapján. Rövid bekezdések, egyértelmű, puha CTA a végén.',
    array[]::text[],
    null, null,
    E'Üdvözlettel,\nCompass Marketing',
    null::text
  ),
  (
    'Alapértelmezett — üzlet utáni követés (deal follow-up)',
    'deal_followup', null::text, null::text, true, true,
    '{"register": "warm_non_pushy"}'::jsonb,
    'Rövid, meleg, nem tolakodó emlékeztető, miután az ajánlatot már látták. Hivatkozik a korábban bemutatott konkrét koncepcióra. Legfeljebb 4 rövid mondat, alacsony nyomású kérdéssel zárva.',
    array[]::text[],
    null, null,
    E'Üdvözlettel,\nCompass Marketing',
    null::text
  )
) as seed(
  name, situation, niche, offer_track, is_default, active,
  tone_traits, voice_description, banned_phrases, word_count_min, word_count_max,
  signature_block, visual_style_prompt
)
where not exists (
  select 1 from email_voice_profiles p
  where p.situation = seed.situation
    and p.niche is not distinct from seed.niche
    and p.offer_track is not distinct from seed.offer_track
    and p.is_default
);
