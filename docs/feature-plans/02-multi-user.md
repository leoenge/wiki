# Step 2: Multi-user pages, safe publishing, and the items data model

Read `README.md` in this folder first (product context, repo layout, style rules, final decisions). Step 1 (`01-foundations.md`) must be merged first: this step relies on the `profiles` table, the settings dialog with its `ViewSwitcher`, the `join` reserved tag, the auth redirect fix, and the migration tooling.

This is the largest and riskiest step because it replaces single owner permissions across the whole stack. It is split in three parts that can be built and verified in order: A (membership and permissions), B (items table and the new publish function with conflict detection), C (sharing features and UI). Each part can be its own PR.

## Goal

1. Several users can belong to one page. Everyone is equal.
2. People join through the page's single invite link, or are added by searching their email address.
3. Each member has their own draft. Publishing warns if somebody else published since the draft was started, naming who and when, and lets the user replace the page with their full draft or keep editing. No merging.
4. Map places move from a JSON column into a real table of items, so that step 3 can attach reviews to items with foreign keys. This also makes the rewritten publish simpler.

## Out of scope

Reviews, comments, lists (step 3). Roles. Deleting pages. Revoking or regenerating the invite link. Realtime presence or live collaborative editing.

## Part A: Membership and permissions

### Schema (new migration)

Reminder: the database will be reset, so no data conversion is required.

`pages`:
- Drop `owner_id` (and its index and the `pages_select_own` policy). Add `created_by uuid null references auth.users (id) on delete set null` (informational only, no special rights).
- Add `invite_token text not null unique default encode(extensions.gen_random_bytes(24), 'hex')`. This is the one permanent invite link token (48 hex characters). If `gen_random_bytes` is not found on the local setup, enable `pgcrypto` in the `extensions` schema.
- Add `version bigint not null default 1`, `last_published_by uuid null references public.profiles (id) on delete set null`, `last_published_at timestamptz null`. Used by part B.

`page_members`:
- `page_id uuid not null references public.pages (id) on delete cascade`
- `user_id uuid not null references public.profiles (id) on delete cascade` (referencing profiles, not auth.users, so PostgREST can embed the profile in member queries)
- `added_by uuid null references public.profiles (id) on delete set null`
- `created_at timestamptz not null default now()`
- primary key `(page_id, user_id)`, index on `(user_id)`

Trigger: after insert on `pages`, a `security definer` function (empty `search_path`) inserts `(new.id, new.created_by)` into `page_members` when `created_by` is not null. The API `createPage` sets `created_by` from the verified uid.

Helper functions (`language sql`, `stable`, `security definer`, `set search_path = ''`, and always wrap `auth.uid()` as `(select auth.uid())`):
- `public.is_page_member(p_page_id uuid) returns boolean`: exists in `page_members` for the current user.
- `public.shares_page_with(p_user_id uuid) returns boolean`: the current user and `p_user_id` are members of a common page (or are the same user).
- `public.can_read_image_path(p_path text) returns boolean`: true when the first folder of the path equals the current user id, or when the path is used by a `page_elements.image_path` or `pages.main_image_path` of a page the current user is a member of.
- `public.find_user_id_by_email(p_email text) returns uuid`: looks up `auth.users` by `lower(email)` (trimmed input). Revoke execute from `public`, `anon` and `authenticated`, grant only to `service_role`. This is how emails stay private: the API calls it, clients cannot.
- `public.remove_page_member(p_page_id uuid, p_user_id uuid) returns void`: service role only. Locks the page row (`for update`), raises an exception with a recognizable message if the user is the last member, otherwise deletes the membership and that user's `page_drafts` row for the page, atomically.

Add indexes on `page_elements (image_path)` and `pages (main_image_path)` for `can_read_image_path`.

### RLS (same migration)

Replace owner based policies with membership based ones. All reads are for role `authenticated`; all writes still go through the API with the service role, so no insert, update or delete grants for clients.

- `pages`: select where `is_page_member(id)`.
- `page_members`: select where `is_page_member(page_id)`.
- `page_elements`: select where `is_page_member(page_id)`.
- `page_drafts`: select where `user_id = (select auth.uid())` and `is_page_member(page_id)`.
- `profiles`: replace the own-row policy with select where `shares_page_with(id)`.
- `images`: select where `can_read_image_path(path)`.
- `storage.objects` (bucket `images`): keep the insert policy that restricts uploads to your own folder. Replace the select policy with `bucket_id = 'images' and public.can_read_image_path(name)`. This is the fix that lets members see images uploaded by others. Signed URLs created in the browser with the user's session then work for any member.

