---
name: Completion celebration pattern
description: How to fire one-shot UI celebrations (confetti) off server-authoritative completion state without false triggers.
---

Celebration effects (e.g. `canvas-confetti` on lesson completion) keyed off
server-derived progress must trigger on the **false→true transition**, not on the
first truthy render.

**Why:** Gating only on `truthy && !firedRef` fires confetti whenever an
already-completed item first loads (the ref was false at mount), and a single
shared ref never resets, so subsequent items in the same mounted component never
celebrate. A naive baseline taken during the loading phase (`undefined→false→true`
when data arrives completed) re-introduces the same false trigger.

**How to apply:**
- Wait until the server progress object is actually loaded before establishing a
  baseline (`if (!currentProgress) return`).
- Store the previous boolean in a ref; on first loaded state set the baseline and
  return (no celebration); only fire when `checked && !prev`.
- Reset the ref to `undefined` in a separate effect keyed on the entity id
  (declared first so it runs before the celebration effect on id change) so each
  item can celebrate exactly once.
- Apply the `prefers-reduced-motion` guard after transition detection, and keep the
  trigger keyed off server state — never a client-only completion flag.
