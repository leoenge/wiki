create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_first_name text;
begin
  v_first_name := nullif(btrim(new.raw_user_meta_data ->> 'first_name'), '');
  if v_first_name is not null then
    v_first_name := left(v_first_name, 50);
  else
    v_first_name := split_part(coalesce(new.email, ''), '@', 1);
  end if;
  if char_length(btrim(v_first_name)) < 1 then
    v_first_name := 'user';
  end if;

  insert into public.profiles (id, first_name)
  values (new.id, v_first_name);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

insert into public.profiles (id, first_name)
select
  id,
  left(
    coalesce(
      nullif(btrim(raw_user_meta_data ->> 'first_name'), ''),
      nullif(btrim(split_part(coalesce(email, ''), '@', 1)), ''),
      'user'
    ),
    50
  )
from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

grant select on public.profiles to authenticated;
