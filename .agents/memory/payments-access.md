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
