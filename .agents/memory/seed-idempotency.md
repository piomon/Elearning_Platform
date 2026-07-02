---
name: Seed idempotency & non-destructive import
description: Why the prod course was empty and the rules the seed must follow to never destroy users/payments/access.
---

# Empty-course root cause
Course content lives in code (`scripts/src/course-data.ts` + `scripts/data/bunny-videos.json`, git-tracked) and DB migrations auto-run on container boot, but **seeding/import is a separate step**. The VPS deploy scripts migrated but never seeded, so prod had schema and zero course rows. Lesson: "content is in the repo and migrations ran" does NOT imply "content is in the DB" — the import must be wired into deploy.

# Seed must be idempotent + non-destructive
The seed can run on every deploy, so it must never wipe or duplicate:
- **Course**: upsert by `courses.slug` (UNIQUE) and keep the stable id. Never delete+recreate — a new course id orphans payments/access_grants/progress.
- **Sections/topics**: their `slug` is NOT unique, so use select-by-(parentId, slug) then insert if missing (no ON CONFLICT). 
- **Leaf content** (videos/images/quizzes/tasks): insert only when the topic has none of that kind; leave existing rows untouched (never overwrite status/content).
- Landing/FAQ/SEO/pricing: upsert on key / seed-only-if-empty / `onConflictDoNothing(target:id)`.

**Why:** the old default path called `wipeCourseData()` which deleted access_grants + progress and recreated the course — running it on prod would revoke paid access. Verified new seed: two runs against a populated DB = +0 rows across all 13 tables (payments/access_grants/progress unchanged).

# Consequences to remember
- **Resurrection:** because seed runs on every deploy and fills gaps, content an admin hard-deletes reappears next deploy. Hide via status (`hidden`/`archived`/`draft`) instead of deleting; existing rows' status is never touched.
- **Slug edits** to an existing section/topic in the admin panel create a duplicate under the original slug on next seed.
- **Demo accounts gated:** `admin@fizyka.edu.pl` (role=admin) + demo student access grant are only created when `SEED_DEMO_ACCOUNTS=1` or `NODE_ENV!=="production"`. **Why:** auto-provisioning an admin row on every prod deploy + Clerk JIT sync (links a Clerk login to any local row with the same verified email) = account-takeover risk if the operator doesn't own that mailbox. Prod admin is granted via `ADMIN_EMAILS` on first login instead.
- **Dev-only hard reset:** `SEED_RESET=1` still wipes+rebuilds but aborts if any payment or payment-sourced access grant exists.
