# Step 3: Lists, reviews and comments

Read `README.md` in this folder first (product context, repo layout, style rules, final decisions). Steps 1 and 2 must be merged first. This step relies on: `profiles` and `useProfiles` (step 1), page membership with `is_page_member`, the `page_element_items` table with its `(id, page_id)` unique key, items inside draft content, the atomic publish function and the relative time helper (step 2).

Suggested order, each its own PR: A (lists and the generic item editor), B (reviews), C (comments).

## Goal

1. A new element type, List: a bullet or numbered list of text items.
2. Reviews: a 0 to 5 star rating in half steps with an optional comment, on every item in a map element and on every item in a new Review element.
3. Comments on every top level element except sections, on their own route, updating in realtime.

## Out of scope

Reviewing or commenting on elements that only exist in a draft (both only work on published content). Editing or deleting comments. Deleting reviews (they can only be edited). Notifications. Reviews on list items.

## Shared concepts

- Elements that carry items: `map` (items are places), `list` (items are text lines), `review` (items are named things to review). All use `page_element_items` with `label` plus type specific `data`. Maps keep `data` with `google_place_id`, `address`, `lat`, `lng`. List and review items use an empty `data`.
- Reviews and comments are live data. They are written straight to the API when the user acts, never through drafts, and they are not part of the publish function. They reference published rows with foreign keys, so deleting an element or item in a published draft deletes their reviews and comments through cascades. Make this visible in the editor (see "Edit mode touches" below).
- Names always come from `useProfiles`.

## Part A: Lists and the generic item editor

### Schema (new migration)

- `alter type public.page_element_type add value 'list'` and `'review'` (add both now). Note that new enum values cannot be used in the same transaction that adds them, so keep the enum additions in their own migration file separate from the constraints below.
- `page_elements.list_style text null` with a check that it is `'bullet'` or `'numbered'`, and a constraint that it is not null exactly when `type = 'list'`.
- Update the text constraint if needed so list and review elements need no `text`.
- Regenerate types.

### Types

- `packages/types`: extend the draft element type enum with `list` and `review`, add `list_style` to draft elements, and per type item validation: list items have `label` 1 to 2000 characters and empty data, maximum 200 items. Review items have `label` 1 to 200 characters and empty data, maximum 100 items. Update `flattenPageElements` and friends only if they depend on the type enum (check `pageElementOrder.ts`). Neither list nor review elements are containers.
- Update the SQL publish function (step 2) to write `list_style` and to accept the new types. Remember to update `publish_page_draft` through a new migration (create or replace), do not edit the old one.

### Web

- A generic `ItemListEditor` component for adding items one at a time (a text input with Enter or an add button, in the same visual style as the add-place flow for maps), showing existing items with a remove control (Phosphor `XIcon` or the swipe to delete used elsewhere), and optional reordering with `@dnd-kit` as already used in `PageElementsList.tsx`. Maps keep their special `PlacePicker` but share the row component where reasonable.
- `useDraftEditor.ts`: add `addListElementAt` and `addReviewElementAt`, a `setListStyle(elementId, style)` function, and use the generic `updateElementItems` introduced in step 2.
- `AddElementDialog.tsx`: add "List" and "Review" options with Phosphor icons.
- List element editor: a segmented control "Bullet" and "Numbered" at the top plus the item editor. List element view: an `ul` or `ol` according to `list_style`, styled with the sans font and consistent spacing. Empty lists render nothing in view mode.
- Review element editor and view are built in part B, but add the element type and a plain item editor here so the type is complete.

### Verify part A

Create bullet and numbered lists, switch style, add, remove and reorder items, publish, reload, check the view. Discard and re-enter edit keeps working. Item ids stay the same across edits and publishes (inspect rows).

## Part B: Reviews

### Schema (new migration)