Regenerate types with `pnpm db:types`.

### API changes

- `apps/api/src/services/pages.ts`: replace `getOwnedPage(uid, pageId)` with `getMemberPage(uid, pageId)` (looks the membership up and returns the page, 404 if not a member, so page existence is not leaked). Update every caller in `services/pages.ts`, `services/drafts.ts` and `services/elements.ts`. `createPage` sets `created_by: uid` instead of `owner_id`.
- Remove `.eq("owner_id", uid)` from the publish update in `drafts.ts`.
- `apps/api/src/services/storage.ts` and draft validation currently require every image path to start with the acting user's id (`assertImagePathPrefix`). With several members that breaks publishing a draft containing someone else's image. New rule, implemented in one helper `assertImageUsableOnPage(uid, pageId, path)`: either the path starts with `uid/` (a new upload by the acting user, verified to exist in storage and registered in `images`), or the path is already used on this page by an existing element or the main image (looked up in `images` for its id). Anything else is a 400.
- The direct element endpoints (`POST /pages/:pageId/elements`, `POST .../elements/images`, `PUT .../elements/reorder`, `PATCH` and `DELETE .../elements/:elementId` in `routes/pages.ts` and `services/elements.ts`) are not used by the web app, which edits only through drafts. Confirm with a repo wide search (also check `apps/web/src/api/elements.ts`). If unused, delete them and the web file. They bypass versioning and conflict detection added in part B and would have to be maintained for nothing.

### Web changes

- No UI change besides things that now just work through RLS: the pages list on `PagesView` shows every page you are a member of, and the page view works for any member.
- `ExpandedImageViewer` contributor name: look up the `images` row by `path` to get `owner_id`, then the name via `useProfiles` (replace `contributorNameForImagePath`).

### Verify part A before moving on

With two accounts and a manual `insert into page_members` for the second: both see the page, only members do, the second user sees the first user's images, and a non member gets 404 on every API route for that page and no rows from Supabase.

## Part B: Items table and the new publish with conflict detection

### Items table (new migration)

Today a map element stores places as JSON in `page_elements.places`. Step 3 needs map places, list entries and review entries to be addressable rows that reviews can point to. Normalize now.

`page_element_items`:
- `id uuid primary key default gen_random_uuid()`
- `element_id uuid not null`, `page_id uuid not null`, with `foreign key (element_id, page_id) references public.page_elements (id, page_id) on delete cascade` (the unique constraint on `(id, page_id)` already exists)
- `position int not null`
- `label text not null` with a check that the trimmed value is not empty. For a map place this is the place name, in step 3 it is the list text or review item name.
- `data jsonb not null default '{}'` with a check that it is a JSON object. Type specific extras. For map places: `google_place_id`, `address`, `lat`, `lng`.
- `created_at`, `updated_at` with the existing `set_updated_at` trigger
- `unique (id, page_id)` (so that step 3 can reference items with a composite foreign key that guarantees consistency)
- indexes on `(element_id, position)` and `(page_id)`
- RLS select where `is_page_member(page_id)`, grant select to authenticated.

On `page_elements`: drop the `places` column and the `page_elements_map_has_places` constraint.

Shared types in `packages/types`:
- `PageElementItem = Tables<"page_element_items">` and `PageElementWithItems = PageElement & { items: PageElementItem[] }`.
- Item payload schemas per element type with zod. For maps, keep the existing `MapPlace` type and put `mapPlaceFromItem(item)` and `itemFromMapPlace(place)` converters next to it, so `PageMapCanvas`, `MapPlaceCard` and `PlacePicker` keep working with `MapPlace`. Keep the limit of 100 places per map.
- Draft content (`packages/types/src/api/drafts.ts`): each draft element gets `items: { id, label, data }[]` (order in the array is the position) instead of `places`. Validate: only element types that carry items may have them (maps now; lists and reviews in step 3), item ids unique across the whole draft, per type payload validation. Keep `pageElementToDraftElement`, `buildPageDraftContent`, `draftContentToPageElements` and `liveSnapshotToDraftContent` in sync.
- `PageDraftContent` also gets nothing about versions: versions live on the draft row, not inside the content.

