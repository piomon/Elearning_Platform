---
name: Async-before-mutation busy lock
description: Why a synchronous ref lock (not mutation.isPending) is needed to prevent double-submits when async work runs before the mutation call.
---

When a click handler does async work (e.g. Excalidraw `exportToBlob` + `FileReader`
encoding, image resize, etc.) **before** calling a TanStack Query `mutation.mutate()`,
do not rely on `mutation.isPending` alone to disable the trigger button.

**Why:** `isPending` only flips to true after `mutate()` is actually called. During the
pre-mutation async window the button is still enabled, so rapid repeated clicks can start
multiple exports and fire multiple POSTs before the first mutation even begins.

**How to apply:** Add a synchronous guard set at the very top of the handler — a
`useRef(false)` checked/set immediately (`if (busyRef.current) return; busyRef.current = true;`)
plus an `isPreparing` state for the disabled/loading UI. Combine them
(`const isBusy = isPreparing || mutation.isPending`) for button `disabled` and spinners.
Release both in every early-return path and in the mutation's `onSettled`. Also clear any
prior success/feedback state at the start of a new submission and on any "clear/reset" action,
so stale results never appear attached to a new attempt.
