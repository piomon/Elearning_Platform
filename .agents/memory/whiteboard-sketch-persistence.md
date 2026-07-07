---
name: Whiteboard sketch persistence & single-origin
description: How the lesson whiteboard persists sketches and why prod must stay on one origin.
---

The lesson whiteboard renders one Excalidraw instance **per task** via
`tasks.map(t => <WhiteboardTask key={t.id} />)`. Because each task is a separate
keyed component that all render at once (not one switching component), **drawings
cannot bleed between tasks** — no manual scene-reset effect is needed. A past audit
flagged "state bleed" here; it was a false positive for exactly this reason.

Sketches autosave to `localStorage` under key `fizyka-whiteboard:<taskId>`:
- Save is debounced (~700ms) in Excalidraw `onChange`, storing only non-deleted
  elements; an empty board removes the key.
- Restore happens at mount via `initialData.elements` from a lazy `useState`
  initializer (read once per mounted task).
- "Wyczyść tablicę" clears both the scene and the localStorage key; the debounce
  timer is cleared on clear and on unmount.
- Only `elements` are persisted, not Excalidraw `files` — a toolbar-inserted image
  would restore broken. Acceptable for a calculation whiteboard.

**Why single-origin matters:** localStorage AND the PWA service-worker cache are
per-origin. Production therefore serves the app only on the apex domain; `www` is a
separate Traefik router that 301-redirects to apex (`docker-compose.prod.yml`).
**How to apply:** never serve both apex and www as live app origins — a student
switching hosts would otherwise get split sketches, split cache, and split session.
Both hosts still need DNS records so Let's Encrypt can issue the cert for each.