`reviews`:
- `id uuid primary key default gen_random_uuid()`
- `item_id uuid not null`, `page_id uuid not null`, with `foreign key (item_id, page_id) references public.page_element_items (id, page_id) on delete cascade` (guarantees the page id is consistent with the item)
- `user_id uuid not null references public.profiles (id) on delete cascade`
- `rating smallint null` with check `rating between 0 and 10` (half stars: 0 means zero stars, 10 means five stars, null means not rated)
- `comment text null` with a check that if present, its trimmed length is greater than zero
- check that at least one of `rating` and `comment` is not null
- `created_at`, `updated_at` with the `set_updated_at` trigger
- `unique (item_id, user_id)`
- index on `(page_id)` and `(item_id)`
- RLS: select where `is_page_member(page_id)`. No client write grants.

The element that an item belongs to must be a map or a review element (not a list). Enforce this in the API, and additionally in a small `before insert` trigger on `reviews` so the database never holds a review on a list item.

Regenerate types and add `Review` to `packages/types`.

### API

`PUT /api/pages/:pageId/items/:itemId/review` (member only), body `{ rating: integer 0..10 or null, comment: string or null }` validated with zod (no maximum length for the comment, but note that Express' JSON body limit still applies, keep the default). Rules, all in the service:
- The item must belong to the page and to a map or review element, otherwise 404 or 400.
- If a review row exists and its stored rating is not null, a request with `rating: null` is rejected with 400 "A rating cannot be removed". The comment may be changed or cleared as long as the rating stays.
- At least one of rating and comment must be set.
- Upsert on `(item_id, user_id)`. Return the review.
There is deliberately no delete endpoint.

### Web reading

New module `apps/web/src/api/reviews.ts`:
- `usePageReviews(pageId)`: one query `supabase.from("reviews").select("*").eq("page_id", pageId)`, keyed by page, giving all reviews for the page. Group by `item_id` client side and compute per item: number of ratings, average over non null ratings (divide the integer average by 2 to get stars, display one decimal, for example "4.5"), and the list of reviewers with rating and comment. Names via `useProfiles`.
- `useSaveReview(accessToken)` mutation that updates the cache on success.
- Consider adding the reviews table to the Realtime publication later. It is not required in this step.

### Web UI

- A `StarRating` component. Five Phosphor stars (`StarIcon` filled or not, `StarHalfIcon` for halves, check the icon names in the installed `@phosphor-icons/react` version). Interactive mode: the left half of a star sets x.5, the right half sets x.0, with a hover preview. Provide an explicit way to choose zero stars (a small "0" text button before the stars). Read only mode for displaying other people's ratings.
- `ItemReviews` component used under each reviewable item: a compact row showing the average with its star display and count (or a quiet "No reviews yet"), and a tappable star row for the current user's own rating. Tapping opens a small inline form: stars, a short comment input and Save. Reviewing again edits the existing review, prefilled. The form cannot clear an existing rating. Below the row list every reviewer: first name, their stars and comment, the current user's own first.
- Maps: in `MapElementView` show `ItemReviews` in or below each `MapPlaceCard` (view mode only).
- Review element: `ReviewElementEditor` uses the item editor from part A (type an item name and add). `ReviewElementView` renders each item as a row with its name and `ItemReviews`, like map items.
- Only items that exist in the database can be reviewed. In edit mode do not show the review UI, because items added in a draft are not published yet.

### Edit mode touches

When a user removes an item in the editor that has reviews in the database, show a quiet note on the removal control ("This item has N reviews that will be deleted when you publish"). Same for deleting a whole map or review element that contains reviewed items. Data comes from `usePageReviews`.

### Verify part B

Two accounts rate the same map place and review item. Averages and the reviewer list are correct for both, half stars work, 0 stars is stored as 0 and displayed as zero stars and counted in the average, a comment only review has no stars and does not affect the average, you can edit your review but never clear the rating, a list item cannot be reviewed (API returns an error), removing a place and publishing deletes its reviews, a non member cannot read reviews (RLS).

## Part C: Comments

### Schema (new migration)

`element_comments`:
- `id uuid primary key default gen_random_uuid()`
- `element_id uuid not null`, `page_id uuid not null`, with `foreign key (element_id, page_id) references public.page_elements (id, page_id) on delete cascade`
- `user_id uuid not null references public.profiles (id) on delete cascade`
- `body text not null` with a check that the trimmed length is greater than zero
- `created_at timestamptz not null default now()`
- index on `(element_id, created_at)` and `(page_id)`
- A `before insert` trigger that raises when the element type is `section`.
- RLS: select where `is_page_member(page_id)`. No update or delete policies or grants at all, comments are immutable.
- `alter publication supabase_realtime add table public.element_comments;` so that Realtime streams inserts. Realtime respects the select policy, so only members receive events.
- A view `element_comment_counts` (`page_id`, `element_id`, `count`) created `with (security_invoker = true)` for counts on the page view.

### API

`POST /api/pages/:pageId/elements/:elementId/comments` (member only), body `{ body: string }` (trimmed, at least one character, no maximum). Verifies the element belongs to the page and is not a section (400 "Sections cannot be commented on"). Returns the created comment. No other write routes.

### Route and views

- New route `/:tag/e/:elementId` in `App.tsx` wrapped in `RequireAuth`, rendering `views/CommentsView.tsx`. Because the page route is `/:tag`, keep both defined so React Router matches the longer path (check that `join`, `create`, `auth` and `api` stay reserved tags).
- `CommentsView` layout: a `BackLink` to `/${tag}`. Then the selected element on its own at the top, rendered read only with the same components as the page view (extract the row content from `PageElementsList.tsx` into an exported `ElementContent` component if needed rather than duplicating), then the comment list oldest first, each with the author's first name, a relative time and the text, and an input at the bottom (a textarea that grows, a send button with a Phosphor `PaperPlaneRightIcon`; Enter sends, Shift plus Enter inserts a newline). Scroll to the newest comment on load and when a new one arrives (if the user is already near the bottom). Show a not found state for an unknown element or a section.
- Comment entry point on the page view (view mode only, not for sections): a Phosphor `ChatCircleIcon` next to each element, with the count when greater than zero, linking to `/${tag}/e/${element.id}`. Position it so it does not disturb the layouts of images, maps and text, using spacing and not borders. Counts come from `element_comment_counts` for the page (one query), kept fresh by a page level realtime subscription described below.

### Realtime hook

New module `apps/web/src/api/comments.ts`:
- `useElementComments(pageId, elementId)`: initial fetch with `supabase.from("element_comments").select("*").eq("element_id", elementId).order("created_at")`, stored in the TanStack Query cache. In an effect, subscribe with `supabase.channel(...).on("postgres_changes", { event: "INSERT", schema: "public", table: "element_comments", filter: "element_id=eq.<id>" }, handler).subscribe(statusCallback)`. The handler appends the new row to the cache, deduplicating by id (your own comment arrives both from the mutation response and from the stream). When the channel status becomes `SUBSCRIBED` (including after a reconnect), refetch once so nothing posted during a gap is missed. Remove the channel in the effect cleanup. Authors come from `useProfiles`, which fetches unknown ids lazily, so the row may render for a moment without a name: render it with a placeholder width instead of "Unknown".
- `usePostComment(accessToken)` mutation.
- `usePageCommentCounts(pageId)`: fetch the counts view and subscribe to inserts filtered by `page_id` to bump the counts in the cache.
- Make sure the Supabase client has the user's access token for Realtime (supabase-js does this when the session is set through the normal auth flow, verify after sign in and token refresh).

### Verify part C

Two browsers on the same page and same element: a comment from one appears in the other without refresh, in order, no duplicates. Counts on the page view update live. Comment icons exist on text, images, maps, lists and reviews but not on sections. Sections reject comments at the API. Comments cannot be edited or deleted (no UI, and direct client writes are rejected by RLS). Deleting the element in a published draft removes its comments, and the route for it shows not found. Removed members cannot read comments. Reconnect test: take the network offline, post a comment elsewhere, bring it back online, the missed comment appears.

## Definition of done for the whole feature set

All three parts verified, `pnpm typecheck` passes, `AGENTS.md` mentions the database change workflow from step 1, no data migration is pending in `tools/data-migrations` unless a model change required one, and `new_features.md` is fully covered: first names, multi-user pages with link and email invites, per user drafts with a publish warning, the settings dialog with name, tag and share, migrations without reset, reviews on map items and review elements, comments on every element but sections, and lists.
