---
name: Local dev run setup
description: Steps to get the app running locally (env, schema, seed) and seeded login credentials.
---

# Getting the app running in the Replit dev environment

From a fresh snapshot, workflows may NOT exist yet even though `artifact.toml` files are
committed — `listWorkflows()`/`listArtifacts()` return empty. Re-register each app artifact
(api-server, physics-platform) by replacing its `artifact.toml` with byte-identical content
via `verifyAndReplaceArtifactToml`; that materializes the workflows so they can be started.

The API server fails to boot / seed+auth fail until these are done:

1. `pnpm install`, then **`pnpm rebuild bcrypt`** — bcrypt's native build script is in
   pnpm's ignored-build-scripts list, so a plain install leaves it unbuilt and any
   `require('bcrypt')` (seed script, login/register) throws at runtime. Rebuild it once.
2. **JWT_SECRET** must exist (min 32 chars) — required even in dev by `env.ts`. App-internal
   signing key, not a third-party credential, so generate one and set as a `development`
   env var (don't pester the user). `DATABASE_URL` is already provided.
3. **Push schema**: `pnpm --filter @workspace/db run push` (the dev Postgres starts empty).
4. **Seed**: `pnpm --filter @workspace/scripts run seed`.

After that, `/api/healthz` → 200 and `/api/courses` returns the seeded course.

**Why:** a fresh dev DB has no tables; without seed, `/api/courses` returns 500 and the
whole frontend looks broken even though the code is fine.

# Seed data shape

Seed creates an admin user, a student user (granted access to the seeded course), 1 course
("Fizyka klasy 7"), 3 sections, and 9 topics (each with video/quiz/task). The exact dev
login credentials live in `scripts/src/seed.ts` — read them there, don't duplicate here.
