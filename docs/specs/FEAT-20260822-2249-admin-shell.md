# FEAT-20260822-2249 — Admin shell

Branch: `feature/ui-redesign` (base: `main`)

## What's being built
The sidebar navigation shell for the `(admin)` route group, per the approved mockup (ADR-0002,
Decision 5). No changes to the guard logic itself — only what wraps the guarded content once access
is granted.

## Current state (verified)
`app/(admin)/layout.tsx` currently renders guarded children in a bare `<div className="flex flex-1
flex-col">`, with a plain-text `"Checking access…"` loading state. Guard logic (redirect to
`/login`/`/unauthorized`, the reload-recovery probe) is correct and unchanged by this item — this is
purely what wraps the content once `accessGranted` is true.

## What's being added
- `components/AdminSidebar.tsx`: fixed-width sidebar (per mockup) with the product name, nav links
  to `/admin` ("Triggers") and `/admin/logs` ("Logs" — page doesn't exist until
  FEAT-20260822-2251, but the nav item does; linking to a route that 404s for one item is a smaller
  problem than shipping a shell with dead-looking nav, and it's fixed by the very next item), the
  active link highlighted (via `usePathname()`), and a footer showing the logged-in username +
  a `/logout` link.
- `(admin)/layout.tsx`: wraps children in the new shell (sidebar + content area) instead of the bare
  div. The `"Checking access…"` state becomes a `Skeleton`-based placeholder shaped like the shell
  (sidebar-width block + a content-area block) instead of bare text, so there's no layout jump when
  real content arrives.

## Design rationale
- Active-link highlighting reads `usePathname()` from `next/navigation` — client-side hook, fine
  since this layout is already `"use client"`.
- The "Logs" link pointing at a not-yet-built page is a deliberate, temporary, and short-lived
  state (the very next TODO item builds it) — not a dead-end left unaddressed.
- No new component needed beyond what FEAT-20260822-2248 already built (`Skeleton`) — the sidebar
  itself is page-shell-specific enough that it doesn't belong in the general `components/ui/`
  library.

## Verification plan
Real browser check (not just visual): confirm the sidebar renders with `testadmin` logged in, the
active nav item highlights correctly on `/admin` vs. `/admin/triggers/new`, the skeleton shell shows
during the loading window (throttled network, or by observing the post-reload probe path), and the
existing guard behaviors (anonymous → `/login`, non-staff → `/unauthorized`) still work exactly as
before — this item must not regress FEAT-20260822-1215's guard logic.
