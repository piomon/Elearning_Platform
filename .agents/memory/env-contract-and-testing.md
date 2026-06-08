---
name: Env contract & prod-gated route testing
description: env.ts is the single source of truth for env vars; why prod-only behavior can't be unit-tested in this harness.
---

# Env contract source of truth

`artifacts/api-server/src/config/env.ts` is the single source of truth for env vars.
Any change must stay in lockstep across four places, or deploys silently drift:
`env.ts`, `.env.example`, the `api` env block in `docker-compose.yml`, and the env
table in `README.md` (prod-required vars marked `[PROD]`).

**Why:** P1 deployment breakage came from these four drifting apart (missing
ALLOWED_ORIGINS, COURSE_PRICE_GROSZ, P24_*, BUNNY_*, CONTACT_FROM_EMAIL).
**How to apply:** when adding/removing any env var, edit all four in the same change.

# Prod-gated routes can't be cleanly unit-tested here

Routes gated by `config.isDev || config.isTest` (e.g. `POST /payments/mock-complete/:id`)
cannot be tested for "absent in production" in the Vitest harness: `env.ts` hard-fails
on import under `NODE_ENV=production` unless ALL prod-required vars are set, so importing
the app in prod mode throws before you can assert a 404. Don't write a contrived test for
this — cover the route's security via its ownership test instead.
