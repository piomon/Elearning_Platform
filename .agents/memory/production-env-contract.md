---
name: Production env contract
description: Which env vars the api-server requires to boot in production vs which integrations are optional-at-boot.
---

# Production env contract (api-server)

`config/env.ts` runs at import time and the api-server crash-loops on startup if a
**required** var is missing — in autoscale that fails the `/api/healthz` startup
probe, so the *deploy* fails at the promote phase (build logs look successful and
stop at "Creating Autoscale service").

**Required in production (must be set or deploy fails):**
`JWT_SECRET` (>=32 chars), `DATABASE_URL` (auto), `APP_URL`, `API_URL`,
`ALLOWED_ORIGINS`, `COURSE_PRICE_GROSZ` (these last four use `readProd`, which
throws in prod even though it has a dev fallback).

**Optional at boot, gated by guards:** Gemini (`GEMINI_API_KEY`), Przelewy24
(`P24_*`), Bunny (`BUNNY_*`), SMTP (`SMTP_*`/`CONTACT_FROM_EMAIL`). Read via
`readOptional`; features are disabled via `isGeminiConfigured`/`isP24Configured`/
`isSmtpConfigured` (and `config.bunny.libraryId` check in courses) when absent.

**Why:** the user chose to publish before configuring the paid integrations. They
were previously `readProdRequired` (fail-fast in prod), which blocked the deploy.

**How to apply:** keep these four integrations optional-at-boot — adding the
secret in the *production* environment auto-activates the feature on the next
deploy. Do NOT make payments/AI/video *fake* a result when unconfigured; they
must return an honest "unavailable" (payments returns 503 in prod). Never grant
access/progress client-side regardless.
