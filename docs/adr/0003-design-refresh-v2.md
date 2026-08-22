# ADR-0003: Design refresh v2 — light, gradient-atmosphere direction

Branch: `feature/design-refresh-v2` (base: `main`)

## Status
Accepted

## Context

After ADR-0002's "Signal" redesign shipped, the user's own live testing surfaced a real, specific
complaint: the app "feels very empty, and lonely," with parts still visually disconnected ("one
page is following some other is following something") even though the individual pages were
already clean. This isn't the same problem ADR-0002 fixed (that was "no shared visual language at
all") — it's "a shared visual language exists, but it's visually thin, and isn't applied
consistently enough across pages to read as one product."

Worked out via `superpowers:brainstorming`'s architectural path with a visual-companion session.
Three original directions (a dark saturated "Aurora," a flat Google-Material-toned "Material
Depth," and an evolution of the existing coral "Signal" look) were all rejected — feedback was
"wrong colors/mood, still flat/corporate, too busy, wrong reference point" across the board. The
user then supplied real reference screenshots (Google's blog, Google One, Gemini, Chrome AI
marketing pages) instead of continuing to iterate blind. A 4th direction built directly from those
references ("Direction D") was confirmed on the first pass, then validated a second time against a
dense data page (the trigger table) to make sure it survives outside a marketing-style hero
layout, not just a greeting screen.

## Decision 1: Visual direction — light background, gradient-atmosphere, oversized type

Supersedes ADR-0002 Decision 1 (the coral-forward "Signal" palette as the *primary* visual
identity). The new direction:

- White/near-white page background (not the warm off-white from ADR-0002, and not any dark base).
- Soft, heavily blurred, multi-hue pastel circles (`filter: blur(...)`, low opacity) used as
  atmosphere behind hero content only — never a solid full-page color wash. This is what makes
  content feel "full" without adding more actual content.
- Oversized, bold, near-black headline typography (e.g. page/section titles at 28–40px, weight
  800) doing most of the "richness" work — this is the single biggest lever, more than color.
- Neutral warm-grey rounded cards (`#f7f5f2`-ish, not pure white, not colored) for stat/content
  blocks, big bold numbers, small grey labels.
- Pill-shaped buttons and status/tag badges; color reserved for accents (a small black "LIVE" tag,
  a gradient-text number, a status pill) — never a dominant fill.
- **Channel-color badges from ADR-0002 (WhatsApp green / Email blue / Web Push purple) are kept**,
  re-skinned as pills in this new system — the underlying "color identifies which channel"
  semantic still holds and tested fine inside Direction D's pill language.

## Decision 2: Hero treatment scales down for data-heavy pages

Validated directly with the user via a second mockup: repeating a full gradient-blob hero (large
blobs, 40px headline) on every single page, including dense ones, was rejected as exhausting
before it was even built — caught during brainstorming by testing the language against the
trigger table specifically. Rule going forward:

- **Full hero** (large blobs, big headline + subtitle + CTA): the new Overview page, and website
  marketing-style pages (home).
- **Reduced hero** (small blobs, ~28px headline, no subtitle/CTA row): every other admin page
  (trigger table, template editor, new-trigger form, logs) — same DNA, deliberately quieter.

## Decision 3: Light-only — dark mode is dropped, not redesigned

ADR-0002 Decision 2 established independently-tuned light/dark themes via
`prefers-color-scheme`. Every reference image driving Direction D is light-mode only, and the
soft-pastel-blob look doesn't have an obvious dark equivalent without becoming a different design
(closer to the already-rejected "Aurora" direction). Asked the user directly rather than assume:
**confirmed light-only for this iteration** — dark mode support is removed, not left half-working.
If dark mode is wanted again later, it needs its own deliberate design pass, not a mechanical
color inversion of Direction D.

## Decision 4: A new Overview page becomes the admin default landing

Requires new backend work, not just frontend styling — there's currently no aggregation endpoint,
only `GET /api/admin/logs/` (`backend/notifications/views.py:96`, list + filter, no counts/stats).
A new `GET /api/admin/stats/` endpoint is added, returning: notifications sent/failed today,
count of currently-active triggers, and the N most recent `NotificationLog` rows — the minimum
Overview needs, nothing speculative beyond what the approved mockup shows. `/admin` now redirects
to this page (sidebar's first item), replacing the trigger table as the first thing seen after
login — directly targets the "empty" complaint, since it's the one screen with real content on
first load instead of a bare list.

## Scope

Whole app — website pages (home, login, logout, unauthorized) and all admin pages, not admin-only.
Confirmed with the user explicitly: applying this to only half the app would recreate the exact
"inconsistent across pages" complaint this redesign exists to fix.

## Consequences

- Broken into 6 ordered `FEAT-` items (design tokens → backend stats endpoint → Overview page →
  admin pages pass → website pages pass), each gets its own short spec before implementation,
  same discipline as ADR-0002's rollout.
- Dark mode CSS/tokens from ADR-0002 get removed as part of the design-system-foundation item, not
  left dangling as dead code.
- Channel-color semantics and the sidebar admin shell structure from ADR-0002 (Decisions 1's
  channel-color meaning, Decision 5's sidebar) are the two things this ADR explicitly keeps rather
  than replaces.
