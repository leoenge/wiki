-- Step 3 part A: list_style and publish support for list and review elements.

alter table public.page_elements
  add column if not exists list_style text null;

alter table public.page_elements
  add constraint page_elements_list_style_values
    check (list_style is null or list_style in ('bullet', 'numbered'));

alter table public.page_elements
  add constraint page_elements_list_style_required
    check (
      (type = 'list' and list_style is not null)
      or (type <> 'list' and list_style is null)
    );

create or replace function public.publish_page_draft(
  p_page_id uuid,
  p_user_id uuid,
  p_content jsonb,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_page public.pages%rowtype;
  v_draft public.page_drafts%rowtype;
  v_elem jsonb;
  v_item jsonb;
  v_elem_id uuid;
  v_elem_type text;
  v_draft_ids uuid[] := '{}';
  v_keep_ids uuid[] := '{}';
  v_pos int;
begin
  select * into v_page from public.pages where id = p_page_id for update;
  if not found then
    raise exception 'PAGE_NOT_FOUND';
  end if;

  if not exists (
    select 1 from public.page_members
    where page_id = p_page_id and user_id = p_user_id
  ) then
    raise exception 'NOT_A_MEMBER';
  end if;

  select * into v_draft
  from public.page_drafts
  where page_id = p_page_id and user_id = p_user_id;

  if not found then
    raise exception 'DRAFT_NOT_FOUND';
  end if;

  if v_draft.base_version <> v_page.version and not p_force then
    return jsonb_build_object(
      'conflict', true,
      'version', v_page.version,
      'last_published_by', v_page.last_published_by,
      'last_published_at', v_page.last_published_at
    );
  end if;

  for v_elem in select * from jsonb_array_elements(coalesce(p_content -> 'elements', '[]'::jsonb))
  loop
    v_elem_id := (v_elem ->> 'id')::uuid;
    v_draft_ids := array_append(v_draft_ids, v_elem_id);

    insert into public.page_elements (
      id,
      page_id,
      type,
      parent_id,
      position,
      text,
      image_path,
      caption,
      image_id,
      list_style
    )
    values (
      v_elem_id,
      p_page_id,
      (v_elem ->> 'type')::public.page_element_type,
      null,
      coalesce((v_elem ->> 'position')::int, 0),
      case
        when (v_elem ->> 'type') in ('text', 'section') then v_elem ->> 'text'
        else null
      end,
      case when (v_elem ->> 'type') = 'image' then v_elem ->> 'image_path' else null end,
      case when (v_elem ->> 'type') = 'image' then coalesce(v_elem ->> 'caption', '') else null end,
      case
        when (v_elem ->> 'type') = 'image' and v_elem ? 'image_id'
        then nullif(v_elem ->> 'image_id', '')::uuid
        else null
      end,
      case when (v_elem ->> 'type') = 'list' then v_elem ->> 'list_style' else null end
    )
    on conflict (id) do update set
      type = excluded.type,
      parent_id = null,
      position = excluded.position,
      text = excluded.text,
      image_path = excluded.image_path,
      caption = excluded.caption,
      image_id = excluded.image_id,
      list_style = excluded.list_style,
      updated_at = now();
  end loop;

  for v_elem in select * from jsonb_array_elements(coalesce(p_content -> 'elements', '[]'::jsonb))
  loop
    v_elem_id := (v_elem ->> 'id')::uuid;
    v_elem_type := v_elem ->> 'type';
    v_keep_ids := array_append(v_keep_ids, v_elem_id);

    update public.page_elements
    set
      parent_id = case
        when v_elem ? 'parent_id' and v_elem ->> 'parent_id' is not null
        then (v_elem ->> 'parent_id')::uuid
        else null
      end,
      position = coalesce((v_elem ->> 'position')::int, 0),
      updated_at = now()
    where id = v_elem_id and page_id = p_page_id;

    if v_elem_type in ('map', 'list', 'review') and v_elem ? 'items' then
      v_pos := 0;
      for v_item in select * from jsonb_array_elements(v_elem -> 'items')
      loop
        insert into public.page_element_items (
          id,
          element_id,
          page_id,
          position,
          label,
          data
        )
        values (
          (v_item ->> 'id')::uuid,
          v_elem_id,
          p_page_id,
          v_pos,
          v_item ->> 'label',
          coalesce(v_item -> 'data', '{}'::jsonb)
        )
        on conflict (id) do update set
          element_id = excluded.element_id,
          page_id = excluded.page_id,
          position = excluded.position,
          label = excluded.label,
          data = excluded.data,
          updated_at = now();
        v_pos := v_pos + 1;
      end loop;

      delete from public.page_element_items pei
      where pei.element_id = v_elem_id
        and pei.page_id = p_page_id
        and pei.id not in (
          select (item ->> 'id')::uuid
          from jsonb_array_elements(v_elem -> 'items') as item
        );
    elsif v_elem_type in ('map', 'list', 'review') then
      delete from public.page_element_items
      where element_id = v_elem_id and page_id = p_page_id;
    end if;
  end loop;

  delete from public.page_elements pe
  where pe.page_id = p_page_id
    and not (pe.id = any (v_draft_ids));

  update public.pages
  set
    main_image_path = nullif(p_content ->> 'main_image_path', ''),
    main_image_id = case
      when p_content ? 'main_image_id' and p_content ->> 'main_image_id' is not null
      then (p_content ->> 'main_image_id')::uuid
      else null
    end,
    version = version + 1,
    last_published_by = p_user_id,
    last_published_at = now(),
    updated_at = now()
  where id = p_page_id
  returning * into v_page;

  delete from public.page_drafts
  where page_id = p_page_id and user_id = p_user_id;

  return jsonb_build_object(
    'conflict', false,
    'version', v_page.version
  );
end;
$$;

revoke all on function public.publish_page_draft(uuid, uuid, jsonb, boolean) from public;
revoke all on function public.publish_page_draft(uuid, uuid, jsonb, boolean) from anon;
revoke all on function public.publish_page_draft(uuid, uuid, jsonb, boolean) from authenticated;
grant execute on function public.publish_page_draft(uuid, uuid, jsonb, boolean) to service_role;
