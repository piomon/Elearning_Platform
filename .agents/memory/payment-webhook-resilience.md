---
name: Payment activation must not depend solely on the provider webhook
description: Why Paynow (redirect-based) payments need client polling + a server verify endpoint, not just the notification/webhook
---

# Payment activation resilience (Paynow)

Redirect-based payment providers (Paynow, P24, etc.) confirm asynchronously via a
notification/webhook to the backend. Relying on that webhook as the *only* path to
grant access is fragile: if the notification URL is unreachable (misconfigured VPS,
firewall, wrong `PAYNOW_*` return/notify URL), the buyer pays but access never
activates and the success page hangs forever ("Płatność jest przetwarzana").

**The resilient pattern (two independent paths, same idempotent core):**
1. Keep the webhook handler.
2. Add a **server-to-server verify endpoint** the client can poll: it fetches the
   provider's authoritative status (server-side, API-key signed) and, on a terminal
   CONFIRMED, runs the *same* completion helper the webhook uses.
3. The success page **polls** that verify endpoint (bounded, e.g. 12×5s) reading the
   local payment id from the redirect `continueUrl` query, with a manual re-check
   button + timed-out state as the final fallback.

**Why:** the webhook can silently never arrive; the client already knows it returned
from checkout, so it can drive reconciliation. Two paths + one idempotent completion
helper = self-healing without double-granting.

**How to apply — non-negotiable invariants:**
- Completion helper must be **idempotent**: conditional update guarded by
  `ne(status,'completed')`, grant via `onConflictDoNothing` on the active-grant unique
  index, discount finalize guarded by unique index on `payment_id`. Safe under
  concurrent webhook + verify-poll races; inserts still run even if the update matched
  no row, so a partially-applied prior attempt self-heals.
- Verify endpoint is **owner-only (404 on non-owner)** and grants access **only** when
  the *backend itself* reads a terminal CONFIRMED from the provider. The client sends
  nothing but the payment id — never an amount, status, or course.
- Provider-status fetch returns **null on ANY error** (network/parse/timeout) and null
  is treated as **pending**, never failed. A network blip must never fail a paid order;
  only authoritative terminal statuses (REJECTED/ERROR/EXPIRED/ABANDONED) mark failed.
- The GET status call is signed with HMAC of the **empty string** (same body-HMAC
  scheme as create). This was validated only against mocked fetch — run one real
  sandbox BLIK 111111 purchase after deploy to confirm the provider accepts the
  GET-status signature.
