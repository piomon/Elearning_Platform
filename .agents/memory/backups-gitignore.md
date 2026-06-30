---
name: DB backups vs .gitignore
description: Why DB dump dirs must be git-ignored but *.sql must NOT be — drizzle migrations are tracked .sql files.
---

# DB backups must be git-ignored — but never via `*.sql`

The DB backup script writes full `pg_dump` output (user emails, payments, access
grants, contact messages) to the `backups/` directory. That directory MUST be in
`.gitignore`, or a routine backup-then-commit leaks PII/payment data on the
GitHub/VPS handoff.

**Why:** an audit caught that `backups/` was unignored while the README implied it
was safe — a silent, easy-to-miss data-leak path before going commercial.

**How to apply:**
- Ignore the **directory**: add `backups/` to `.gitignore`.
- Do NOT add a global `*.sql` or `*.sql.gz` ignore. Drizzle migrations live in
  `lib/db/drizzle/*.sql` and are **tracked** — a `*.sql` rule would silently stop
  new migration files from being committed, breaking prod migrate-on-boot.
- Verify both after changes: `git check-ignore backups/x.sql.gz` (should match)
  and `git check-ignore lib/db/drizzle/<latest>.sql` (should NOT match).
