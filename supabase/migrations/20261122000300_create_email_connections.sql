create table if not exists public.email_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null check (provider = 'gmail'),
  email text not null,
  refresh_token_ciphertext text not null,
  refresh_token_nonce text not null,
  refresh_token_tag text not null,
  connected_at timestamptz not null default now()
);

alter table public.email_connections enable row level security;

-- No client policies: only trusted server code using the service-role key can access encrypted tokens.
