---
name: Seed is destructive; backfill content non-destructively
description: How to add/seed course content (e.g. board tasks) safely across dev and production without wiping owner data.
---

`scripts/src/seed.ts` calls `seed()` at module top level (self-runs on import) and
`seed()` begins with `wipeCourseData()` — it DROPS and re-creates all course content.

**Why:** Two consequences. (1) You must never `import` anything from `seed.ts` just to
reuse a constant — the import alone runs the destructive seed. Shared seed data (e.g.
`BOARD_TASKS_BY_CODE`) belongs in the pure data module `scripts/src/course-data.ts`,
which both `seed.ts` and any backfill script import. (2) You must never run the full seed
against production to add content — it erases the owner's real lessons/quizzes/tasks.

**How to apply:** To add content to an existing (especially production) DB, write a
SEPARATE non-destructive, idempotent backfill (see `scripts/src/backfill-tasks.ts`,
npm `backfill:tasks`). Match rows by STABLE identity — section `slug` + lesson `slug`
(topic ids differ between environments) — and insert only when the target has none
(`WHERE NOT EXISTS` / select-then-skip). Never hard-code dev topic ids in anything meant
to run on production. The seed change covers fresh seeds; the backfill covers existing DBs.
The course has 3 sections (`dzial-1/2/3`) × lessons (`lekcja-NN`), 21 topics total; lesson
`slug` is unique only within its section, so always match on (sectionId, slug).
