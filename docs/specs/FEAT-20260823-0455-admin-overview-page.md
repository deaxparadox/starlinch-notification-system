# FEAT-20260823-0455 — New admin Overview page

Branch: `feature/design-refresh-v2` (base: `main`)

## What's being built

The new admin landing page matching the approved `google-inspired.html` mockup: full
`GradientHero`, greeting headline, 3 stat cards, recent-activity list — wired to
FEAT-20260823-0454's real `/api/admin/stats/` endpoint.

## Current state (verified)

`/admin` currently **is** the trigger table (`frontend/app/(admin)/admin/page.tsx`) — there's no
separate `/admin/triggers` route today. `AdminSidebar.tsx` has 2 nav items: `/admin` ("Triggers")
and `/admin/logs` ("Logs"), with `/admin` matched by exact-equality (`pathname === "/admin"`) and
everything else by `startsWith`. Three other places link to `/admin` expecting the trigger table:
`triggers/new/page.tsx` (a `router.push("/admin")` after creating a trigger, and a "Cancel" link),
and `templates/[channel]/page.tsx` (a "Cancel" link). The website's admin-nav-link
(`(website)/layout.tsx:16`) also points at `/admin` — this one needs **no change**: it's meant to
land on "the admin panel," and per ADR-0003 Decision 4 that should now be Overview, so pointing at
`/admin` is already correct once `/admin` becomes Overview.

## Changes

- **Move** the existing trigger-table page content from `(admin)/admin/page.tsx` to a new
  `(admin)/admin/triggers/page.tsx` (verbatim move, no behavior change).
- **New** `(admin)/admin/page.tsx` — the Overview page:
  - `GradientHero size="full"` with a greeting headline (time-of-day greeting per the mockup:
    "Good morning/afternoon/evening"), a one-line subtitle built from real data (trigger/channel
    counts from the stats response), and a "View all activity →" pill linking to `/admin/logs`.
  - 3 `Card`s below the hero: sent-today (gradient-text number per the mockup's `accent` stat),
    failed-today, and "active/total triggers".
  - A "Recent activity" section listing the `recent` rows from the stats response (channel + status
    pill + trigger key), reusing `ChannelBadge`/`StatusBadge`.
  - Data fetched via the existing `authFetch` pattern (same shape as the trigger table page today),
    loading skeletons and an error message on failure — matching existing page conventions, no new
    pattern introduced.
- **`AdminSidebar.tsx`**: nav items become `Overview` (`/admin`, exact match), `Triggers`
  (`/admin/triggers`, `startsWith`), `Logs` (`/admin/logs`, unchanged). New icon for Overview
  (`LayoutDashboard` from `lucide-react`, already a project dependency).
- **Fix the 3 stale `/admin` links** that expected the trigger table: `triggers/new/page.tsx`'s
  `router.push` and Cancel link, and `templates/[channel]/page.tsx`'s Cancel link all become
  `/admin/triggers`.
- New `Stats` type in `frontend/lib/types.ts` matching the endpoint's response shape.

## Out of scope

- No date-range picker, no charts — matches the approved mockup exactly, nothing beyond it.
- Reduced-hero treatment for the *other* admin pages (trigger table, template editor, logs) is
  FEAT-20260823-0456, not this item — this item only touches Overview, the sidebar, and fixing the
  now-stale `/admin` links forced by moving the trigger table.

## Verification plan

Real browser (headless Chrome against the local dev server, logged in as `testadmin`): confirm
`/admin` shows Overview with real numbers from the live stats endpoint (not mock data), confirm
`/admin/triggers` still shows the trigger table working exactly as before the move, confirm the
sidebar highlights the correct item on each of the 3 admin pages, and confirm the "New trigger" /
"Cancel" flows land back on `/admin/triggers` rather than the new Overview page.
