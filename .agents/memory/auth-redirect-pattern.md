---
name: Auth redirect on Clerk sign-in/sign-up pages
description: Why "already signed-in" redirects on pages hosting Clerk's <SignIn/>/<SignUp/> must be declarative, not setLocation-in-effect.
---

On any page that renders Clerk's `<SignIn/>` or `<SignUp/>` (login.tsx, register.tsx),
redirect an already-signed-in user by **early-returning a declarative wouter
`<Redirect to="/dashboard" replace />`** when `isLoaded && isSignedIn` — before the
Clerk component is rendered.

**Why:** Clerk's `<SignIn/>`/`<SignUp/>` performs its own post-auth redirect
(`fallbackRedirectUrl`). If you ALSO call `setLocation("/dashboard")` from a
`useEffect`, the two navigations race and React throws "Maximum update depth
exceeded" (infinite loop). Early-returning `<Redirect>` navigates exactly once
(layout effect) AND skips mounting Clerk's component entirely for signed-in users,
so the race cannot happen.

**How to apply:** wouter's Router has a `base` configured (App.tsx), and both
`<Redirect to="/x">` and the old `setLocation("/x")` resolve relative to that base —
so switching to `<Redirect>` keeps the same target. Do not reintroduce an effect
that navigates on `isSignedIn`.

**Related pre-existing edge case (not yet fixed):** AuthProvider (use-auth.tsx)
calls `logout()` (signOut + navigate to /login) when Clerk says signed-in but the
backend `/me` errors. Until `signOut()` resolves, `isSignedIn` is still true, so
Login's `<Redirect>` can briefly bounce to /dashboard and back. Bounded/terminating,
but if "auth-failure redirect loops" are ever reported, make that `logout()` await
`signOut()` before navigating.
