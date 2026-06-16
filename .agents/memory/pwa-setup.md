---
name: PWA setup (physics-platform)
description: How the PWA/service worker is wired in the Vite frontend and the constraints that keep the Replit dev preview working.
---

# PWA setup

The frontend PWA is implemented with `vite-plugin-pwa` (Workbox `generateSW`) configured in `artifacts/physics-platform/vite.config.ts`.

## Rules / non-obvious constraints
- **`devOptions.enabled` MUST stay `false`.** If the service worker activates in the Replit dev preview (a proxied iframe), it caches assets and breaks/staleness the preview. SW is only meant for the production Docker build. Verify the app in dev still loads after any PWA change.
- **No static `public/manifest.webmanifest`.** The plugin emits its own `manifest.webmanifest` (same filename) at build time and injects the `<link rel="manifest">` + `registerSW.js` into the built `index.html`. Keeping a static one causes a filename collision. Do not re-add a manual manifest `<link>` in `index.html` — the plugin injects it on build (and intentionally not in dev).
- **Production base path is `/`.** The Docker web build sets `BASE_PATH=/`; SW `scope`/`start_url` and manifest icon `src` (no leading slash, base-relative) depend on this.
- Icons live in `public/`: `icon-192.png`, `icon-512.png` (used for both `any` and `maskable` — the atom glyph has enough padding), `apple-touch-icon.png` (linked manually in `index.html`), plus `favicon.svg`. Regenerate from an atom SVG via ImageMagick `magick`/`convert`.

**How to apply:** after touching the PWA config, run `PORT=8080 BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/physics-platform run build` and confirm `dist/public/{sw.js,workbox-*.js,registerSW.js,manifest.webmanifest}` exist, then restart the dev workflow and confirm dev still serves.
