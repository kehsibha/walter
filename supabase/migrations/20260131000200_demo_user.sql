-- Public demo mode support:
-- 1) Allow `public.users` to contain a demo row without `auth.users`
-- 2) Seed a deterministic demo user id.

-- Drop FK to auth.users (lets us create a demo user without auth).
alter table public.users
drop constraint if exists users_id_fkey;

-- Seed demo user
insert into public.users (id, email, created_at, last_login, onboarding_complete)
values (
  '00000000-0000-0000-0000-000000000001',
  'demo@walter.local',
  now(),
  now(),
  true
)
on conflict (id) do nothing;

