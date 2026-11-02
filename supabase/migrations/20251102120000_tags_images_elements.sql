-- Page tags, main image, content elements, and private images storage.

create type public.page_element_type as enum ('image', 'text');

alter table public.pages
  add column tag text,
  add column main_image_path text null;

update public.pages
set tag = 'p' || replace(substr(id::text, 1, 8), '-', '')
where tag is null;

alter table public.pages
  alter column tag set not null;

alter table public.pages
  add constraint pages_tag_format_check
    check (tag ~ '^[a-z0-9][a-z0-9-]{1,29}$');

create unique index pages_tag_key on public.pages (tag);

create table public.page_elements (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  type public.page_element_type not null,
  position int not null,
  text text null,
  image_path text null,
  caption text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint page_elements_image_has_path
    check (type <> 'image' or image_path is not null),
  constraint page_elements_text_has_body
    check (type <> 'text' or text is not null)
);

create trigger page_elements_set_updated_at
  before update on public.page_elements
  for each row
  execute function public.set_updated_at();

create index page_elements_page_id_position_idx
  on public.page_elements (page_id, position);

alter table public.page_elements enable row level security;

create policy page_elements_select_own
  on public.page_elements
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.pages p
      where p.id = page_elements.page_id
        and p.owner_id = (select auth.uid())
    )
  );

grant select on public.page_elements to authenticated;

-- Storage bucket (also declared in config.toml for local dev).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'images',
  'images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy images_insert_own_folder
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy images_select_own_folder
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
