---
name: React effect loops from TanStack Query mutation objects
description: Why putting a useMutation result (or a callback closing over it) in useEffect/useCallback deps causes infinite render loops
---

# Never depend on a whole TanStack Query mutation object in effect/callback deps
`useMutation()` (and `use*Mutation` generated hooks) return a **new object every
render** — its `isPending`/`data`/`status` fields change as the mutation runs. So
any `useCallback`/`useEffect` whose dependency array includes that object (or a
callback that closes over it) gets a new identity on every render.

**Why it bites:** an effect that (a) depends on such a callback AND (b) calls that
callback from its **cleanup** will loop: render → new callback identity → effect
re-runs → cleanup fires the callback → mutation → `onSuccess`/refetch → state
change → render → … until React throws "Maximum update depth exceeded". The
console often also shows a misleading "Invalid hook call" as a cascade artifact.
A tell-tale sign is a flood of identical POSTs to the mutation's endpoint right
before the crash.

**How to apply:**
- Depend only on **stable** references. `mutation.mutate` and a query's `refetch`
  are stable; the mutation/query *result objects* are not.
- For an event-handler callback that an effect must call (e.g. a window
  `message` listener reporting progress), stash it in a ref updated each render
  (`const cbRef = useRef(cb); useEffect(() => { cbRef.current = cb; });`) and have
  the subscribing effect depend only on stable values (e.g. `[video.id]`),
  calling `cbRef.current(...)`. This keeps the listener subscribed across renders
  and still flushes on real teardown (unmount / id change).
