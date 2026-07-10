---
name: Additive content seed + verifying existing działy untouched
description: How to add a course collection/section without touching existing ones, and how to prove it, in the FizykaAI export/import pipeline.
---

# Adding content without touching existing działy

**Rule:** To add a new section/lessons and leave existing content byte-identical:
run `SEED_FORCE=1 pnpm --filter @workspace/scripts run seed` **without** `SEED_RESET`,
then `export:elearning`, then `verify:content`.

**Why:** `seed.ts` is idempotent/non-destructive. It matches course/section/topic by
natural keys (slug) and only inserts what's missing; existing rows (and the video/
image/quiz/task children a topic already has) are left untouched. The destructive
`wipeCourseData()` runs **only** under `SEED_RESET=1` (and even then it refuses if the
DB holds real payments/paid access). `SEED_FORCE=1` merely bypasses the early-exit
idempotency guard (skip-if-DB-has-courses / skip-if-export-file-exists) — it does NOT wipe.

**How to apply:** Author the new section in `course-data.ts`. The full content pipeline is
seed (Replit dev DB) → `export:elearning` (writes git-tracked `scripts/data/export/*.json`,
allowlist = content only, never user data) → commit → prod applies via migrate + seed/
`import:elearning` (idempotent, natural-key merge, never deletes).

# Proving existing content is untouched

`export-elearning.ts` has **no `ORDER BY`**, so a raw `git diff` of the export JSON is huge
and misleading (row reordering + pre-existing timestamp drift between the committed baseline
and the live DB). Serial IDs also churn across full reseeds, and additive nullable columns
add `"field": null` to every existing row's export.

**To actually prove existing rows are unchanged:** run an order-independent *semantic* diff
per table — parse baseline (`git show HEAD:<path>`) vs current, strip volatile keys
(`id, createdAt, updatedAt, *Id` FKs) and drop null-valued keys, build a multiset, and check
`baseline − current == ∅` (nothing lost) and `current − baseline == exactly the new rows`.

# Repeated-source-filename videos need explicit arrays

Dział 1–3 derive videos/images by lesson code from the Bunny map + PNG folder, and the
derive path **dedups by source filename**. Dział 4 reuses `ScreenRecorderProjectNN` names
across lessons, so that path would collapse distinct clips. Lessons therefore carry explicit
`videos[]`/`images[]` in `course-data.ts` (`VideoDef`/`ImageDef`), resolved against
`scripts/data/bunny-videos.json` by **exact filename (with extension)**; seed strips the
extension into `bunnyTitle`. A ROOT video is an in-lesson alias of position-01, not a
separate row — seed only the numbered position clips. Task-card → worked-example link:
`lessonImages.relatedVideoTitle` (ext stripped) is matched to `videos.bunnyTitle` within the
same topic by the topic route to produce `relatedVideoId`.
