# FEAT-20260823-0453 — Design system v2 foundation

Branch: `feature/design-refresh-v2` (base: `main`)

## What's being built

The token/component foundation for ADR-0003's "Direction D" — everything else in this redesign
(the new Overview page, the admin pages pass, the website pages pass) builds on this, same
relationship the original design system had to the rest of the first redesign.

## Current state (verified)

`frontend/app/globals.css` — the full current token set: warm off-white background (`#faf8f6`),
coral primary (`#ff6b4a`), and a complete independently-tuned dark theme under
`@media (prefers-color-scheme: dark)`. Confirmed no component references Tailwind's `dark:` prefix
directly (`grep -rl "dark:" frontend/app frontend/components` — no matches) — so removing that one
media-query block is the complete, sufficient removal of dark mode, nothing else references it.

`frontend/components/ui/card.tsx` — plain white (`bg-surface`) bordered box, `radius-md` (10px).

`frontend/components/ui/badge.tsx` — `StatusBadge` already uses a soft-tint-bg + saturated-text
pattern (`bg-success-bg text-success`) at `radius-sm` (6px) — closer to Direction D than it looks,
just needs a bigger radius. `ChannelBadge` uses a **solid** fill (`bg-channel-whatsapp
text-channel-whatsapp-foreground`) — this is the one still-solid element to change to match
Direction D's "color as accent, not wash" rule (Decision 1).

## Changes

**`frontend/app/globals.css`**
- Remove the entire `@media (prefers-color-scheme: dark)` block (ADR-0003 Decision 3).
- `--background`: `#faf8f6` → `#ffffff`.
- `--foreground`: → near-black `#0b0b0f` (matches the approved mockups' headline color).
- New `--surface-warm: #f7f5f2` — the neutral rounded-card background used throughout Direction D
  (stat cards, activity rows, table rows). Distinct from `--surface` (still white, used where a
  card needs to stand out against a warm-surface page section).
- `--primary`: `#ff6b4a` (coral) → `#111827` (near-black) — this is what the approved mockups
  actually show for every CTA pill (`+ New trigger`, `View all activity →`); Direction D doesn't
  use a coral accent anywhere. `--primary-hover`/`--primary-active` become adjacent dark shades;
  `--primary-foreground` stays white.
- New `--blob-1..4`: the 4 pastel hues used behind hero sections (`#a78bfa`, `#fca5a5`, `#93c5fd`,
  `#fde68a`), so `GradientHero` (below) reads them from tokens instead of hardcoded hex.
- `--radius-lg` stays 16px, now the default for `Card` (was `radius-md`) — Direction D's cards
  read visibly rounder than ADR-2's.
- Channel colors (`--channel-whatsapp` etc.) are unchanged in hue — only how `ChannelBadge`
  *applies* them changes (see below), not the colors themselves.

**`frontend/components/ui/card.tsx`** — default background becomes `bg-surface-warm`,
`rounded-radius-lg` (was `rounded-radius-md`), border removed (Direction D cards use spacing/bg
contrast, not borders, to separate from the page).

**`frontend/components/ui/badge.tsx`**
- `StatusBadge`: `rounded-radius-sm` → `rounded-radius-full` (pill). Colors unchanged — the
  soft-bg-plus-saturated-text pattern already matches Direction D.
- `ChannelBadge`: switches from solid fill to the same soft-bg/saturated-text pattern as
  `StatusBadge`, `rounded-radius-full`. Needs 3 new soft-bg token pairs (e.g.
  `--channel-whatsapp-bg`/`--channel-email-bg`/`--channel-webpush-bg`, light tints of the existing
  hues) since the current tokens are solid-fill-only.

**New: `frontend/components/ui/gradient-hero.tsx`** — the one genuinely new component. Renders 3–4
absolutely-positioned, heavily blurred circles (reading `--blob-1..4`) behind a `children` slot,
with a `size: "full" | "reduced"` prop controlling blob size/opacity and container padding per
ADR-0003 Decision 2 (full hero = Overview/home; reduced = every other admin page). This is the one
shared piece every later item in this redesign (Overview, admin pages pass, website pages pass)
will import — building it once here instead of each page reinventing the blob markup.

## Out of scope

- The Overview page itself, the stats endpoint, and the actual page-by-page redesign — those are
  FEAT-20260823-0454/0455/0456/0457. This item only ships the tokens + `Card`/`Badge` updates +
  the new `GradientHero` component, verified in isolation (e.g. a throwaway test render), not wired
  into real pages yet.
- Typography doesn't get new tokens — Tailwind's existing size scale (`text-3xl`, `text-4xl`,
  `font-extrabold`) already covers what the mockups need; adding indirection here would be
  unnecessary per the project's existing minimalism.

## Verification plan

`npm run build` (or `next lint`) passes with no type errors after the token/component changes.
Render `GradientHero` in both `size` variants against a plain page in the dev server and visually
confirm it matches the approved mockups (blob softness, position, opacity) before any real page
depends on it.
