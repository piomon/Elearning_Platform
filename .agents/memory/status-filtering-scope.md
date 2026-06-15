---
name: Publish-status student filtering scope
description: When content gains a publish status, which routes must enforce it — not just the obvious GET content endpoints.
---

# Publish-status student filtering must cover ALL student-facing routes

When content entities (courses/sections/topics/quizzes) gain a publish status,
"student filtering" is NOT just the GET content endpoints. Every student-facing
route that reads or writes against a content entity must gate on the full
ancestor publish chain, or hidden/draft/archived content leaks or stays
interactive.

Routes that were easy to miss (caught only in architect review, not in the
first pass):
- AI routes: `/ai/check`, `/ai/lesson-chat` — gate on the topic chain before any
  AI call or progress write.
- Progress writes: `/progress`, `/progress/video` — reject writes to
  non-published content.
- Resume: `/progress/continue` — join + filter so it never surfaces hidden
  titles/IDs.
- Metadata flags: `hasQuiz` in the section outline must count published quizzes
  only.

**Why:** the GET content routes are the obvious ones; the interaction/metadata
routes are not. Broken access control there allows interaction with, and
metadata leakage of, non-published material.

**How to apply:** reuse the ancestor-chain helpers in `src/lib/access.ts`
(`isTopicPublished`/`isSectionPublished`/`isQuizPublished`). Tasks have no status
column — they inherit visibility from their topic, so reuse `isTopicPublished`.
Student routes stay published-only even for admins (no bypass). Pure own-data
views without titles/interaction (`/progress/me`, `/progress/summary`) are an
accepted exception, not a gap.
