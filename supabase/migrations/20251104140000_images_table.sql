-- Image metadata layer (path in storage, EXIF-derived fields on register).

create table public.images (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  path text not null,
  taken_at timestamptz not null,
  latitude double precision null,
  longitude double precision null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint images_path_key unique (path),
  constraint images_latitude_range check (
    latitude is null or (latitude >= -90 and latitude <= 90)
  ),
  constraint images_longitude_range check (
    longitude is null or (longitude >= -180 and longitude <= 180)
  )
);

create trigger images_set_updated_at
  before update on public.images
  for each row
  execute function public.set_updated_at();

create index images_owner_id_taken_at_idx
  on public.images (owner_id, taken_at desc);

alter table public.images enable row level security;

create policy images_select_own
  on public.images
  for select
  to authenticated
  using (owner_id = (select auth.uid()));

grant select on public.images to authenticated;

alter table public.page_elements
  add column image_id uuid null references public.images (id) on delete set null;

alter table public.pages
  add column main_image_id uuid null references public.images (id) on delete set null;

insert into public.images (owner_id, path, taken_at)
select distinct on (o.name)
  (storage.foldername(o.name))[1]::uuid as owner_id,
  o.name as path,
  o.created_at as taken_at
from storage.objects o
where o.bucket_id = 'images'
order by o.name, o.created_at asc
on conflict (path) do nothing;

update public.page_elements pe
set image_id = i.id
from public.images i
where pe.type = 'image'
  and pe.image_path is not null
  and pe.image_path = i.path;

update public.pages p
set main_image_id = i.id
from public.images i
where p.main_image_path is not null
  and p.main_image_path = i.path;
