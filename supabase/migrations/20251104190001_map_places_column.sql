alter table public.page_elements
  add column if not exists places jsonb null;

alter table public.page_elements
  add constraint page_elements_map_has_places
  check (
    (type = 'map' and jsonb_typeof(places) = 'array')
    or (type <> 'map' and places is null)
  );
