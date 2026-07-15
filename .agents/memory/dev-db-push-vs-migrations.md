---
name: Dev DB is push-managed; migrations are for VPS only
description: Why `drizzle migrate` fails on the dev database and what to do instead when adding schema.
---

The development database was provisioned with `drizzle-kit push` — its
`__drizzle_migrations` table is EMPTY, so running `migrate` there fails or
tries to re-apply migration 0000 onto existing tables.

**Rule:** for any schema change, do BOTH:
1. `drizzle-kit generate` → commit the migration .sql (the VPS/docker-compose
   deploy auto-runs `migrate` on boot and needs the file);
2. apply to the dev DB with `pnpm --filter @workspace/db run push-force`
   (never `migrate` in dev).

**Why:** discovered when adding a new table — `migrate` errored in dev while
the generated file was still required for production. The two mechanisms track
state differently and must not be mixed on one database.

**How to apply:** any time a table/column is added or changed. Verify dev with
a direct `information_schema` query, and rely on the compose migrate step for
the VPS.
