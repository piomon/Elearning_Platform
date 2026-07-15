---
name: Test DB shared state — settings tables leak across suites
description: The per-test TRUNCATE list deliberately skips singleton settings tables; tests gated on them must reset locally.
---

The api-server test setup truncates content/user tables between tests, but
singleton/settings tables (e.g. `ai_settings`) are NOT on the truncate list.
Vitest runs each file in its own fork, but all files share ONE test database —
so a row written by one suite (e.g. admin tests disabling AI with a custom
error message) persists into every later suite and even later runs.

**Symptom:** a route test suddenly gets 403 "AI wyłączone" (or another
settings-driven denial) that no code path in the failing test explains.

**Rule:** any test whose route is gated on a settings singleton must reset that
table itself in `beforeEach` (delete the row → code falls back to defaults).
Do NOT add settings tables to the global truncate list without auditing suites
that intentionally persist configuration across their own tests.

**Why:** debugging this cost a full round of head-scratching — the failure only
reproduces after the suite that pollutes, so isolated runs look green.
