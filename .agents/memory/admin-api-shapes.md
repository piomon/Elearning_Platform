---
name: Admin API response shapes
description: Required envelope shapes for admin endpoints to match the OpenAPI spec and frontend generated hooks.
---

**Admin users list** (`GET /api/admin/users`) must return:
```json
{ "users": [...], "total": 2, "page": 1, "limit": 20 }
```
NOT a plain array. The generated hook `useListAdminUsers` expects `AdminUserList` with a `users` property.

**Admin dashboard** (`GET /api/admin/dashboard`) `recentLogins` items must use field name `loginAt` (not `createdAt`). The `RecentLogin` OpenAPI schema requires `loginAt`.

**Why:** The Orval-generated hooks derive TypeScript types from the OpenAPI spec schemas. Shape mismatches cause runtime crashes (`data?.users.map is not a function`, `Invalid time value`).

**How to apply:** When adding new admin endpoints, always check `lib/api-spec/openapi.yaml` schema definitions first and match the backend response exactly.

**Route paths AND method must match the spec, not just shapes.** The spec defines access management as POST + DELETE on `/admin/users/{id}/access` (operationIds grantAccess/revokeAccess). Backend handlers must use exactly those path+method pairs — a backend that uses `/grant-access` / `/revoke-access` (or POST-for-delete) silently 404s the generated hooks even though the UI control renders fine. Symptom: an admin button appears but does nothing / network 404.

**Payment status vocabulary is `pending | completed | refunded`** (webhook sets `completed`, refund sets `refunded`). There is no `success`. Frontend gating like "show refund button" must compare against `completed`, not `success`, or the control never appears.

**Why:** Contract-first repo — Orval generates hook URLs and types straight from the spec. Any drift between spec/backend (path, method, or enum string) produces controls that render but fail at runtime, which typecheck cannot catch.
