# BUG-20260823-0544 — website page hero unbounded on wide screens

Branch: `feature/design-refresh-v2` (base: `main`)

## What's broken

Reported by the user with a real screenshot at their actual browser width (~1878px): the login
page's gradient blobs sat pinned near the far left/right edges of the browser window while the
login card stayed centered, leaving a large empty gap between the "atmosphere" and the actual
content — same "empty" feeling this whole redesign exists to fix, just relocated to wide screens.

## Root cause

`GradientHero`'s blob geometry (`frontend/components/ui/gradient-hero.tsx`) uses fixed pixel
sizes/offsets tuned against the compact visual-companion mockup preview width. On the 4 website
pages (home, login, logout, unauthorized), that hero div has no width cap of its own — it's a
direct `flex-1` child of `<body>`/`<main>`, so it stretches to the full browser width. At the
~900px-ish width the mockups were built/approved at, the blobs land close to the centered content
(as shown, approved, and correctly reproduced at a 1280px test viewport). At a real ~1900px
desktop width, the same fixed offsets keep the blobs near the page's outer edges while the content
(small, centered, `max-w-xs`/`max-w-md`) stays in the middle — so the gap between decoration and
content grows with screen width instead of staying proportional.

**Lateral check (Module 6):** the admin Overview page uses the same `GradientHero size="full"`,
but doesn't have this problem — `frontend/app/(admin)/layout.tsx:76` already wraps all admin page
content in `mx-auto w-full max-w-5xl`, so its hero was never actually unbounded. Confirmed by
reading that layout file, not assumed. The bug is specific to the 4 website pages, which have no
equivalent wrapper — checked all 4 (`home`, `login`, `logout`, `unauthorized`) and found the exact
same unbounded `GradientHero` on every one, not just the login page the user happened to screenshot.

## Fix

Added `mx-auto w-full max-w-4xl` to each of the 4 website pages' `GradientHero` `className` (home,
login, logout, unauthorized) — same pattern the admin shell already uses one level up, just
applied per-page here since there's no shared website-level wrapper equivalent to the admin
layout's. `max-w-4xl` (896px) rather than admin's `max-w-5xl` (1024px) since website page content
(a small centered card or status block) is narrower than admin's data tables.

`flex-1` (governs height, since the parent is a column-direction flex container) and the new
`max-w-4xl` (governs width, the cross axis) don't conflict — confirmed this reasoning by actually
rendering it, not just by inference.

## Verification

Re-screenshotted login, home, and unauthorized at the user's actual reported viewport width
(1878×950, not just the original 1280×800 test size) — blobs now sit close to the content on all
three, matching the originally-approved mockup's proportions regardless of browser width. Logout
redirects immediately (no unauthenticated state worth screenshotting at width), but its markup
change is mechanically identical to the other three, so it's covered by the same fix.
