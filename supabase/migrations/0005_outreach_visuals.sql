-- =====================================================================
-- Compass ERP — outreach visuals
-- Public Supabase Storage bucket for the visual concept images that we
-- attach to cold outreach emails. Public so Resend-delivered HTML can
-- reference the image directly in <img src="...">.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'outreach-visuals',
  'outreach-visuals',
  true,
  10485760, -- 10 MB per image
  array['image/png','image/jpeg','image/webp','image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Allow service-role uploads + public reads. RLS on storage.objects is
-- already enabled by default in Supabase; we just add a permissive read
-- policy for this single bucket.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'outreach_visuals_public_read'
  ) then
    create policy "outreach_visuals_public_read"
      on storage.objects for select
      using (bucket_id = 'outreach-visuals');
  end if;
end $$;
