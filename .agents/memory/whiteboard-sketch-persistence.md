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

## Excalidraw 0.18 view/zoom lessons (verified against bundled source)
- `initialData.appState.zoom = { value: 0.8 }` IS honored — `restoreAppState`
  clamps via `getNormalizedZoom` (0.1–30) and does not reset to 1. The board
  starts zoomed out ~20% by design (lines look thinner, more writing room).
- Type `NormalizedZoomValue` imports from `@excalidraw/excalidraw/types`
  (exports map `"./*"` → dist type files); type-only, safe at runtime.
- `api.scrollToContent(els, { fitToViewport: false, animate: false })` only
  recomputes scroll — zoom is untouched unless `fitToContent`/`fitToViewport`
  is truthy. Used to center a restored sketch at the default zoom.
- Zoom is intentionally NOT persisted with the sketch — every load starts 0.8.
- Pen strokeWidths are fractional (0.75/1.5/3, thin is default). AI export
  (`exportToBlob`, `maxWidthOrHeight: 1600`) scales by element bbox, not zoom:
  very large sketches downscale thin strokes (~0.37px at bbox 3200). If Gemini
  readability degrades, raise maxWidthOrHeight or bump thin pen to 1.
