---
name: monorepo build & test quirks
description: Non-obvious pnpm/TS-project-reference and Replit-install gotchas in this monorepo
---

# Typecheck must run at the repo root, not per-package
Running `pnpm --filter @workspace/api-server run typecheck` ALONE reports false
errors: `TS6305 Output file lib/db/dist/index.d.ts has not been built` plus
cascading `implicit any` errors, because the `@workspace/db` project reference
isn't built yet.

**Why:** the root `typecheck` script runs `typecheck:libs` (`tsc --build`) first to
build project references, then typechecks the artifacts.
**How to apply:** always validate with root `pnpm run typecheck`. A per-package
filter is only meaningful after the libs have been built.

# Do NOT set `packageManager: pnpm@X` in the root package.json
Adding a `packageManager` field breaks Replit's install wrapper — it runs
`pnpm add pnpm@X` (treating it as a dependency) which fails.
**How to apply:** pin pnpm via Docker `corepack` only, never via root
package.json. Note: `corepack prepare pnpm@9.x` can time out on the sandbox
network; the sandbox itself runs a newer pnpm (10.x).

# Installs must be detached
`pnpm install` in the sandbox should be run detached and polled
(`setsid pnpm install > log 2>&1 < /dev/null &` then `sleep`/tail), ~40s, because
the foreground call can exceed the tool timeout.

# api-server tests need a real Postgres
The vitest harness creates `<db>_test`, migrates from `lib/db/drizzle`, single
fork. Routes are mounted under `/api`. Adding a schema column requires a real
drizzle migration (`pnpm --filter @workspace/db run generate`) so the test
harness picks it up — `push` alone won't create the versioned migration file.
