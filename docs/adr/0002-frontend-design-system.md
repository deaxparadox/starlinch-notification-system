# ADR-0002: Frontend design system ("Signal")

Branch: `feature/ui-redesign` (base: `main`)

## Status
Accepted

## Context
The frontend was built page-by-page (FEAT-20260822-1215/1216/1217) with no shared visual
language: every color was an ad-hoc Tailwind utility, inputs/buttons were hand-copy-pasted per
page (~9 times), there was no dark-mode design beyond two CSS variables, and destructive/error
states used the browser's native `confirm()`/raw `JSON.stringify()` output. A UI/UX audit (done
fresh, not from memory of having built it) confirmed this concretely — see the audit findings
folded into TODO.md's FEAT-20260822-2248 entry.

This was worked out via `superpowers:brainstorming`'s architectural path, including a
visual-companion session comparing 3 directions and, within the chosen one, light vs. dark and a
sidebar vs. top-bar admin shell. This ADR records the resulting decisions so future work (and other
sessions) doesn't re-litigate them.

## Decision 1: Visual direction — "Signal"
Chosen over two alternatives (a Linear/Vercel-style neutral+one-accent "Operator Console", and a
near-monochrome "Quiet Confidence" that was flagged as weakest against the brief's own
anti-dullness goal). Signal uses a warm neutral base, one coral primary accent (`#FF6B4A`), and —
specifically because this product's core structure *is* "3 channels × N triggers" — fixed,
consistent colors per notification channel (WhatsApp green, Email blue, Web Push purple) used as a
recurring identity motif (badges, headers, editor screens). This is a meaningful, non-decorative use
of color: it directly communicates "which channel" everywhere it appears.

**Where channel color is NOT used**: the trigger table's per-cell status (Active/Inactive/Not set)
uses semantic state colors (success/error/muted), not channel colors — repeating 3 solid channel
colors down every table row was tested in mockup and judged too loud. Channel color stays reserved
for contexts that identify *which channel*, not contexts that report *state*.

## Decision 2: Light and dark are independently tuned, not inverted
Per mockup comparison, both themes keep the same coral primary and the same 3 channel colors
(they read fine as solid chips against either base), but neutrals are tuned separately — light uses
a warm off-white background (`#FAF8F6`, not stark white), dark uses a warm near-black
(`#151313`, not pure black) with a lighter elevated-surface tone for cards. Theme switching stays
`prefers-color-scheme`-based (system preference) — no manual toggle, per YAGNI; nothing in the
requirements calls for one.

## Decision 3: Tokens as CSS custom properties via Tailwind v4's `@theme`
This project's Tailwind is v4 (confirmed in `frontend/package.json` and the CSS-first `@theme`
block already present in `globals.css` — not the v3 JS-config pattern). Design tokens are defined as
CSS custom properties in `:root` (light values) and re-declared under
`@media (prefers-color-scheme: dark)`, then mapped into `@theme inline` so they become ordinary
Tailwind utilities (`bg-primary`, `text-channel-whatsapp`, etc.) — consistent with how this file
already handles `--background`/`--foreground`, just extended to the full token set.

## Decision 4: A real, small component library — no new UI-framework dependency
`frontend/components/ui/`: `Button`, `Input`, `Textarea`, `Switch`, `Badge`, `Card`, `Table`,
`Dialog`, `EmptyState`, `Skeleton`. Two new dependencies, both small and Next.js-standard:
`lucide-react` (icons) and `sonner` (toast notifications, replacing the raw JSON error/result dumps
found in the audit). No component-variant utility library (e.g. class-variance-authority) — the
handful of components here don't need it; variants are handled with plain conditional class strings.

**`Dialog` uses the native `<dialog>` element**, not a hand-rolled modal or another dependency —
it gives focus trapping, `Escape`-to-close, and backdrop behavior for free, and replaces the native
`confirm()` currently used for trigger deletion (a *styled* dialog, not a *different mechanism*).

**Shape personality**: primary buttons stay pill-shaped (`radius-full`) — this is Signal's visual
identity, confirmed in the approved mockups — but inputs/cards/badges use smaller radii (6–10px).
Not every element is a pill; that was an explicit anti-pattern flagged going in.

## Decision 5: Admin shell uses a sidebar, not a top bar
Mocked up both; user chose the sidebar despite the initial recommendation leaning top-bar (a
2-section nav didn't obviously justify the reserved width). Sidebar holds **Triggers** and a new
**Logs** page (the backend's `GET /api/admin/logs/` already exists with no UI — added as part of
this redesign since the nav needed a second real destination to design against).

## Consequences
- Every subsequent frontend FEAT item (admin shell, admin screens, logs page, website pages)
  builds on these tokens/components rather than introducing new one-off styles.
- The existing hardcoded `font-family: Arial...` in `globals.css` is removed as part of applying
  this system — Geist was already loaded and mapped but never actually took effect.
