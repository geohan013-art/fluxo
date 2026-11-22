create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  plan text not null default 'standard' check (plan in ('standard')),
  status text not null default 'inactive',
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- No client policies: only trusted server code using the service-role key can read or write subscriptions.
