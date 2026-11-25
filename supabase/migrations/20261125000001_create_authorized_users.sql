create table if not exists public.authorized_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  note text
);

alter table public.authorized_users enable row level security;

-- Only the service role can read/write this table (trusted server code).
-- No client policies: users cannot see or modify the whitelist directly.
