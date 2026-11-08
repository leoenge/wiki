# Step 1: Foundations

Read `README.md` in this folder first for product context, repo layout, style rules and the list of final decisions.

## Goal

Lay the groundwork that steps 2 and 3 depend on, with low risk and no change to who can access what:

1. A way to migrate the local database without resetting it, plus a Python runner for data migrations.
2. A first name for every user, collected at sign up, stored in a `profiles` table and used as the display name.
3. A settings dialog on the page view where the page name and tag can be changed, built with a view transition shell that step 2 fills with a Share view.

## Out of scope

- Membership, sharing, invites (step 2). In this step only the single existing owner can use the settings dialog, because the API still checks ownership.
- Editing your own first name after sign up.
- Production migration flow. Only the local Supabase setup exists. Document the production approach briefly but do not build it.

## Part A: Migration tooling

### Current state

`package.json` only has `db:reset` (`supabase db reset`), which wipes the database. Local Postgres listens on port 54332 (see `supabase/config.toml`, section `[db]`), default credentials `postgres` and `postgres`.

### Schema migrations

Add root scripts to `package.json`:

- `db:migrate`: `supabase migration up --local`. Applies only pending files from `supabase/migrations` without touching existing data.
- `db:migration:new`: `supabase migration new`. Usage: `pnpm db:migration:new some_name`.
- `data:migrate`: runs the Python runner (below).
- `db:upgrade`: runs `db:migrate`, then `db:types`, then `data:migrate`. This is the one command to run after pulling changes.

Verify that `pnpm db:migrate` on a database that is already up to date is a no-op, and that it applies a freshly added migration while keeping existing rows.

### Data migration runner (Python)

Purpose: some model changes need existing rows rewritten into a new shape, for example moving values from one column to another or splitting JSON. Plain SQL migrations cover easy cases. For harder ones we write a Python migration. Right now there are none, so the runner ships with an empty `migrations` folder and a template.

Layout:

```
tools/data-migrations/
  run.py
  requirements.txt          psycopg[binary]
  migrations/
    _template.py            not executed (leading underscore)
    NNNN_short_name.py      real migrations, executed in filename order
```

Behavior of `run.py`:

- Connects with `DATABASE_URL`, defaulting to `postgresql://postgres:postgres@127.0.0.1:54332/postgres`.
- Tracks applied migrations in a table `public.data_migrations` (`id text primary key`, `applied_at timestamptz not null default now()`). Create this table in a normal SQL migration (via `pnpm db:migration:new data_migrations_table`), with RLS enabled and no policies and no grants, so only the database owner and the service role can touch it.
- Takes a Postgres advisory lock for the duration of the run so two runs cannot overlap.
- Discovers `migrations/*.py` (ignoring names starting with an underscore), sorted by filename. Each module exposes `DESCRIPTION: str` and `run(cursor) -> None`.
- Runs each unapplied migration in its own transaction: call `run(cursor)`, insert the id into `data_migrations`, commit. On any exception roll back and stop with a non zero exit code.
- Flags: `--list` (print applied and pending), `--dry-run` (run pending migrations and roll back instead of committing).
- Migrations must be idempotent where possible, because they might be rerun after a partial failure in a different environment.

Developer setup, to document in the script header: `python3 -m venv tools/data-migrations/.venv`, then install `requirements.txt`. Add `.venv` to `.gitignore`. The pnpm script should call the venv python if it exists, otherwise `python3`.

### AGENTS.md update

Add a section to `AGENTS.md` (keep the existing style rules untouched), for example:

```
## Database changes
- Schema changes go in a new migration (`pnpm db:migration:new name`), never edit an applied migration. Apply with `pnpm db:migrate`, regenerate types with `pnpm db:types`.
- If a data model change requires existing data to be converted into the new shape, add a numbered Python migration in `tools/data-migrations/migrations/` and keep it idempotent. Run with `pnpm data:migrate`. Trivial changes (a new nullable column, a default) do not need one.
- Whenever you change the data model, ask yourself if a data migration is needed, and say so in the PR description either way.
```

### Docs

Add a short section to `docs/production.md` saying that today only the local Supabase exists, and that applying migrations there is `pnpm db:upgrade` (never `db:reset`, which deletes data).

## Part B: First name and profiles

### Why

The app currently has no way to show other people's names. `apps/web/src/lib/userDisplay.ts` can only derive a name for the signed-in user from auth metadata and returns "Unknown" for everyone else. Step 2 and 3 show member names, reviewers and commenters, so names must live in a table other users can read.

### Database (new migration)

Table `public.profiles`:

- `id uuid primary key references auth.users (id) on delete cascade`
- `first_name text not null` with a check that the trimmed length is between 1 and 50
- `created_at`, `updated_at` timestamptz, with the existing `public.set_updated_at()` trigger

Do not store email in profiles. Email lookups in step 2 go through a server side function instead, so emails are never readable by other users.

Trigger: after insert on `auth.users`, a `security definer` function (with `set search_path = ''`) inserts the profile. First name is `nullif(btrim(new.raw_user_meta_data ->> 'first_name'), '')`, truncated to 50 characters, falling back to the part of the email before the `@` so that sign ups that skip the form field (for example manually created users in Studio) never fail.

RLS: enable, with one select policy for `authenticated` limited to your own row for now (`id = (select auth.uid())`). Step 2 widens it to people who share a page with you. Grant select only (writes come through the API or the trigger).

