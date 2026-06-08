---
name: Payments & access control
description: How payment status and course access work in the physics-platform LMS
---

# Payments & access

- A paid payment has `status === "completed"` (server sets this; there is NO "paid" value). The webhook sets it and flips the user's `hasAccess`.
- Course access is gated **only** by the server field `user.hasAccess`. The frontend must never grant access locally.

**Why:** The payment success page polls and shows confetti, which could be mistaken for an access grant. Access state must always come from `/auth/me` (`hasAccess`) / payment `status`, so a user can't fake access by hitting `/payment/success`.

**How to apply:**
- Payment success page polls `useGetMyPayments` + `auth.refresh()` and only confirms when `status === "completed"` or `hasAccess` is true.
- The purchase flow (`src/hooks/use-purchase.ts`): logged-out → save intent in localStorage + redirect to `/register`; logged-in & !hasAccess → `createPayment` then redirect to provider `redirectUrl`. `PurchaseResume` (mounted in `App.tsx`) resumes the saved intent after auth.
- The courses **list** response has no topic count; per-course progress % requires fetching course detail (`useGetCourse`) to sum `section.topicCount`. Per-section completion = count of progress rows with `taskCheckedByAi` for that `sectionId`.
