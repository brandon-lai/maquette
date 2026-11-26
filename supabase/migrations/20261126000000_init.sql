create table if not exists public.room_snapshots (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  project jsonb not null,
  created_at timestamptz not null default now(),
  check (length(token_hash) = 64),
  check (octet_length(project::text) <= 100000)
);
alter table public.room_snapshots enable row level security;
revoke all on public.room_snapshots from public;
-- Server-only capability access. No anon/authenticated data API policies.
