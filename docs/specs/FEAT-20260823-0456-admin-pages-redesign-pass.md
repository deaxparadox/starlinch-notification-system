# FEAT-20260823-0456 — Admin pages redesign pass

Branch: `feature/design-refresh-v2` (base: `main`)

## What's being built

Apply the reduced-hero + neutral-card language (validated in the approved `trigger-table.html`
mockup) to the 4 remaining admin pages: trigger table, new-trigger form, template editor, logs.

## Current state (verified — read each file directly)

All 4 pages currently use a plain `<h1 className="text-lg font-semibold">` page title with no
hero treatment at all — this predates ADR-0003 entirely (from the first redesign). None of them
have visual inconsistency with each other structurally, but none match Direction D yet.

`frontend/components/ui/table.tsx` — the shared `Table` wrapper (used by both the trigger table and
logs page) still has ADR-0002's bordered look (`rounded-radius-md border border-border`,
`TableHead` on `bg-surface-muted`) — doesn't match Direction D's borderless, rounder,
warm-neutral-surface language yet. Fixing this once here benefits both pages that use it, rather
than patching each page's markup separately (Module 6 lateral fix, not scope creep — it's the same
"whole app" ADR-0003 already covers).

## Changes

- **Trigger table** (`admin/triggers/page.tsx`): title/subtitle/"+ New trigger" button row moves
  inside `<GradientHero size="reduced">`, subtitle built from real data ("N active — manage what
  fires on each channel"), matching the mockup's `pagehead` layout exactly.
- **New-trigger form** (`admin/triggers/new/page.tsx`): reduced hero with "New trigger" title +
  the existing back-link kept above it (small, muted) rather than inside the hero.
- **Template editor** (`admin/triggers/[id]/templates/[channel]/page.tsx`): reduced hero with
  "{trigger} — {channel}" title, same back-link placement as the new-trigger form.
- **Logs page** (`admin/logs/page.tsx`): reduced hero with "Logs" title, filters moved just below
  the hero (unchanged functionally).
- **`components/ui/table.tsx`**: wrapper becomes `rounded-radius-lg bg-surface-warm` (no border),
  `TableHead` background becomes transparent instead of `bg-surface-muted` — cleaner against the
  now-warm row background, matches Direction D's airier look. No structural/semantic changes.

## Out of scope

- Website pages (home/login/logout/unauthorized) — FEAT-20260823-0457.
- No new components beyond what FEAT-20260823-0453 already built — this item is pure application
  of the existing `GradientHero`/`Card`/`Badge` system to more pages.

## Verification plan

Real browser (Playwright, logged in): screenshot all 4 pages side by side and confirm they read as
one consistent system (same hero size/weight, same card treatment) — this whole redesign exists
because the user complained about exactly this kind of inconsistency last time, so a side-by-side
comparison is the actual bar, not "does each page individually look fine."
