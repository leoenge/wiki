-- Pages owned by auth users; writes go through the API (service role).

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger pages_set_updated_at
  before update on public.pages
  for each row
  execute function public.set_updated_at();

create index pages_owner_id_created_at_idx
  on public.pages (owner_id, created_at desc);

alter table public.pages enable row level security;

create policy pages_select_own
  on public.pages
  for select
  to authenticated
  using (owner_id = (select auth.uid()));

grant select on public.pages to authenticated;
