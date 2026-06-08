---
name: Docker / VPS deployment
description: How this monorepo is packaged for self-hosted Docker Compose VPS deploy, and gotchas.
---

# Docker / VPS deployment

The repo ships a self-host path (separate from Replit workflows): `docker-compose.yml`
(base/local) + `docker-compose.prod.yml` (Traefik + Let's Encrypt overlay), images in
`docker/api` and `docker/web`, VPS scripts in `deploy/`, and a full Polish `README.md`.

## Architecture
- 3 app containers: `db` (postgres:16-alpine + named volume `db_data`), `api` (Node/Express, port 8080), `web` (Nginx serving the Vite SPA AND proxying `/api/` → `api:8080`). Prod adds `traefik`.
- **Same-origin by design**: front and API served under one origin via Nginx `/api/` proxy, so browser cookies/JWT work with no CORS config. The frontend calls `/api` with relative URLs (web never sets a base URL; `setBaseUrl` is Expo-only).
- Nginx `location /api/ { proxy_pass http://api:8080; }` (no URI on proxy_pass) **preserves** the `/api` prefix — the Express app mounts its router at `/api`, so the prefix must NOT be stripped.

## Migrations
- Drizzle migrations live in `lib/db/drizzle/` (generated via `pnpm --filter @workspace/db run generate`). `out` is set in `lib/db/drizzle.config.ts`.
- API container entrypoint runs `drizzle-kit migrate` before starting the server. **Why migrate not push:** versioned SQL is safe for prod; `push` is dev-only.
- The api image copies the WHOLE built monorepo (incl. node_modules) so native `bcrypt` and `drizzle-kit` exist at runtime.

## Gotchas
- **Fresh `pnpm install` inside Docker is very slow (10–20+ min)** because `minimumReleaseAge: 1440` in `pnpm-workspace.yaml` makes pnpm query the registry for publish timestamps across the whole (large, radix/excalidraw-heavy) dep tree. This is expected, not a hang. Do NOT disable the setting to speed it up.
- Vite build REQUIRES `PORT` and `BASE_PATH` env at build time (vite.config throws otherwise); the web Dockerfile sets `BASE_PATH=/`.
- bcrypt is native + esbuild-externalized → the api runtime needs it installed/compiled (build-essential + python3 in the builder stage).
- `.env`/`.env.*` are git- and docker-ignored; only `.env.example` is tracked. DATABASE_URL is composed in compose from `POSTGRES_*`.
- Seeder is `scripts/src/seed.ts` (`pnpm --filter @workspace/scripts run seed`); it imports schema by relative path and needs bcrypt/pg/drizzle-orm declared in `scripts/package.json`.
