---
name: Docker / VPS self-host deploy
description: How the project self-hosts on a VPS via Docker Compose, and the seeding/lockfile gotchas around it.
---

# Docker / VPS self-host deploy

Self-hosting is fully separate from Replit deploy. Base `docker-compose.yml` (db/api/web) + prod overlay `docker-compose.prod.yml` (Traefik v3.1 + Let's Encrypt TLS-ALPN-01). One-command prod: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`. Docs in `README.md`, env template `.env.example` (maps to `api-server/src/config/env.ts`).

## Rules / non-obvious constraints
- **Full content lifecycle auto-runs on container start** (`docker/api/entrypoint.sh`), in order: (1) `drizzle-kit migrate` [FATAL on error] → (2) content import `merge` → (3) `content:migrate` → (4) `verify:content`. Each step is gated by a `RUN_*=1` env flag; steps 2–4 are non-fatal (log & continue) unless `VERIFY_CONTENT_STRICT=1` makes verify block start. This is what makes **lessons survive a fresh DB volume / redeploy** — content is re-imported every boot from the git-committed export.
  - Content export lives in `scripts/data/export/*.json` (committed to git). Export uses a hard **allowlist** (`EXPORT_TABLES`) so customer/PII tables (users, payments, grants, progress, attempts, …) are physically never exported. Import `merge` is select-then-insert/update in one transaction, **never deletes**, **NO ON CONFLICT** anywhere. `replace-demo-content` needs `--yes` and aborts if any real customer data exists. See `bunny-video-identity.md` for the global-GUID video-matching rule.
  - The VPS one-command deploy is `deploy/deploy-vps.sh` (renamed from the old `update.sh`; aliases `pnpm deploy:vps`, `backup:db`, `restore:db`). Full doc: `DEPLOYMENT_VPS.md`.
  - `scripts/src/seed.ts` is **idempotent and non-destructive** (upsert-by-slug, fill-gaps-only). See `seed-idempotency.md` for the full rules and demo-account gating (`SEED_DEMO_ACCOUNTS`). Dev-only hard reset via `SEED_RESET=1` (aborts if any payment/paid grant exists).
- **Adding any workspace dependency requires regenerating `pnpm-lock.yaml`** (run `pnpm install`) and committing it — both Dockerfiles install with `pnpm install --frozen-lockfile`, which fails if the lockfile is stale.
- The api image bundles full `node_modules` (not just dist) because the runtime needs `drizzle-kit` to run migrations on container start.
