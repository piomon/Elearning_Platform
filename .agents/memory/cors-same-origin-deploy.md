---
name: CORS & the Replit deployment domain
description: Why production login/CORS breaks after a deploy rename, and the same-origin rule that prevents it.
---

# Same-origin CORS vs. the Replit deployment domain

The SPA and the api-server are served from a **single origin** in the published
Replit autoscale deployment (path routing: `/` → web, `/api` → api). The browser
still sends an `Origin` header on POSTs (e.g. login), so the CORS middleware must
accept the deployment's own origin or it 403s ("Niedozwolone źródło żądania").

**Rule:** in the CORS check, always allow a request whose `Origin` matches the
host the server is actually served on. Behind the Replit proxy (`trust proxy` is
on) the public host/scheme arrive in `X-Forwarded-Host` / `X-Forwarded-Proto`;
compare BOTH scheme and host (a plain-http origin must not count as same-origin
as the https site). Keep the explicit allowlist for genuine cross-origin clients;
disallowed cross-origin still throws so the existing 403 handler runs.

**Why:** the production domain config (`APP_URL`/`API_URL`/`ALLOWED_ORIGINS`) is
plain env config and goes **stale when the deployment is renamed** (it was pinned
to an old `*.replit.app` name while the live URL was different). A stale value
silently breaks login (CORS) *and* Paynow return URLs (`config.appUrl` builds
`/payment/success` in payments.ts). The same-origin rule makes login survive any
rename/custom-domain without config edits.

**How to apply:**
- Get the real production URL from `getDeploymentInfo().primaryUrl` (deployment
  skill) — never trust the hardcoded value or `echo $REPLIT_DOMAINS` from the dev
  container (that's the `.replit.dev` dev domain, not prod).
- `.replit` `[userenv.*]` cannot be edited directly; set prod env vars with the
  environment-secrets `setEnvVars({ environment: "production" })`.
- Both env-var and code changes only take effect on the **next publish/redeploy**.
- Verify locally with curl by setting `Origin` + `X-Forwarded-Host` +
  `X-Forwarded-Proto`; same-origin → reaches auth (200/401), foreign → 403.
