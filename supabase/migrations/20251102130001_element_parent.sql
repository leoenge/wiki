alter table public.page_elements
  add column parent_id uuid null;

alter table public.page_elements
  add constraint page_elements_id_page_id_key unique (id, page_id);

alter table public.page_elements
  add constraint page_elements_parent_fkey
    foreign key (parent_id, page_id)
    references public.page_elements (id, page_id)
    on delete cascade;

alter table public.page_elements
  drop constraint page_elements_text_has_body;

alter table public.page_elements
  add constraint page_elements_text_has_body
    check (type not in ('text', 'section') or text is not null);

drop index if exists public.page_elements_page_id_position_idx;

create index page_elements_page_id_parent_id_position_idx
  on public.page_elements (page_id, parent_id, position);
