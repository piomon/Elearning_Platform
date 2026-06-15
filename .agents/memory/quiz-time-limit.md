---
name: Quiz time-limit enforcement
description: How timed-quiz windows are enforced server-side and surfaced in the student UI.
---

Timed quizzes use a signed start-ticket, not client trust.

**Rule:** A timed quiz (`timeLimitMinutes != null`) requires the student to first
call the start endpoint, which returns a JWT `startToken` carrying `{quizId,userId,startedAt}`.
Submission must echo that token; the server recomputes elapsed time and rejects late
submissions (403) or a missing/invalid token (400). Untimed quizzes ignore the token.
There is a small grace window (a few seconds) to absorb network latency.

**Why:** Elapsed-time must be server-authoritative — a client countdown can be paused,
forged, or back-dated. The signed ticket makes the start time tamper-proof.

**How to apply:**
- Backend helper signs/verifies the ticket and exposes an injectable `startedAt` so tests
  can back-date a token to simulate expiry (403) vs a fresh token (201).
- Frontend shows an explicit "start" gate for timed quizzes, a live countdown, and
  auto-submits on expiry. Auto-submit fills any unanswered question with its first option
  so the complete-submission contract still holds.
- A pitfall: passing the submit handler directly to onClick passes the click event as the
  first arg; if that arg is an `auto` flag it becomes truthy — always wrap in an arrow.
