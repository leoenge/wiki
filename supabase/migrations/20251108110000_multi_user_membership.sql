-- Multi-user membership, permissions, and page metadata (step 2 part A).

create extension if not exists pgcrypto with schema extensions;

-- Pages: owner -> created_by + invite + version tracking
alter table public.pages
  add column created_by uuid null references auth.users (id) on delete set null,
  add column invite_token text null,
  add column version bigint not null default 1,
  add column last_published_by uuid null references public.profiles (id) on delete set null,
  add column last_published_at timestamptz null;

update public.pages
set created_by = owner_id
where created_by is null;

update public.pages
set invite_token = encode(extensions.gen_random_bytes(24), 'hex')
where invite_token is null;

alter table public.pages
  alter column invite_token set not null;

alter table public.pages
  add constraint pages_invite_token_key unique (invite_token);

drop index if exists public.pages_owner_id_created_at_idx;

drop policy if exists pages_select_own on public.pages;
drop policy if exists page_elements_select_own on public.page_elements;

alter table public.pages
  drop column owner_id;

create table public.page_members (
  page_id uuid not null references public.pages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  added_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (page_id, user_id)
);

create index page_members_user_id_idx on public.page_members (user_id);

insert into public.page_members (page_id, user_id, added_by)
select p.id, p.created_by, null
from public.pages p
where p.created_by is not null
on conflict do nothing;

create or replace function public.add_page_creator_as_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.page_members (page_id, user_id, added_by)
    values (new.id, new.created_by, null)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger pages_add_creator_member
  after insert on public.pages
  for each row
  execute function public.add_page_creator_as_member();

create or replace function public.is_page_member(p_page_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.page_members pm
    where pm.page_id = p_page_id
      and pm.user_id = (select auth.uid())
  );
$$;

create or replace function public.shares_page_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = (select auth.uid())
    or exists (
      select 1
      from public.page_members a
      join public.page_members b on b.page_id = a.page_id
      where a.user_id = (select auth.uid())
        and b.user_id = p_user_id
    );
$$;

create index if not exists page_elements_image_path_idx
  on public.page_elements (image_path)
  where image_path is not null;

create index if not exists pages_main_image_path_idx
  on public.pages (main_image_path)
  where main_image_path is not null;

create or replace function public.can_read_image_path(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (storage.foldername(p_path))[1] = (select auth.uid()::text)
    or exists (
      select 1
      from public.page_elements pe
      where pe.image_path = p_path
        and public.is_page_member(pe.page_id)
    )
    or exists (
      select 1
      from public.pages p
      where p.main_image_path = p_path
        and public.is_page_member(p.id)
    );
$$;

create or replace function public.find_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id
  from auth.users
  where lower(email) = lower(btrim(p_email))
  limit 1;
$$;

revoke all on function public.find_user_id_by_email(text) from public;
revoke all on function public.find_user_id_by_email(text) from anon;
revoke all on function public.find_user_id_by_email(text) from authenticated;
grant execute on function public.find_user_id_by_email(text) to service_role;

create or replace function public.remove_page_member(p_page_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  perform 1 from public.pages where id = p_page_id for update;

  select count(*)::int into v_count
  from public.page_members
  where page_id = p_page_id;

  if v_count <= 1 then
    raise exception 'PAGE_NEEDS_MEMBER';
  end if;

  delete from public.page_members
  where page_id = p_page_id and user_id = p_user_id;

  delete from public.page_drafts
  where page_id = p_page_id and user_id = p_user_id;
end;
$$;

revoke all on function public.remove_page_member(uuid, uuid) from public;
revoke all on function public.remove_page_member(uuid, uuid) from anon;
revoke all on function public.remove_page_member(uuid, uuid) from authenticated;
grant execute on function public.remove_page_member(uuid, uuid) to service_role;

-- RLS: membership-based reads
create policy pages_select_member
  on public.pages
  for select
  to authenticated
  using (public.is_page_member(id));

create policy page_elements_select_member
  on public.page_elements
  for select
  to authenticated
  using (public.is_page_member(page_id));

alter table public.page_members enable row level security;

create policy page_members_select_member
  on public.page_members
  for select
  to authenticated
  using (public.is_page_member(page_id));

grant select on public.page_members to authenticated;

drop policy if exists page_drafts_select_own on public.page_drafts;

create policy page_drafts_select_own_member
  on public.page_drafts
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and public.is_page_member(page_id)
  );

drop policy if exists profiles_select_own on public.profiles;

create policy profiles_select_shared_pages
  on public.profiles
  for select
  to authenticated
  using (public.shares_page_with(id));

drop policy if exists images_select_own on public.images;

create policy images_select_usable
  on public.images
  for select
  to authenticated
  using (public.can_read_image_path(path));

drop policy if exists images_select_own_folder on storage.objects;

create policy images_select_member_paths
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'images'
    and public.can_read_image_path(name)
  );
