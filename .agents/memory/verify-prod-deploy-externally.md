---
name: Verifying VPS prod deploy without SSH
description: How to confirm what code fizyka7.pl actually runs from outside (bundle markers, build time, migration inference), plus the prod Clerk pk_test observation.
---

# Verify prod deploy externally (no SSH)

There are no VPS/SSH credentials in Replit — deploys run on the user's server. You can still
verify "did the deploy land?" from outside:

1. **Frontend marker strings**: fetch `https://fizyka7.pl/` → extract `/assets/index-*.js`
   (and lazy chunks, e.g. `lesson-whiteboard-*.js`), grep for a string that exists ONLY in the
   new commits (pick one via `git diff old..new | grep '^+'`). New-only string present ⇒ new
   build is live. Caches can only serve *stale* content, never future content, so a positive
   match is conclusive.
2. **Build time**: `curl -sI` on any hashed asset → `Last-Modified` = when the web image was built.
3. **Migrations**: `/api/healthz` returning ok ⇒ schema migrations passed — the api entrypoint
   runs `drizzle-kit migrate` fatal-on-error *before* the server starts.
4. **Atomicity**: `deploy-vps.sh` builds web+api images from one `git pull`, and pushes moved
   origin/main tip-to-tip — so frontend-new ⇒ api-new (no intermediate states to worry about).

**Why:** recurring question after every fix ("is prod updated?"); guessing from symptoms wastes
a round-trip with the user.

**How to apply:** login-gated behavior (AI check, payments) still needs the user to test — fresh
test accounts have no course access, and demo accounts are gated off in prod.

## Side observation (Jul 2026)

The prod bundle embeds a Clerk **dev-instance key (`pk_test_…`)** — production runs on a Clerk
development instance (100-user cap, "development mode" branding, weaker guarantees). Migrating
fizyka7.pl to a production Clerk instance (pk_live + production domain in Clerk dashboard) is a
real pending concern, separate from any code change.
