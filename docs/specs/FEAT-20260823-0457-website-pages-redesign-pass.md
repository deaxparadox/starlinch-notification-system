# FEAT-20260823-0457 — Website pages redesign pass

Branch: `feature/design-refresh-v2` (base: `main`)

## What's being built

The full-hero version of Direction D applied to the 4 website pages (`home`, `login`, `logout`,
`unauthorized`) — the last item in ADR-0003's whole-app scope.

## Current state (verified — read each file)

All 4 are simple centered-content pages (`flex flex-1 flex-col items-center justify-center`), no
hero treatment, predating ADR-0003. `login` uses `Card` for the form (already picks up
FEAT-20260823-0453's new neutral-card look automatically). None of the 4 has enough content to
carry a literal copy of the Overview page's hero layout (big headline + subtitle + CTA row) — a
login form, a "logging out" spinner, and a 2-line error message are all too content-light for
that structure.

## Design decision: "full hero" means the full-size blob backdrop, not the Overview layout

ADR-0003 Decision 2 draws the full-vs-reduced line at *blob size/opacity*, not at a specific
content layout — the Overview page's headline+subtitle+CTA structure is what Overview needed, not
a template every full-hero page must copy. Applying full-size blobs as a rich backdrop behind each
page's own existing centered content satisfies "full-hero version of Direction D" faithfully
without forcing awkward marketing copy onto a login form or a spinner. `GradientHero` gets a new
`padded?: boolean` prop (default `true`) so these pages can supply their own centering/padding
classes instead of the component's built-in header-block padding — a small, backward-compatible
addition; none of the 4 existing call sites pass it, so their behavior is unchanged.

## Changes

- `components/ui/gradient-hero.tsx`: add `padded` prop (above).
- `home`, `login`, `logout`, `unauthorized`: each page's existing outer
  `flex flex-1 flex-col items-center justify-center ...` div becomes a `GradientHero size="full"
  padded={false}` with that same className, wrapping the page's existing content unchanged.

## Out of scope

- No copy/content changes to any of the 4 pages beyond the visual wrapper.
- No changes to `(website)/layout.tsx` (nav) — not asked for, and it's shared chrome outside any
  single page's content area.

## Verification plan

Real browser (Playwright): screenshot all 4 pages, confirm the full-size blob backdrop renders
correctly behind each page's existing content (form, spinner, message) without breaking centering
or the existing `Card`/`Button` styling, and confirm this reads as visually consistent with the
Overview page's full-hero treatment (same blob scale/opacity) rather than a different look.
