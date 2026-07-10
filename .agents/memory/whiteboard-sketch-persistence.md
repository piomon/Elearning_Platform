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
- `initialData.appState.zoom = { value: N }` IS honored — `restoreAppState`
  clamps via `getNormalizedZoom` (0.1–30), no reset to 1. Board default is
  **0.5** (50%, big overview); 0.2 rejected as too small for handwriting.
- Type `NormalizedZoomValue` imports from `@excalidraw/excalidraw/types`
  (exports map `"./*"` → dist type files); type-only, safe at runtime.
- `api.scrollToContent(els, { fitToViewport: false, animate: false })` only
  recomputes scroll — zoom is untouched unless `fitToContent`/`fitToViewport`
  is truthy. Used to center a restored sketch at the default zoom.
- Zoom is intentionally NOT persisted with the sketch — every load starts 0.5.
- On-screen stroke thickness = strokeWidth × zoom. Pens are 1.5/3/6 (thin
  default) so the thin pen stays visible (~0.75px) at 0.5 zoom. AI export
  (`exportToBlob`, `maxWidthOrHeight: 1600`) is bbox-based / zoom-independent,
  so thicker scene widths also export more readably. If the pen looks too faint,
  bump DEFAULT_ZOOM to ~0.6 rather than re-tuning pen widths.

## Hiding Excalidraw's native side panels (keep canvas full width)
- The desktop properties/colors panel is `.App-menu__left` (Excalidraw const
  `CLASSES.SHAPE_ACTIONS_MENU`): width 12.5rem, `position:absolute`, it OVERLAYS
  the left ~1/3 of the canvas. Hide it with a scoped CSS rule
  `.excalidraw .App-menu__left { display:none !important }` imported only by the
  whiteboard component. Top toolbar, bottom zoom, and undo/redo are in separate
  containers (`.App-toolbar`, `.App-menu_bottom`) — unaffected. Mobile uses a
  different collapsible `.App-mobile-menu` bottom sheet — leave it alone.
  **Why:** users complained the color panel ate 1/3 of the board width.
  **Trade-off:** hiding it also removes desktop delete/duplicate/group/font-size
  affordances; delete still works via eraser/Delete key/context menu, so nothing
  is irrecoverably lost for a calc whiteboard. Provide color/width via a custom
  compact bar below the board (`api.updateScene({appState:{currentItemStrokeColor
  /Width}})`). `updateScene` partial-merges appState — do NOT re-set unrelated
  fields (e.g. don't force color back to black inside a set-pen-width handler).
