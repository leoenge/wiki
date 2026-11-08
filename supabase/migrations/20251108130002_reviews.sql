-- Step 3 part B: reviews on map and review element items.

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null,
  page_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint null check (rating between 0 and 10),
  comment text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_item_page_fkey
    foreign key (item_id, page_id)
    references public.page_element_items (id, page_id)
    on delete cascade,
  constraint reviews_rating_or_comment
    check (rating is not null or comment is not null),
  constraint reviews_comment_trimmed
    check (comment is null or char_length(btrim(comment)) > 0),
  constraint reviews_item_user_key unique (item_id, user_id)
);

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row
  execute function public.set_updated_at();

create index reviews_page_id_idx on public.reviews (page_id);
create index reviews_item_id_idx on public.reviews (item_id);

create or replace function public.reviews_check_reviewable_item()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_element_type public.page_element_type;
begin
  select pe.type into v_element_type
  from public.page_element_items pei
  join public.page_elements pe
    on pe.id = pei.element_id and pe.page_id = pei.page_id
  where pei.id = new.item_id and pei.page_id = new.page_id;

  if v_element_type is null then
    raise exception 'ITEM_NOT_FOUND';
  end if;

  if v_element_type not in ('map', 'review') then
    raise exception 'ITEM_NOT_REVIEWABLE';
  end if;

  return new;
end;
$$;

create trigger reviews_check_reviewable_item
  before insert or update on public.reviews
  for each row
  execute function public.reviews_check_reviewable_item();

alter table public.reviews enable row level security;

create policy reviews_select_member
  on public.reviews
  for select
  to authenticated
  using (public.is_page_member(page_id));

grant select on public.reviews to authenticated;
