---
name: Excalidraw init race
description: excalidrawAPI callback fires before initialData is applied — one-shot setup effects get clobbered by the async scene restore.
---

# Excalidraw: `excalidrawAPI` is ready BEFORE `initialData` is applied

The `excalidrawAPI` callback fires on mount, but Excalidraw applies
`initialData` (elements + appState) **asynchronously afterwards**. Any one-shot
setup done in an effect keyed on the api (e.g. `setActiveTool`, `updateScene`,
`scrollToContent`) runs first and is then silently clobbered by the restore:
the tool reverts to "selection" and `getSceneElements()` returns `[]` at setup
time, so content-dependent logic (centering on a restored sketch) never runs.

**Why:** observed empirically — instrumentation right after api-ready showed
`zoom=1 tool=selection strokeWidth=2` (library defaults), while 2s later the
state showed the initialData values; a single `setActiveTool("freedraw")` at
api-ready never survived.

**How to apply:** make startup configuration idempotent and re-apply it a few
times shortly after mount (e.g. immediately + retries at ~60/200/500ms, with
cleanup on unmount), then never touch zoom/tool again so user choices are not
overridden. `updateScene({ appState: { zoom: { value } } })` is the sound way
to force zoom; `scrollToContent(els, { fitToViewport: false })` preserves it.
Note: `initialData.appState.zoom` itself IS respected by the restore — only
imperative calls made before the restore are lost.
