---
name: Mobile purchase visibility & no-access loop
description: Rules for the single mobile sticky bottom bar, breaking the no-access loop, and keeping the buy CTA + discount code discoverable.
---

# Mobile purchase visibility & no-access loop

Concerns the physics-platform web app's mobile-first purchase UX.

## One sticky bottom bar, decided centrally
Only ONE fixed sticky bottom bar may render at a time. Compute mutually-exclusive
flags in the single `Layout` (has access → learning nav; no access → buy bar),
never per-page. Individual pages must NOT render their own sticky bottom bars —
that is what caused two overlapping bars (global nav + home's own buy bar) where
the buy CTA was hidden behind the nav. `main` gets `pb-24 sm:pb-0` and the
`Layout` footer gets extra bottom padding while the buy bar shows, so fixed-bar
overlap does not cover footer/content.

**Why:** duplicate per-page bars overlap the global one; centralizing makes
exclusivity structural (`showLearnNav` requires hasAccess, `showBuyBar` requires
!hasAccess).

## Every no-access path must terminate at a purchase panel
A user without access must never bounce between screens. Each no-access entry
point (dashboard, topic-detail, protected/access routes) must land on a real
purchase panel (price + discount badge + buy button), never a dead-end
"Zobacz ofertę → home" that leads back to a locked area. No-access users must
never see a "learning" CTA (gate the mobile learning nav on `!user.hasAccess`).

## Buy CTA visibility beats the auth-loading flash
Show the buy bar immediately — do NOT gate `showBuyBar` on auth `isLoading`.
Prospects are the priority audience and delaying their CTA works against the
whole goal. Only gate the learning nav on `isLoading` so a returning student
doesn't briefly see it before access resolves. The brief buy-bar→nav swap for a
logged-in student is acceptable (same position, content swap only).

**Why:** the user's core complaint was the buy option being hard to find;
instant visibility for new customers outweighs a minor cosmetic flash for
existing students.

## Resume the purchase where the discount is reachable
After a logged-out user taps buy → register, resume to the dashboard buy panel
(which exposes the discount code), NOT straight to the payment provider. Jumping
directly to redirect skips any chance to enter a promo code for a freshly
registered customer.

**How to apply:** the self-contained buy button owns its own checkout dialog
(discount entry) and branches: logged-out → save intent + /register; hasAccess →
/dashboard; logged-in no-access → open discount dialog → start payment.
