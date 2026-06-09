---
name: Payments & access control
description: How payment status and course access gating work in the physics-platform LMS
---

# Payments & access

- A paid payment has `status === "completed"` (there is NO "paid" value).
- Course access is gated **only** by the server field `user.hasAccess`. The frontend must never grant access locally or infer it from being on a "success" page.

**Why:** A user could otherwise fake access by navigating to `/payment/success` or directly to a content route. Access truth must come from the server (`/auth/me` → `hasAccess`).

**How to apply:**
- All paid content routes (course overview, section topics, topic detail) must be wrapped in an access guard that requires `hasAccess` (admins exempt) — auth-only protection is NOT sufficient. Non-access users get an upsell screen, never the paid content.
- The payment success page only reflects server/payment state; confirm on `status === "completed"` or `hasAccess`.
- The courses **list** response has no topic count; per-course progress % needs the course detail to sum `section.topicCount`.

## Seed access-grant pitfall
Inserting demo users with `.onConflictDoNothing().returning()` returns an empty row on re-seed (user already exists), so any follow-up that depends on the returned user (e.g. the demo student's `accessGrants` row) silently gets skipped — leaving `hasAccess:false` even though the seed claims success.
**Why:** seed re-runs are common; the grant must not be conditional on a fresh insert.
**How to apply:** after upsert, re-`select` the user by email and use that row for dependent inserts. Grant validity requires status `"active"` + `validFrom<=now` + (`validTo` null or future).

## Video-completion anti-spoofing
Video watch progress is client-reported telemetry, so completion must be made un-forgeable server-side on three axes, all of which are required together — fixing only one leaves a hole:
1. **Denominator:** the completion percentage divisor is ALWAYS the server-stored `videos.durationSeconds`. Never accept a client-sent duration (don't even keep it in the request schema) — a shrunk denominator fakes 100%.
2. **Real durations must exist:** durations must actually be populated, or axis 1 silently falls back to client data. Bunny's `length` field is the source; backfill it into the seed JSON and store it at seed time. A stored-duration fix is worthless if every row is NULL.
3. **Watch-time ceiling:** recorded `watchedSeconds` is capped to wall-clock elapsed since the row's `created_at` (× tolerance + a fixed grace). Anchor to `created_at`, NOT per-call deltas — a per-call grace lets an attacker spam many small calls to reach 100% instantly; the absolute wall-clock anchor makes reaching the end require genuine elapsed time.
**Why:** any single axis alone is bypassable (spoofed duration, NULL durations defeating the denominator fix, or burst-spamming a per-call allowance).
**How to apply:** watched time only moves forward (`GREATEST`); completion threshold is a fraction (e.g. 90%) of server duration; videos with no stored duration simply never auto-complete rather than trusting the client.
