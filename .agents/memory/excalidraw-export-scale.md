---
name: Excalidraw export scale determinism
description: Why AI-check PNG sizes varied by device and how export scale is pinned
---

# Pin `exportScale` explicitly on every Excalidraw export path

`appState.exportScale` defaults to the device's devicePixelRatio (×2 on
iPhone/Retina, ×3 on some Androids). With `maxWidthOrHeight`, upstream computes
`scale = cap < max(bounds) ? cap/max : appState.exportScale ?? 1` — the cap only
DOWNSCALES oversized content; smaller drawings silently export at DPR scale, so
the identical sketch weighed 2–3× more depending on the student's phone.

**Rule:** always pass an explicit `exportScale` in the appState handed to
`exportToBlob` (lesson whiteboard: 1, or 2 for sketches whose content max
dimension < 780 px — (780 + 2×10 px padding) × 2 = 1600 keeps even that path at
the cap).

**Why:** client-reported: multi-MB uploads from phones for small drawings; also
inflates Gemini vision tokens/latency, worsening peak-hour overload.

**How to apply:** any new export feature must pin `exportScale` the same way.
`getCommonBounds` is exported from `@excalidraw/excalidraw` for threshold math;
export padding is 10 px per side (DEFAULT_EXPORT_PADDING).
