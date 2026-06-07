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
