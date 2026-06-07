---
name: Orval query options cast
description: How to pass enabled/retry to Orval-generated hooks without TypeScript errors, and the pitfall of overriding queryKey.
---

The Orval-generated hooks accept `UseQueryOptions` for the `query` option, but React Query v5 requires `queryKey` as a required field on that type. Passing `{ enabled: false }` alone causes TS2741.

**Rule:** Cast the query option object as `as any` — do NOT add `queryKey: []`.

**Why:** Adding `queryKey: []` causes every hook that uses it to share the same React Query cache key `[]`. When multiple hooks (e.g. `useGetMe` and `useListTopics`) both have `queryKey: []`, whichever resolves last overwrites the cache entry for `[]`, so one hook returns data intended for another. This manifests as `topics.map is not a function` (User object instead of array).

**How to apply:**
```tsx
// CORRECT
const { data } = useGetTopic(topicId, {
  query: { enabled: !!topicId } as any,
});

// WRONG — breaks shared cache
const { data } = useGetTopic(topicId, {
  query: { queryKey: [], enabled: !!topicId } as any,
});
```
