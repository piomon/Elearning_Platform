---
name: Docker / VPS self-host deploy
description: How the project self-hosts on a VPS via Docker Compose, and the seeding/lockfile gotchas around it.
---

# Docker / VPS self-host deploy

Self-hosting is fully separate from Replit deploy. Base `docker-compose.yml` (db/api/web) + prod overlay `docker-compose.prod.yml` (Traefik v3.1 + Let's Encrypt TLS-ALPN-01). One-command prod: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`. Docs in `README.md`, env template `.env.example` (maps to `api-server/src/config/env.ts`).

## Rules / non-obvious constraints
- **Migrations auto-run, seeding does NOT.** `docker/api/entrypoint.sh` runs `drizzle-kit migrate` on every container start, then boots the server. Seeding is a deliberate one-time manual step (`docker compose exec api pnpm --filter @workspace/scripts run seed`).
  - **Why:** `scripts/src/seed.ts` is destructive — it `db.delete(...)` all course/section/topic/video/quiz/task/progress rows before reinserting (users/landing/seo/pricing use `onConflictDoNothing`). Auto-running it on every restart would wipe learner progress.
- **Adding any workspace dependency requires regenerating `pnpm-lock.yaml`** (run `pnpm install`) and committing it — both Dockerfiles install with `pnpm install --frozen-lockfile`, which fails if the lockfile is stale.
- The api image bundles full `node_modules` (not just dist) because the runtime needs `drizzle-kit` to run migrations on container start.
