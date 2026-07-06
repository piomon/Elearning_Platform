---
name: Bunny playback "works in dev, not on VPS"
description: Diagnosing lesson videos that play on Replit/dev but are blank/broken on the self-hosted VPS.
---

# Bunny video plays in dev but not on the VPS

The lesson embed URL is built **server-side** from `BUNNY_LIBRARY_ID` (via `buildVideoEmbedUrl`), and `docker-compose.yml` forwards it to the api container with a `${BUNNY_LIBRARY_ID:-}` (empty) default. So the same code can silently differ per environment purely by env/config.

Two distinct, indistinguishable-from-code causes — split them by the **symptom the user sees**:

1. **Dashed "wideo chwilowo niedostępne" placeholder** (no player frame at all)
   → `BUNNY_LIBRARY_ID` is missing/empty in *that* environment's `.env`. On Replit it's a set secret; on the VPS it must be added to `.env`. `deploy-vps.sh` now prints a non-fatal warning for this.

2. **Player frame loads but shows a Bunny 403 / black error inside**
   → Env is fine, but a **Bunny dashboard-side restriction** blocks the domain: "Allowed Referrers" / hotlink protection scoped to the dev domain, or "Embed view token authentication" enabled. The embed URL carries **no token**, so if token auth is on, playback fails everywhere it isn't disabled. Fix is in the Bunny dashboard (add the VPS domain to Allowed Referrers, or disable embed-token auth / implement signed tokens) — not in code.

**Why:** these two failure modes look identical in the code path but need opposite fixes (VPS `.env` vs Bunny dashboard). Always ask which symptom appears before changing anything.

**Ruled out as causes:** nginx/Traefik headers — `docker/web/nginx.conf` only sets `X-Frame-Options: SAMEORIGIN` (governs being framed, not framing others) and there is no CSP `frame-src` anywhere.
