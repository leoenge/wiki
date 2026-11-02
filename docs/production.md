# Running in production

Everything runs on one machine. A Cloudflare Tunnel (shared with matchur) exposes three local servers:

| Public hostname | Local service | What it is |
| --- | --- | --- |
| `wiki.matchur.lol` | `127.0.0.1:4174` | Caddy serving the built web app (`apps/web/dist`) |
| `wikiapi.matchur.lol` | `127.0.0.1:8001` | Express API |
| `wikisupabase.matchur.lol` | `127.0.0.1:54331` | Local Supabase API gateway |

The web app is built with the URLs in `apps/web/.env.production`, so the browser
talks to Supabase and the API directly. The API allows CORS from the origins in
`CORS_ORIGINS` (default: `https://wiki.matchur.lol` and the local dev origins).

## One-time setup

1. Install Caddy and `cloudflared`. If Caddy came from apt, run `sudo systemctl disable --now caddy`.
2. Create `apps/api/.env.local` with `SUPABASE_URL=http://127.0.0.1:54331`,
   `SUPABASE_SECRET_KEY=<from pnpm supabase:status>` and `API_PORT=8001`.
3. In Cloudflare Zero Trust, Networks, Tunnels, open the existing tunnel and add
   public hostnames for the three rows above (type HTTP, URL `localhost:<port>`).
   `deploy/cloudflared.example.yml` is the equivalent for a local config file.

## Start

```sh
pnpm supabase:start
pnpm build
pnpm start                              # API
caddy run --config deploy/Caddyfile     # static web app
```

Rebuild with `pnpm build` after frontend changes. After changing `supabase/config.toml`,
run `pnpm supabase:stop && pnpm supabase:start`. To run the API as a service use
`deploy/wiki-api.example.service`.

## Security

Local Supabase uses the public demo JWT secret, so anyone who knows
`wikisupabase.matchur.lol` can forge a service role token. Fine for throwaway data only.
Never route Studio (54333) through the tunnel.
