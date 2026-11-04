-- Per-user page edit drafts (JSON snapshot); writes via API only.

create table public.page_drafts (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint page_drafts_page_user_key unique (page_id, user_id)
);

create trigger page_drafts_set_updated_at
  before update on public.page_drafts
  for each row
  execute function public.set_updated_at();

create index page_drafts_user_id_idx on public.page_drafts (user_id);

alter table public.page_drafts enable row level security;

create policy page_drafts_select_own
  on public.page_drafts
  for select
  to authenticated
  using (user_id = (select auth.uid()));

grant select on public.page_drafts to authenticated;
