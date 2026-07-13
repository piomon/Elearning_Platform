---
name: pnpm audit overrides
description: How transitive-vuln overrides are done in this workspace and the pitfalls hit
---

# Scoped overrides close transitive audit findings
Transitive vulnerabilities (no direct dep to bump) are fixed via scoped pnpm
overrides in `pnpm-workspace.yaml`, e.g. `lodash-es@>=4.0.0 <4.18.0: '>=4.18.0'`.
Each override carries a comment with the GHSA id and the dependency path.

**Why:** upstream packages (excalidraw, orval, supertest chains) lag on patch
releases; waiting for them leaves audit red indefinitely.
**How to apply:** scope the override to the vulnerable range, and ALWAYS cap the
replacement below the next major — `@babel/core: '>=7.29.6'` silently pulled
Babel 8.0.1 and broke the vite-plugin-pwa service-worker build ("Requires Babel
^7.0.0-0, but was loaded with 8.0.1"). Correct form: `'>=7.29.6 <8'`.

# esbuild is pinned via a root override
The root `esbuild:` override pins one exact version for the whole tree
(originally for drizzle-kit's vulnerable copy). When bumping it, check vite's
accepted range first (`npm view vite@X dependencies.esbuild`); tsx pins `~0.x`
but tolerates the pinned version in practice — verify by running the api-server
esbuild build and dev workflows.

# minimumReleaseAge gate
`minimumReleaseAge: 1440` means a patch published <1 day ago cannot be
installed; check `npm view <pkg> time` before bumping and either wait or use
the exclude list (trusted orgs only).

# Orphaned vitest runs poison the shared test DB
If a test command is killed by the bash tool timeout (exit -1), the vitest
child keeps running and its per-test TRUNCATE races any new run against the
same `<db>_test` database → phantom FK violations (e.g. "section_id=(1) not
present") in seedCourse. Kill leftover vitest PIDs before re-running, and run
the 15-file suite in batches of ~4-6 files to stay under the 120s tool timeout
(full suite takes ~105s+ and gets killed).
