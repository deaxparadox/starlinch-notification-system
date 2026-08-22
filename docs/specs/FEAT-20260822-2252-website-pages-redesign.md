# FEAT-20260822-2252 — Website pages redesign

Branch: `feature/ui-redesign` (base: `main`)

## What's being built
The last piece of the redesign: `(website)/layout.tsx`, `(website)/page.tsx` (home), `login/page.tsx`,
`logout/page.tsx`, `unauthorized/page.tsx` — applying the same design system as the admin side. No
routing, auth-flow, or OneSignal-subscribe logic changes (per the URL-routing directive from
FEAT-20260822-1215/1216, already correctly implemented) — presentation only, same as
FEAT-20260822-2250 was for the admin screens.

## Current state (verified)
Read all 5 files fresh. `(website)/layout.tsx`'s nav bar is static text with raw
`border-black/10 dark:border-white/15` (the exact ad-hoc pattern the audit flagged, now replaced
everywhere else). `login/page.tsx` already has the right behavior (loading state, inline error,
post-login OneSignal subscribe) but raw styled inputs/button. `logout/page.tsx` and
`unauthorized/page.tsx` are minimal already; `(website)/page.tsx` shows auth state with plain links.

## Changes
- **`(website)/layout.tsx`**: nav bar becomes a light header using token colors
  (`border-border`, `bg-surface`) instead of raw black/white opacity values, product name only (no
  admin-specific nav needed here — this is the public site, not the dashboard).
- **`(website)/page.tsx`**: `Button`/`buttonVariants` for the Log in/Log out links instead of plain
  underlined text, same conditional auth-state rendering logic (unchanged).
- **`login/page.tsx`**: wrapped in a `Card`, `FieldLabel`/`Input`/`FieldError` replace the raw
  labeled inputs, `Button loading={submitting}` replaces the manually-built disabled/label-swap
  button — same behavior, now using the shared loading-state pattern instead of a bespoke one.
- **`logout/page.tsx`**: replace bare "Logging out…" text with a small `Skeleton`-based or spinner
  treatment consistent with other loading states in the app.
- **`unauthorized/page.tsx`**: restyled with tokens; `buttonVariants` for the "Back to home" link.

## Design rationale
Same as FEAT-20260822-2250: no new decisions, this is applying already-approved tokens/components
to the remaining pages. The one thing worth calling out explicitly: none of this touches
`lib/auth.tsx`, `lib/api-client.ts`, or the OneSignal subscribe flow in `login/page.tsx` — those are
data/behavior, not presentation, and are out of scope for a UI redesign.

## Verification plan
Real-browser check in both themes: home page shows correct state (anonymous vs. logged in) with
styled buttons, login form styling + the existing "Logging in…" behavior still works end to end
against the real backend (including the OneSignal subscribe path, already verified working in an
earlier session), logout still fires the real logout call and redirects, unauthorized page renders
correctly for a non-staff account. This is the last item — once verified, do a final full-app pass
(build, lint, both themes) confirming nothing regressed across the whole redesign before closing it
out.
