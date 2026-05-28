-- Fix: replace partial unique index on leads.gmaps_place_id with a full
-- unique index so Supabase upsert's ON CONFLICT (gmaps_place_id) DO NOTHING
-- can infer it. PostgreSQL unique indexes allow multiple NULLs natively, so
-- the dedup guarantee is identical — only the partial-index inference issue
-- is removed.
drop index if exists leads_gmaps_place_unique;
create unique index leads_gmaps_place_unique on leads(gmaps_place_id);
