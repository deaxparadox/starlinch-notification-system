# FEAT-20260822-2250 — Admin screens redesign

Branch: `feature/ui-redesign` (base: `main`)

## What's being built
Rebuilding the 3 existing admin pages on the component system from FEAT-20260822-2248, inside the
shell from FEAT-20260822-2249. No API/data-flow changes — every `authFetch` call, endpoint, and
piece of state stays exactly as it is; this item is presentation only.

## Current state (verified)
Read all three pages fresh: `admin/page.tsx`, `admin/triggers/new/page.tsx`,
`admin/triggers/[id]/templates/[channel]/page.tsx`. Confirms the audit's findings concretely:
native `confirm()` for delete, raw `<table>`/`<input>`/`<button>` with copy-pasted className
strings, `JSON.stringify(data)` dumped in a `<pre>` for both the test-send result and the
new-trigger error, bare `"Loading…"` text, red/green raw Tailwind colors with no dark-mode variants
on the status text.

## Changes, per page
**`admin/page.tsx`** (the trigger table):
- `Table`/`TableHead`/`TableHeaderCell`/`TableBody`/`TableRow`/`TableCell` from the component
  library replace the raw `<table>`.
- Column headers use `ChannelBadge` (whatsapp/email/webpush colors) instead of plain text — reduces
  wasted repeated scanning per ADR-0002's channel-color-as-identity idea, applied to headers not
  every row (rows themselves show state, not channel — nothing changes there).
- Cells use `StatusBadge` (`success`="Active", `error`="Inactive", `muted`="Not set") instead of a
  plain underlined link — the cell is still a `<Link>` to the editor route, just wrapping a styled
  badge instead of raw underlined text.
- Delete: replaces `confirm()` with the new `Dialog` component (title "Delete trigger?", body names
  the trigger, `Button variant="destructive"` to confirm).
- Empty state (`triggers.length === 0`): `EmptyState` component (inbox icon, "No triggers yet",
  action = a `Button` linking to `/admin/triggers/new`) instead of one line of gray text.
- Loading state: `Skeleton` rows shaped like the eventual table instead of bare "Loading…" text.
- "+ New trigger" becomes a `Button` (was a manually-styled `<Link>`).

**`admin/triggers/new/page.tsx`**:
- `FieldLabel`/`Input`/`Textarea`/`FieldError` replace the raw labeled inputs.
- Submit error: parses the DRF validation error response into a readable message per-field where
  possible (e.g. `key: ["trigger with this key already exists."]` → "key: trigger with this key
  already exists.") instead of dumping raw `JSON.stringify(data)`. Falls back to the generic message
  already in place if parsing fails for any reason - the fallback path is not removed, just no
  longer the only path.
- Submit button → `Button` with its existing `loading`/disabled behavior.

**`admin/triggers/[id]/templates/[channel]/page.tsx`** (the busiest page):
- Toggle checkbox → `Switch` component.
- All fields → `Input`/`Textarea`/`FieldLabel`.
- Save button → `Button`; save result surfaces as a `sonner` toast (`toast.success("Saved")` /
  `toast.error(...)`) instead of inline "Saved."/error text — consistent with how errors are
  surfaced everywhere else in this redesign.
- Test-send result: still shown inline (this is genuinely useful, inspectable data an admin may
  want to read carefully, not a fire-and-forget action better suited to a toast) but formatted
  per-channel instead of raw `JSON.stringify` — e.g. "email: sent" in a `StatusBadge`, or
  "email: failed — POSTMARKAPP_TOKEN not set" with the error text below it, still not raw JSON.
- Loading/error states: `Skeleton` / a styled inline message instead of bare text.

## Design rationale
Nothing here is a new decision — every choice traces back to a component already built and approved
in FEAT-20260822-2248 or a decision already recorded in ADR-0002. This item is applying the system,
not inventing new pieces of it.

## Verification plan
Full real-browser cycle against the real backend, both themes: create a trigger, open a cell, save
a template, toggle it, test-send it (expect a formatted failure, not raw JSON, since no provider
credentials are configured for WhatsApp/Postmark — OneSignal IS configured, so its test-send can be
checked against an actual "sent" result), edit the same cell again (confirm no regression on the
upsert), delete via the new dialog. Confirm the empty state renders correctly after deleting the
only trigger.
