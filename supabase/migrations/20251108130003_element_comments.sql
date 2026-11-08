-- Step 3 part C: element comments with realtime.

create table public.element_comments (
  id uuid primary key default gen_random_uuid(),
  element_id uuid not null,
  page_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint element_comments_element_page_fkey
    foreign key (element_id, page_id)
    references public.page_elements (id, page_id)
    on delete cascade,
  constraint element_comments_body_trimmed
    check (char_length(btrim(body)) > 0)
);

create index element_comments_element_created_idx
  on public.element_comments (element_id, created_at);

create index element_comments_page_id_idx
  on public.element_comments (page_id);

create or replace function public.element_comments_reject_section()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_type public.page_element_type;
begin
  select type into v_type
  from public.page_elements
  where id = new.element_id and page_id = new.page_id;

  if v_type is null then
    raise exception 'ELEMENT_NOT_FOUND';
  end if;

  if v_type = 'section' then
    raise exception 'SECTION_CANNOT_BE_COMMENTED';
  end if;

  return new;
end;
$$;

create trigger element_comments_reject_section
  before insert on public.element_comments
  for each row
  execute function public.element_comments_reject_section();

alter table public.element_comments enable row level security;

create policy element_comments_select_member
  on public.element_comments
  for select
  to authenticated
  using (public.is_page_member(page_id));

grant select on public.element_comments to authenticated;

create or replace view public.element_comment_counts
with (security_invoker = true) as
select
  page_id,
  element_id,
  count(*)::bigint as count
from public.element_comments
group by page_id, element_id;

grant select on public.element_comment_counts to authenticated;

alter publication supabase_realtime add table public.element_comments;
