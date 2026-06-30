---
name: Local dev run setup
description: Steps to get the app running locally (env, schema, seed) and seeded login credentials.
---

# Getting the app running in the Replit dev environment

From a fresh snapshot, workflows may NOT exist yet even though `artifact.toml` files are
committed — `listWorkflows()`/`listArtifacts()` return empty. Re-register each app artifact
(api-server, physics-platform) by replacing its `artifact.toml` with byte-identical content
via `verifyAndReplaceArtifactToml`; that materializes the workflows so they can be started.

The API server fails to boot / seed fails until these are done:

1. `pnpm install` — no native build steps; auth runs through Clerk, there is no bcrypt.
2. Env required at import by `env.ts` even in dev: **CLERK_SECRET_KEY** + **CLERK_PUBLISHABLE_KEY**
   (third-party — the user supplies these as secrets) and **SESSION_SECRET** (min 32 chars;
   app-internal HMAC key for quiz start-tickets — generate one yourself, don't pester the
   user). `DATABASE_URL` is already provided.
3. **Push schema**: `pnpm --filter @workspace/db run push` (the dev Postgres starts empty).
4. **Seed**: `pnpm --filter @workspace/scripts run seed`.

After that, `/api/healthz` → 200 and `/api/courses` returns the seeded course.

**Why:** a fresh dev DB has no tables; without seed, `/api/courses` returns 500 and the
whole frontend looks broken even though the code is fine.

# Seed data shape

Seed creates a passwordless admin user and a student user (granted access to the seeded
course), 1 course, its sections, and topics (each with video/quiz/task). Login is via Clerk:
sign in with the seeded admin email (or any ADMIN_EMAILS address) to get admin. The exact
seeded emails live in `scripts/src/seed.ts` — read them there, don't duplicate here.
