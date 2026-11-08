This is a social website where you create your own wikipedia like pages and Wikipedia like pages for your friendships with your best friends. 

General priciple is that we write to the backend api, and read directly from supabase. This doesn't have to be followed when it doesn't suit, but we should aim for that setup.

I hate the dot dot character "•" and the bar character "|". Never use them. Use other ways to create clear stucture and separtions.

## Styling
- Use minimal design. 
- Avoid borders, escpecially these ugly top, bottom and side bordes to delimit secions.
- Focus on nailing spacing, sizing and font weights to structure clear.
- Never use ASCII symbols for icon-like stuff, like arrows and chevrons. Instead use phosphor icons (https://phosphoricons.com).
- Use the serif font for headings and sans for almost everything else.

## Database changes
- Schema changes go in a new migration (`pnpm db:migration:new name`), never edit an applied migration. Apply with `pnpm db:migrate`, regenerate types with `pnpm db:types`.
- If a data model change requires existing data to be converted into the new shape, add a numbered Python migration in `tools/data-migrations/migrations/` and keep it idempotent. Run with `pnpm data:migrate` (uv project in `tools/data-migrations`; run `uv sync` there once if dependencies are missing). Trivial changes (a new nullable column, a default) do not need one.
- Whenever you change the data model, ask yourself if a data migration is needed, and say so in the PR description either way.