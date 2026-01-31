-- Walter demo schema (public) + RLS policies.
-- Apply this in Supabase SQL editor or via `supabase db push`.

-- Extensions
create extension if not exists "pgcrypto";

-- Helpers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Users profile table (mirrors auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  created_at timestamptz not null default now(),
  last_login timestamptz,
  onboarding_complete boolean not null default false
);

alter table public.users enable row level security;

create policy "users_read_own"
on public.users
for select
to authenticated
using (id = auth.uid());

create policy "users_update_own"
on public.users
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Auto-create profile row on signup.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, created_at, last_login, onboarding_complete)
  values (new.id, new.email, now(), now(), false)
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

-- Preferences
create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  topic text not null,
  category text,
  geographic_scope text,
  priority integer not null default 5 check (priority >= 1 and priority <= 10),
  created_at timestamptz not null default now()
);

create index if not exists user_preferences_user_id_idx
on public.user_preferences (user_id, created_at desc);

alter table public.user_preferences enable row level security;

create policy "prefs_crud_own"
on public.user_preferences
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Articles (aggregator + Exa)
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  headline text not null,
  content_url text not null unique,
  source text not null,
  published_at timestamptz,
  ingested_at timestamptz not null default now(),
  full_text text,
  topics text[] not null default '{}'::text[],
  geographic_scope text
);

create index if not exists articles_published_at_idx
on public.articles (published_at desc nulls last);

create index if not exists articles_ingested_at_idx
on public.articles (ingested_at desc);

create index if not exists articles_topics_gin_idx
on public.articles using gin (topics);

alter table public.articles enable row level security;

create policy "articles_read_authenticated"
on public.articles
for select
to authenticated
using (true);

create policy "articles_write_service"
on public.articles
for insert
to authenticated
with check (auth.role() = 'service_role');

create policy "articles_update_service"
on public.articles
for update
to authenticated
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "articles_delete_service"
on public.articles
for delete
to authenticated
using (auth.role() = 'service_role');

-- Summaries (Axios JSON)
create table if not exists public.summaries (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references public.articles (id) on delete set null,
  axios_summary jsonb not null,
  fact_check_score real,
  created_at timestamptz not null default now()
);

create index if not exists summaries_created_at_idx
on public.summaries (created_at desc);

alter table public.summaries enable row level security;

create policy "summaries_read_authenticated"
on public.summaries
for select
to authenticated
using (true);

create policy "summaries_write_service"
on public.summaries
for insert
to authenticated
with check (auth.role() = 'service_role');

create policy "summaries_update_service"
on public.summaries
for update
to authenticated
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "summaries_delete_service"
on public.summaries
for delete
to authenticated
using (auth.role() = 'service_role');

-- Videos (Storage URLs)
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  summary_id uuid references public.summaries (id) on delete set null,
  video_url text not null,
  thumbnail_url text,
  duration integer,
  script text,
  fal_job_id text,
  created_at timestamptz not null default now()
);

create index if not exists videos_created_at_idx
on public.videos (created_at desc);

alter table public.videos enable row level security;

create policy "videos_read_authenticated"
on public.videos
for select
to authenticated
using (true);

create policy "videos_write_service"
on public.videos
for insert
to authenticated
with check (auth.role() = 'service_role');

create policy "videos_update_service"
on public.videos
for update
to authenticated
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "videos_delete_service"
on public.videos
for delete
to authenticated
using (auth.role() = 'service_role');

-- User ↔ content joins (personalized feed)
create table if not exists public.user_content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  viewed boolean not null default false,
  view_duration integer not null default 0,
  liked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, video_id)
);

create index if not exists user_content_user_id_idx
on public.user_content (user_id, created_at desc);

alter table public.user_content enable row level security;

create policy "user_content_read_own"
on public.user_content
for select
to authenticated
using (user_id = auth.uid());

create policy "user_content_update_own"
on public.user_content
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "user_content_insert_service"
on public.user_content
for insert
to authenticated
with check (auth.role() = 'service_role');

create policy "user_content_delete_service"
on public.user_content
for delete
to authenticated
using (auth.role() = 'service_role');

-- Generation jobs (worker polls this)
create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  step text,
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  payload jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists generation_jobs_status_idx
on public.generation_jobs (status, created_at desc);

create trigger generation_jobs_set_updated_at
before update on public.generation_jobs
for each row execute procedure public.set_updated_at();

alter table public.generation_jobs enable row level security;

create policy "jobs_read_own"
on public.generation_jobs
for select
to authenticated
using (user_id = auth.uid());

create policy "jobs_insert_own"
on public.generation_jobs
for insert
to authenticated
with check (user_id = auth.uid());

create policy "jobs_update_service"
on public.generation_jobs
for update
to authenticated
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

