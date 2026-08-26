-- =====================================================================
-- Compass ERP — website contact brief lands in leads
--
-- The marketing site's /contact.html is a five-step brief, not a plain
-- form: it collects the operational bottleneck, current inbound response
-- speed, the tools we would have to integrate with, and a budget band.
-- Until now that went to a separate `inquiries` table in the website's own
-- Supabase project, where it sat outside the pipeline entirely — scored by
-- nobody, chased by nothing, invisible next to scraped leads.
--
-- Those answers are the most qualifying information we ever get from an
-- inbound prospect, so they should not be flattened into internal_notes.
-- `brief` keeps them intact and queryable on the lead itself.
-- =====================================================================

alter table leads
  add column if not exists brief jsonb;

comment on column leads.brief is
  'Website contact-brief answers: { bottleneck: text[], response_speed, tools: text[], budget, message, lang }. Null for every lead that did not come from the site form.';

-- Inbound brief leads are the ones speed-to-lead cares about most, and the
-- Leads view filters by source constantly. Partial index keeps it cheap.
create index if not exists leads_source_created_idx
  on leads (source, created_at desc);
