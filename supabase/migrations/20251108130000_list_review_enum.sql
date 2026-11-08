-- Step 3 part A: new page element types (enum values must be committed alone).

alter type public.page_element_type add value if not exists 'list';
alter type public.page_element_type add value if not exists 'review';
