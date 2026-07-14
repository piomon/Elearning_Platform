---
name: E2E login with external Clerk
description: How to get an authenticated browser session for e2e tests — programmatic testClerkAuth fails, UI login hangs; use the FAPI dev_browser flow.
---

The project uses an EXTERNAL Clerk instance (`checkClerkManagementStatus` → "external").
Consequences for browser testing (`runTest`):

- `testClerkAuth: true` DOES NOT WORK — the helper only supports Replit-managed Clerk
  and fails with "CLERK_SECRET_KEY secret cannot be found" even though the secret exists.
- Driving the Clerk `<SignIn/>` UI from the testing agent hangs/timeouts (10 min):
  the instance enforces an email-code SECOND factor for new devices, so password-only
  UI login never completes.

**Working recipe** (dev instance):
1. Create a test user via Backend API (`api.clerk.com/v1/users`) with a
   `something+clerk_test@example.com` email and a password — test-mode emails accept
   the fixed OTP **424242**.
2. Frontend API (domain decoded from `pk_test_` key, base64): `POST /v1/dev_browser`
   → dev-browser JWT; `POST /v1/client/sign_ins?__clerk_db_jwt=<jwt>` with
   `identifier`+`strategy=password`+`password`; if `needs_second_factor`, call
   `prepare_second_factor` (email_code) then `attempt_second_factor` with code 424242
   → `status: complete`.
3. In the test plan, navigate to `/dashboard?__clerk_db_jwt=<jwt>` — clerk-js adopts
   the signed-in client. Tell the agent to NEVER open /login. Do NOT land directly on
   a guarded route like `/admin` — the route guard redirects to /login before clerk-js
   adopts the session; land on /dashboard first, then navigate normally.
4. The local `users` row is created JIT on the first authenticated request — insert
   `access_grants` only AFTER the browser confirms logged-in state.
5. Clean up afterwards: delete the Clerk users (Backend API) and the local user rows.

**Also:** the headless test browser lacks proprietary H.264 codecs, so lesson pages
with Bunny videos always log a fatal `manifestIncompatibleCodecsError` HLS console
error — environmental, not an app bug; don't fail tests on it.

**curl-only API testing variant** (no browser needed): the same FAPI flow works from
bash — but `+clerk_test` emails MUST be sent with `--data-urlencode` (plain `-d` turns
`+` into a space → "Identifier is invalid"). After `attempt_second_factor` completes,
mint short-lived (60s) session JWTs on demand via
`POST /v1/client/sessions/<sess_id>/tokens?__clerk_db_jwt=<dev_browser_jwt>` and call
the API with `Authorization: Bearer <jwt>`. The FAPI domain is base64-decoded from the
`pk_test_` key suffix. Grant course access by inserting into `access_grants`
(user_id, course_id, source, status='active') after the JIT user row exists.
