---
name: Discount redemption idempotency
description: How discount-use double-counting is prevented, and the ON CONFLICT / partial-index pitfall behind the chosen design.
---

Discount redemption (recording a `discount_code_uses` row and bumping
`discountCodes.usedCount`) must be idempotent: payment providers retry webhooks,
and the dev mock-complete endpoint can be called more than once. The guard is a
unique index on `discount_code_uses.payment_id` + `ON CONFLICT DO NOTHING ...
RETURNING`; `usedCount` is incremented only when a row is actually inserted.
Completion runs inside `db.transaction()` and the helpers take a `tx` executor.

**Why a PLAIN (non-partial) unique index, not a partial one:**
A partial unique index (`WHERE payment_id IS NOT NULL`) cannot be used as an
`ON CONFLICT (payment_id)` arbiter unless the index's WHERE predicate is repeated
in the conflict target. Postgres otherwise errors with "no unique or exclusion
constraint matching the ON CONFLICT specification" — and it fails on the FIRST
insert, not just the conflicting one. The drizzle-orm version in this repo does
**not** emit `targetWhere` into the SQL (the predicate silently vanishes), so a
partial index is unusable here. A plain unique index works because Postgres
treats NULLs as distinct, so legacy/manual rows with NULL payment_id stay
unconstrained while every real payment is unique.

**How to apply:** Any future "record at most once per X" guard that relies on
`ON CONFLICT` should use a plain unique index on a (possibly-nullable) column,
not a partial index — unless you verify the drizzle version emits the partial
predicate into the ON CONFLICT target.
