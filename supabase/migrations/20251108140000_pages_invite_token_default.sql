-- Step 2 follow-up: new pages need invite_token (was backfilled but had no default).

alter table public.pages
  alter column invite_token set default encode(extensions.gen_random_bytes(24), 'hex');
