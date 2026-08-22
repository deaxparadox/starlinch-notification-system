# FEAT-20260822-2248 — Design system foundation

Branch: `feature/ui-redesign` (base: `main`)

## What's being built
The token layer and shared component library that every subsequent redesign item (admin shell,
admin screens, logs page, website pages) will be built from. No page content changes yet.

## Current state (verified)
Read `frontend/app/globals.css`, `frontend/app/layout.tsx`, `frontend/package.json` before writing
this spec. Tailwind v4 (`@theme` CSS-first config, confirmed — not a `tailwind.config.js`). Geist
Sans/Mono already loaded via `next/font/google` in `layout.tsx` and mapped to `--font-sans`/
`--font-mono` in `@theme inline`, but `globals.css`'s `body` rule hardcodes
`font-family: Arial, Helvetica, sans-serif`, so Geist has never actually rendered anywhere — a real
bug being fixed here, not a rewrite for its own sake. Only 2 CSS variables exist today
(`--background`, `--foreground`); no other tokens, no component files exist under `components/`
except `OneSignalInit.tsx`.

## Design rationale
See [ADR-0002](../adr/0002-frontend-design-system.md) for the visual-direction and architecture
decisions (Signal palette, independently-tuned themes, CSS-variable tokens, native `<dialog>`,
no component-variant library). This spec covers implementation specifics only.

## Token additions to `globals.css`
Extend the existing `:root` / `@media (prefers-color-scheme: dark)` / `@theme inline` pattern —
same mechanism already there for `--background`/`--foreground`, just a full token set:

```
--background, --surface, --surface-elevated, --surface-muted
--foreground, --foreground-secondary, --foreground-muted
--primary, --primary-hover, --primary-active, --primary-foreground
--border, --border-subtle, --border-strong
--success, --success-bg, --warning, --warning-bg, --error, --error-bg, --info, --info-bg
--channel-whatsapp, --channel-whatsapp-foreground
--channel-email, --channel-email-foreground
--channel-webpush, --channel-webpush-foreground
--focus
--radius-sm, --radius-md, --radius-lg, --radius-full
```

Exact values per theme are ADR-0002's token table. `@theme inline` maps each to a `--color-*` (or
`--radius-*`) name so plain Tailwind utilities work: `bg-primary`, `text-channel-email`,
`border-error`, `rounded-radius-md`, etc. `body`'s hardcoded `font-family` is replaced with
`font-family: var(--font-sans)`.

## New dependencies
- `lucide-react` — icons.
- `sonner` — toast notifications. `<Toaster />` mounted once in `app/layout.tsx`, theme-aware
  (reads the same `prefers-color-scheme` the rest of the app does).

## Components (`frontend/components/ui/`)
- **`button.tsx`** — variants `primary` (pill, coral fill), `secondary` (outline), `destructive`
  (error-toned), `ghost` (text-only); sizes `sm`/`md`. Disabled + loading states (spinner replaces
  label, per the audit's "Logging in..." pattern already used on the login page — generalized here).
- **`input.tsx` / `textarea.tsx`** — consistent border/radius/focus-ring (using `--focus` token),
  error state (red border + adjacent message, not color-only per accessibility).
- **`switch.tsx`** — `role="switch"` `aria-checked` button with a track+thumb, replaces the raw
  `<input type="checkbox">` toggle on the template editor.
- **`badge.tsx`** — `variant="status"` (success/warning/error/muted, for Active/Inactive/Not set)
  and `variant="channel"` (whatsapp/email/webpush, fixed colors per ADR-0002).
- **`card.tsx`** — surface + border + radius-md wrapper; used sparingly per the brief's
  no-cards-inside-cards guidance.
- **`table.tsx`** — styled wrapper (header weight, row hover, border rhythm) around plain
  `<table>` — not a data-grid abstraction, this app's tables are small and simple.
- **`dialog.tsx`** — wraps native `<dialog>` (`showModal()`/`close()`), styled per the token system.
  First use: replacing `admin/page.tsx`'s `confirm()` for trigger deletion.
- **`empty-state.tsx`** — icon + heading + short explanation + optional action, for the "no triggers
  yet" case and similar.
- **`skeleton.tsx`** — pulsing placeholder block, replacing bare "Loading…"/"Checking access…" text.

## Verification plan
`npm run build` and `npm run lint` clean. A throwaway `/admin` (already existing placeholder-ish
page) temporarily renders one of each new component to visually confirm tokens/components work in
both themes (light/dark, via OS-level toggle or browser devtools emulation) before the next item
(admin shell) starts consuming them for real. Removed once the next item lands real usage.
