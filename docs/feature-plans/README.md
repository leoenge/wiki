# Feature plans: multi-user pages, reviews, comments, lists

This folder contains three implementation plans. They are written so that someone who has not seen the conversation that produced them can pick one up and build it. They must be built in order, and each one should be finished, verified and merged before the next one starts.

1. `01-foundations.md`: migration tooling, user first names, page settings dialog (rename and change tag).
2. `02-multi-user.md`: pages shared between users (members, invite link, add by email), draft conflict warning on publish, and the data model refactor that makes step 3 simple.
3. `03-lists-reviews-comments.md`: the list element, the review element and reviews on map items, and comments on elements.

The original feature wishlist is in `new_features.md` at the repo root.

## Product in one paragraph

A social website where people create Wikipedia-like pages about themselves and about their friendships. A page has a name, a unique tag (the URL, `/:tag`), an optional main image and an ordered tree of elements: sections (collapsible headings, which contain the elements after them), text, images and maps. Editing happens through a per-user draft that is published as a whole.

## Repo and stack

- pnpm monorepo. `apps/web` (Vite, React, React Router, TanStack Query, Tailwind, supabase-js), `apps/api` (Express, zod, supabase-js with the service role key in `apps/api/src/db.ts`), `packages/types` (shared zod schemas, helper types and the generated `database.gen.ts`), `supabase/migrations` (SQL migrations).
- Principle from `AGENTS.md`: writes go through the API, reads go directly from the web app to Supabase and are protected by RLS. The API always derives the acting user from the verified token (`req.uid`), never from the request body.
- Run the stack with `pnpm supabase:start`, `pnpm dev`. After changing the schema, regenerate types with `pnpm db:types`. Type check everything with `pnpm typecheck`. There is no automated test suite yet, so each plan ends with a manual verification checklist.
- Style rules (from `AGENTS.md`, follow them in all UI work): minimal design, no borders to separate sections, structure through spacing, size and weight, serif for headings and sans for everything else, Phosphor icons only (never ASCII arrows or chevrons), and never use the characters for a bullet dot or a vertical bar anywhere in UI copy or code comments.

## How the current code works (read before starting)

- `supabase/migrations/20251102100000_pages.sql` and later: tables `pages` (owner_id, name, tag, main_image_path, main_image_id), `page_elements` (page_id, type enum of image, text, section, map, parent_id, position, text, caption, image_path, image_id, places jsonb), `page_drafts` (one row per page and user, `content` jsonb), `images` (metadata for uploaded files). Storage bucket `images` is private, and objects live under `<uploader uid>/<uuid>.jpg`.
- Element order is a flat list. `packages/types/src/pageElementOrder.ts` converts between the flat order and `parent_id` plus `position` (sections own the elements after them).
- Editing flow: `apps/web/src/hooks/useDraftEditor.ts` keeps the edit state in React, autosaves the whole draft to `PUT /api/pages/:pageId/draft` (800 ms debounce), and `POST /api/pages/:pageId/draft/publish` (`apps/api/src/services/drafts.ts`) writes the draft to `page_elements` with many sequential queries. The web reads the page with `supabase.from("pages")` in `apps/web/src/views/PageView.tsx`.
- Every API service starts with `getOwnedPage(uid, pageId)` (`apps/api/src/services/pages.ts`), which is the single-owner check that step 2 replaces.
- Images are shown through signed URLs created client-side (`apps/web/src/lib/images.ts`, `useImageUrl.ts`). Storage read policies currently only allow reading your own folder.
- `apps/api/src/routes/pages.ts` still exposes direct element endpoints (create, update, reorder, delete element). The web app edits through drafts only, so these look unused.

## Decisions (final, do not re-litigate)

Database: nothing needs to be backward compatible. The database is reset when these changes land (`pnpm db:reset`). Still add new migration files rather than editing old ones, so the migration workflow from step 1 is exercised.

Pages and members:
- No roles. Every member is equal.
- Every member can change page settings (name and tag), add members, and remove any member including themselves.
- A member can leave a page from the settings dialog. Nobody can delete a page. Because of this, the last remaining member cannot leave.
- Old tags simply stop working when a tag changes. No redirects.
- Adding a member by email takes effect immediately (no accept step).
- There is exactly one invite link per page. It is multi-use, never expires, cannot be revoked or regenerated. Anyone who opens it while signed in is added to the page.

Drafts and publishing:
- Every member has their own draft per page (already true in the schema). Drafts are never merged.
- When publishing, if somebody else published since this draft was started, show a warning that names who edited and when. The user either replaces the page with their full draft or keeps editing. No merging.

Reviews:
- Rating scale is 0 to 5 stars in half steps, stored as an integer 0 to 10. A missing rating is null (no rating), an explicit zero stars is 0.
- A user has at most one review per item. They can edit it but never delete it, and a rating once set cannot be set back to null.
- A review can carry a comment with no length limit.
- The average on an item is the average over all members that have rated it (null ratings ignored).

Comments:
- Every element can be commented on except sections. You comment on the whole top level element, never on items inside it.
- Comments cannot be edited or deleted. No length limit.
- Comments live on their own route and update in realtime.

Data model: the best long term model was chosen over the cheapest one. Items inside elements (map places, list items, review items) become real rows in a table (`page_element_items`) instead of JSON, so that reviews can reference them with foreign keys. This is introduced in step 2.
