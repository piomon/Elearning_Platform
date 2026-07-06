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

# Vite artifacts throw at config-load if PORT/BASE_PATH are unset (even for `build`)
`physics-platform` and `mockup-sandbox` `vite.config.ts` throw "PORT/BASE_PATH
environment variable is required" while *loading the config*, so a bare
`pnpm -w run build` fails on them even though nothing is wrong with the code.
**Why:** the configs read `process.env.PORT`/`BASE_PATH` at module top-level; the
dev workflow and the deployment inject these, a plain shell does not.
**How to apply:** to validate a production build locally, run
`PORT=5000 BASE_PATH=/ pnpm --filter @workspace/physics-platform run build`.
`mockup-sandbox` is the Canvas dev tool (not a product artifact) — its build
failing in CI-style runs is expected/irrelevant.

# Root-alias arg forwarding: no `--` separator
Root package.json aliases like `import:content` = `pnpm --filter @workspace/scripts
run import:content`. To pass flags, run `pnpm import:content --dry-run` (pnpm
forwards trailing flags). Do NOT write `pnpm import:content -- --dry-run`: the `--`
is passed through literally to the underlying `tsx script.ts -- --dry-run`, and a
strict arg parser then rejects `--`.
**How to apply:** document/CLI-invoke these aliases WITHOUT `--`. Multi-flag works
too (`pnpm import:content --mode=replace-demo-content --dry-run`).

# psql command-substitution captures the status tag
`ID=$(psql "$DB" -tA -c "insert ... returning id;")` captures BOTH the id AND the
`INSERT 0 1` status line, so `$ID` becomes multi-word and breaks the next query.
**How to apply:** add `-q` (quiet) — `psql -tAqX` — when capturing a RETURNING
value into a shell variable.

# Testing the Paynow webhook signature path
The webhook only runs HMAC verification when `isPaynowConfigured()` (both
`PAYNOW_API_KEY` + `PAYNOW_SIGNATURE_KEY` set); default test env is unset → mock
path. To exercise the real signature/status-mapping path in a test, set those two
vars via `vi.hoisted(...)` BEFORE importing `app`/`env.ts` (static imports would
cache config first), then sign the exact raw JSON string you `.send()`.
