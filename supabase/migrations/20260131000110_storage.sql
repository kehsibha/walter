-- Supabase Storage buckets and policies for Walter demo.
-- Note: Buckets may already exist; these inserts are idempotent via `on conflict`.

insert into storage.buckets (id, name, public)
values
  ('videos', 'videos', true),
  ('thumbnails', 'thumbnails', true)
on conflict (id) do update
set public = excluded.public;

-- Public read for demo (authenticated users).
do $$
begin
  create policy "videos_read_authenticated"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'videos');
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "thumbnails_read_authenticated"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'thumbnails');
exception when duplicate_object then null;
end $$;

-- Writes only by service role.
do $$
begin
  create policy "videos_write_service"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'videos' and auth.role() = 'service_role');
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "videos_update_service"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'videos' and auth.role() = 'service_role')
  with check (bucket_id = 'videos' and auth.role() = 'service_role');
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "thumbnails_write_service"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'thumbnails' and auth.role() = 'service_role');
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "thumbnails_update_service"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'thumbnails' and auth.role() = 'service_role')
  with check (bucket_id = 'thumbnails' and auth.role() = 'service_role');
exception when duplicate_object then null;
end $$;