Regenerate types (`pnpm db:types`) and export a `Profile` type from `packages/types`.

### Web

- `AuthView.tsx`: in sign up mode show a required "First name" `TextField` above email. Pass it via `supabase.auth.signUp({ email, password, options: { data: { first_name } } })`. Trim it, cap at 50 characters. Not shown in sign in mode.
- Also fix the redirect after authentication while touching this view: today `RequireAuth` passes `state.from` but `AuthView` always navigates to `/`. After sign in or sign up, navigate to `location.state.from` when present, otherwise `/`. Step 2 relies on this.
- New hook module `apps/web/src/api/profiles.ts` with `useProfiles(ids: string[])`, reading `profiles` from Supabase with `.in("id", ids)`, one TanStack Query cache entry per profile id so lookups are shared across components, and a helper `displayName(profile)`. Unknown or not yet loaded ids render as an empty string while loading and "Unknown" if missing after load.
- Replace `displayNameFromUser` usage. `contributorNameForImagePath` in `userDisplay.ts` is used by `PageElementsList.tsx` for the expanded image viewer. For now resolve the name through `useProfiles` using the uploader id from the path prefix (it will only resolve your own images until step 2 widens the policy, which is fine). Keep `displayNameFromUser` only as a fallback for the current user until profiles load, or delete it if nothing else needs it.

## Part C: Page settings dialog

### Behavior

- On the page view (`apps/web/src/views/PageView.tsx`, component `PageTopBar`) add a settings icon button (Phosphor `GearIcon`) to the right of the Edit button, shown only when not editing.
- Clicking it opens a dialog titled "Settings" with two views and a nice transition between them:
  1. Main view: a "Name" field, a "Tag" field (prefixed with `/`, same styling and `sanitizeTagInput` as `CreatePageView.tsx`), a Save button, and a row "Share" with a Phosphor `CaretRightIcon` that opens view 2.
  2. Share view: in this step a placeholder with a short "Sharing arrives soon" line and a back control. Step 2 replaces it.
- Under the tag field, show a one line note that old links to the previous tag stop working when the tag changes. Only show it once the tag has actually been edited.
- Save is disabled until something changed and valid. Tag conflicts show "Tag is already taken" (the API returns 409). After saving a changed tag, navigate to `/${newTag}` with `replace`, because the page route is keyed by tag. After a name only change, update the cached page.
- Reserved tags must be rejected by the same schema as creation (`RESERVED_TAGS` in `packages/types/src/api/pages.ts`). Add `join` to that list now (step 2 uses `/join/:token`).

### Dialog and transition shell

`apps/web/src/components/Dialog.tsx` wraps a native `<dialog>` with a fixed title string. Extend it minimally:

- Add an optional `onBack` prop. When set, show a Phosphor `CaretLeftIcon` button before the title.
- Create a reusable `ViewSwitcher` component (new file in `components/`) that takes the active view key and renders the matching child. Transition requirements: the outgoing view slides out and fades while the incoming view slides in from the direction of travel (forward goes left, back goes right), about 250 ms with an ease out curve, and the dialog height animates smoothly between the two views (measure the active view with a `ResizeObserver`). Respect `prefers-reduced-motion` by crossfading only. Move focus into the new view after the transition. No borders.
- The dialog title and back button follow the active view ("Settings", "Share").

### API and types

- `packages/types/src/api/pages.ts`: replace `updatePageBodySchema`. It currently only carries `main_image_path` plus image metadata and the main image is actually set when publishing a draft. First check where `updatePage` (`apps/api/src/services/pages.ts`), the route `PATCH /api/pages/:pageId` and `useUpdatePage` (`apps/web/src/api/pages.ts`) are used. If nothing relies on the main image fields, remove them. The new body is `{ name?: string, tag?: string }`, with `name` reusing the create rules (trimmed, 1 to 100) and `tag` reusing `tagSchema`, and at least one field required (zod refine).
- `updatePage` service: build the update from the provided fields only, map the unique violation (Postgres code 23505) to `HttpError(409, "Tag is already taken")` the same way `createPage` does, and return the page.
- Web: update `useUpdatePage` so its `onSuccess` sets the new page in the cache for the new tag key and invalidates `pagesQueryKey`. The old tag cache entry should be removed.

## Verification checklist

1. `pnpm db:reset` then `pnpm db:migrate` twice: second run is a no-op. Add a throwaway migration (for example a comment on a table) and confirm `pnpm db:migrate` applies it while rows created before it survive. Revert the throwaway.
2. `pnpm data:migrate --list` shows nothing pending. Add a temporary migration that inserts a marker, run it, run again (no second execution), and `--dry-run` leaves no trace. Remove the temporary migration.
3. Sign up with a first name: a `profiles` row exists with that name. Create a user in Studio without metadata: profile falls back to the email prefix.
4. Signing in from a protected URL returns you to that URL.
5. Settings dialog: rename works, tag change works and navigates, duplicate tag shows an error, reserved tags (`auth`, `create`, `api`, `join`) are rejected, the Share view transition is smooth in both directions including the height change.
6. `pnpm typecheck` passes.

## Definition of done

All checklist items pass, `AGENTS.md` contains the database changes section, and nothing in the app behaves differently for existing flows (create page, edit, publish).
