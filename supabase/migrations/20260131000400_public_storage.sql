-- Allow public (anonymous) read access to video and thumbnail storage buckets.
-- This is needed for the public demo mode where users aren't authenticated.

-- Public read for videos bucket (anonymous access)
do $$
begin
  create policy "videos_read_public"
  on storage.objects
  for select
  to anon
  using (bucket_id = 'videos');
exception when duplicate_object then null;
end $$;

-- Public read for thumbnails bucket (anonymous access)
do $$
begin
  create policy "thumbnails_read_public"
  on storage.objects
  for select
  to anon
  using (bucket_id = 'thumbnails');
exception when duplicate_object then null;
end $$;