Web reads elements with an embedded select: `supabase.from("page_elements").select("*, items:page_element_items(*)").eq("page_id", pageId).order("position", { ascending: true }).order("position", { referencedTable: "page_element_items" })`. Update `fetchPageElements` in `PageView.tsx`.

`useDraftEditor.ts`: replace `updateMapPlaces` with a generic `updateElementItems(elementId, items)`, adapt `newElement` and the add map function, and have `MapElementEditor` and `MapElementView` convert between items and `MapPlace` using the converters. Item ids must be generated client side with `crypto.randomUUID()` (as places do today) and stay stable across edits: stable ids are what keeps reviews attached in step 3.

### Draft versioning (same migration)

- `page_drafts.base_version bigint not null`: the page version this draft was started from.
- `PUT /api/pages/:pageId/draft` body gains `base_version` (the `version` of the page the client loaded). On insert the server stores it (rejecting values greater than the page's current version). On update the server keeps the stored value. It must never move forward by autosave, otherwise the conflict is hidden.
- The web sends `page.version` from the page it read. Make sure the page query refetches (react-query default refetch on window focus is enough) so `page.version` is reasonably fresh when the user presses Edit.

### Publish as one database function

The current `publishPageDraft` in `apps/api/src/services/drafts.ts` issues dozens of sequential queries without a transaction, deletes elements before updating the others (a deleted section cascades to its children through the `parent_id` foreign key before they are re-parented), and cannot be made safe against two members publishing at once. Replace it with a Postgres function.

`public.publish_page_draft(p_page_id uuid, p_user_id uuid, p_content jsonb, p_force boolean) returns jsonb`, `security definer`, empty `search_path`, executable only by `service_role`:

1. Lock the page row `for update`. Raise if `p_user_id` is not a member.
2. Load the caller's draft row (raise if missing).
3. If `draft.base_version <> page.version` and not `p_force`: return `{"conflict": true, "version": ..., "last_published_by": ..., "last_published_at": ...}` and change nothing.
4. Apply the content in this order: (a) upsert all elements from the draft with `parent_id` null, (b) set the real `parent_id` and `position` of each element, (c) upsert items by id and delete items of kept elements that are not in the draft anymore, (d) delete elements that are not in the draft anymore (cascades to their items and, from step 3, comments), so nothing that is still wanted is cascade deleted.
5. Update the page: main image path and id, `version = version + 1`, `last_published_by = p_user_id`, `last_published_at = now()`. Delete the caller's draft. Other members' drafts are left alone and will report a conflict when they publish.
6. Return `{"conflict": false, "version": ...}`.

The API prepares everything that needs storage or other services before calling the function: validate the draft with the zod schema, verify image paths with `assertImageUsableOnPage`, register new images (`registerImage`) and put the resulting `image_id` into the content passed to the function (`image_id` per image element and `main_image_id` at top level). After a non conflicting result, load the page, elements and items and return them as `PageWithElements` (extend the type to carry items).

Route: `POST /api/pages/:pageId/draft/publish` accepts `{ force?: boolean }`. On conflict respond 409 with JSON `{ error: "Page changed", code: "PAGE_CHANGED", last_published_by: { id, first_name }, last_published_at }` (look up the name in `profiles`). This needs `HttpError` (`apps/api/src/http.ts`) and the error handler (`middleware/errorHandler.ts`) to support an optional extra JSON body.

### Web: conflict handling

- `apps/web/src/api/client.ts`: make failures throw an `ApiError` that carries `status` and the parsed JSON body (check what `apiFetch` does today and keep existing messages working).
- `usePublishPageDraft` takes `{ pageId, force }`.
- In `PageView.tsx` `onPublish`: on `PAGE_CHANGED`, open a small dialog (reuse `Dialog`): title "Page changed", text "{first name} published changes {relative time}. If you continue, their version is replaced by yours. Changes are not merged." Buttons: "Replace with my version" (primary, retries with `force: true`) and "Keep editing" (closes, draft remains). Add a small helper for relative time formatting using `Intl.RelativeTimeFormat` (also used in step 3).
- Optional but cheap: when entering edit mode with an existing draft whose `base_version` is lower than `page.version`, show a quiet inline notice at the top that the page was published by {name} since this draft started.

### Verify part B

Single user regression: add, edit, reorder, delete elements (including a section with children that is deleted while keeping its children), main image, publish, discard. Two users: both start editing the same page, A publishes, B publishes and gets the warning with A's first name and a sensible time, "Keep editing" keeps B's draft intact, "Replace" publishes B's version in full and bumps the version. Publishing twice concurrently (two browser tabs, click at the same time) never leaves a half applied page.

## Part C: Sharing features

### API

All routes require auth except the invite preview. Add `routes/members.ts` and `routes/invites.ts` (or put in `routes/pages.ts`) and the matching services.

- `GET /api/invites/:token` (no auth): returns `{ page_name }` for a valid token, 404 otherwise. Used to show "Join {page name}" to someone who is not signed in yet.
- `POST /api/invites/:token/join` (auth): finds the page by `invite_token` with the service role, inserts `(page_id, uid, added_by: null)` into `page_members` with `on conflict do nothing`, returns the `Page`. Idempotent.
- `POST /api/pages/:pageId/members` body `{ email }` (member only): trims and lowercases, resolves the user with `find_user_id_by_email`. 404 "No account with that email" when not found, 409 "Already a member" when already a member, otherwise insert with `added_by: uid` and return `{ user_id, first_name, created_at }`. (This reveals whether an email has an account to any signed in user. Accepted for now. A rate limit on this route is a good follow up.)
- `DELETE /api/pages/:pageId/members/:userId` (member only): calls `remove_page_member`. Any member can remove any member including themselves. Map the "last member" exception to 409 "A page needs at least one member".
- Zod schemas for the bodies live in `packages/types/src/api`.

### Web: join flow

- Route `/join/:token`, not wrapped in `RequireAuth`. Add it in `App.tsx`. New `views/JoinView.tsx`:
  - On mount, store the token in `localStorage` (key for example `ww.pendingInvite`) so it survives a page reload or an email confirmation redirect.
  - While auth is loading show a quiet loading state.
  - Signed in: call the join endpoint, clear the stored token, invalidate the pages list, navigate to `/${page.tag}` with `replace`. Show a friendly error for an unknown token.
  - Not signed in: fetch the preview and show "You were invited to {page name}" with two buttons, "Sign in" and "Create account", both going to `/auth` with `state.from = /join/:token` (the auth redirect fix from step 1 returns the user here, and the signed in branch finishes the join). `AuthView` also needs a way to open in sign up mode directly (for example a `?mode=sign-up` search param).
- Confirm `supabase/config.toml` still has `enable_confirmations = false` for email locally. If it is turned on later, the stored token in localStorage is what keeps the flow working.

### Web: Share view in the settings dialog

Replace the placeholder from step 1. Same dialog, same `ViewSwitcher` transition, title "Share" with a back control.

- Invite link: read only field showing `${window.location.origin}/join/${page.invite_token}` and a "Copy link" button using `navigator.clipboard.writeText` with brief feedback (swap the Phosphor `CopyIcon` for `CheckIcon` for two seconds).
- Add by email: a `TextField` with an Add button. Show the API error messages inline. On success clear the field and refresh the member list.
- Members: list from `supabase.from("page_members").select("user_id, created_at, profiles(first_name)").eq("page_id", page.id).order("created_at")`. Each row shows the first name (with a muted "You" for the current user) and, for other members, a remove button with a Phosphor `UserMinusIcon` and a confirmation. No borders, use spacing.
- Leave page: a text button at the bottom, with confirmation. On success invalidate the pages list and navigate to `/`. If the API says you are the last member, show that message instead.
- When a member is removed their draft is deleted too. If they are mid edit, their next autosave fails; handle a 404 from the draft route by showing a clear message and leaving edit mode instead of looping on errors.

### Verify part C

1. Link flow signed in: opens link, lands on the page, page appears in their list.
2. Link flow signed out: sees the invite screen, signs up with a first name (or signs in), is returned and joined, page shows in their list.
3. Link used by a second and third person (multi use). A used link keeps working.
4. Add by email: unknown email error, existing member error, success shows the person's first name in members.
5. Removing another member, leaving the page, last member cannot leave.
6. Removed user can no longer open the page and cannot see its images (check the storage signed URL fails).
7. `pnpm typecheck` passes and all checklists from parts A and B still pass.

## Definition of done

Two real accounts can collaborate on the same page end to end, publishing is atomic and warns on conflicts, the elements and items model is in place, and no code path still checks `owner_id`.
