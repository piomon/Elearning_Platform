---
name: Docker / VPS self-host deploy
description: How the project self-hosts on a VPS via Docker Compose, and the seeding/lockfile gotchas around it.
---

# Docker / VPS self-host deploy

Self-hosting is fully separate from Replit deploy. Base `docker-compose.yml` (db/api/web) + prod overlay `docker-compose.prod.yml` (Traefik v3.1 + Let's Encrypt TLS-ALPN-01). One-command prod: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`. Docs in `README.md`, env template `.env.example` (maps to `api-server/src/config/env.ts`).

## Rules / non-obvious constraints
- **Migrations auto-run on container start** (`docker/api/entrypoint.sh` runs `drizzle-kit migrate`, then boots the server). **Seeding does NOT auto-run in the container** — but `deploy/update.sh` runs it after `up -d --wait`, so a normal deploy always ensures course content (fixes the "migrated but never seeded → empty course" bug).
  - `scripts/src/seed.ts` is now **idempotent and non-destructive** (upsert-by-slug, fill-gaps-only). Safe to run on every deploy. See `seed-idempotency.md` for the full rules and the demo-account gating (`SEED_DEMO_ACCOUNTS`). Dev-only hard reset via `SEED_RESET=1` (aborts if any payment/paid grant exists).
- **Adding any workspace dependency requires regenerating `pnpm-lock.yaml`** (run `pnpm install`) and committing it — both Dockerfiles install with `pnpm install --frozen-lockfile`, which fails if the lockfile is stale.
- The api image bundles full `node_modules` (not just dist) because the runtime needs `drizzle-kit` to run migrations on container start.
