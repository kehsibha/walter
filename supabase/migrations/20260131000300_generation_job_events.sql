-- Append-only job event stream for richer UX while generating.

create table if not exists public.generation_job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.generation_jobs (id) on delete cascade,
  kind text not null,
  message text not null,
  items text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create index if not exists generation_job_events_job_id_created_at_idx
on public.generation_job_events (job_id, created_at desc);

-- RLS optional; service role bypasses RLS. Keep enabled for safety.
alter table public.generation_job_events enable row level security;

