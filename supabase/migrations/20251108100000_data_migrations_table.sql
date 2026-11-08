create table public.data_migrations (
  id text primary key,
  applied_at timestamptz not null default now()
);

alter table public.data_migrations enable row level security;
