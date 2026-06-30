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

# Optional-secret-gated routes leak host secrets into Vitest

`env.ts` builds a frozen `config` at import and `isXConfigured()` reads it. Vitest's
`test.env` *merges* with `process.env`, and isolate re-evaluates `env.ts` per file, so
any real third-party secret the host injects (e.g. `PAYNOW_API_KEY`,
`PAYNOW_SIGNATURE_KEY`) makes that provider look "configured" mid-suite. Effect:
`/payments/create` hits the real API → 502, and the slow/failed network call can leak
across the per-test TRUNCATE boundary, surfacing as bogus FK violations / 401s in
*later* files (only in the full run, not in isolation).

**Why:** flaky, order-dependent failures that look like auth/DB bugs but are really
host-secret leakage into the test process.
**How to apply:** neutralize optional provider creds once in `tests/setup.ts` (a
setupFile, so it runs before each file's `env.ts` import) — `delete
process.env.PAYNOW_API_KEY/PAYNOW_SIGNATURE_KEY`. A suite that needs the real path
(webhook HMAC) opts back in with its own `vi.hoisted(() => { process.env.X = ... })`,
which runs before that file's imports. Keep provider-config control in exactly those
two places; don't sprinkle per-file deletes (they shift ordering and make it worse).

# Prod-gated routes can't be cleanly unit-tested here

Routes gated by `config.isDev || config.isTest` (e.g. `POST /payments/mock-complete/:id`)
cannot be tested for "absent in production" in the Vitest harness: `env.ts` hard-fails
on import under `NODE_ENV=production` unless ALL prod-required vars are set, so importing
the app in prod mode throws before you can assert a 404. Don't write a contrived test for
this — cover the route's security via its ownership test instead.
