---
name: Local dev run setup
description: Steps to get the app running locally (env, schema, seed) and seeded login credentials.
---

# Getting the app running in the Replit dev environment

The three artifact workflows (api-server, physics-platform web, mockup-sandbox) are
registered. The API server fails to boot until these are done:

1. **JWT_SECRET** must exist (min 32 chars) — required even in dev by `env.ts`. It's an
   app-internal signing key, not a third-party credential, so generate one and set it as
   a `development` env var (don't pester the user). `DATABASE_URL` is already provided.
2. **Push schema**: `pnpm --filter @workspace/db run push` (the dev Postgres starts empty).
3. **Seed**: `pnpm --filter @workspace/scripts run seed`.

After that, `/api/healthz` → 200 and `/api/courses` returns the seeded course.

**Why:** a fresh dev DB has no tables; without seed, `/api/courses` returns 500 and the
whole frontend looks broken even though the code is fine.

# Seed data shape

Seed creates an admin user, a student user (granted access to the seeded course), 1 course
("Fizyka klasy 7"), 3 sections, and 9 topics (each with video/quiz/task). The exact dev
login credentials live in `scripts/src/seed.ts` — read them there, don't duplicate here.
