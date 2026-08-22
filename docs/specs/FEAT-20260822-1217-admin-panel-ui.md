# FEAT-20260822-1217 — Admin panel UI

Branch: `main` (base: `main`)

## What's being built
The actual admin screen from the assignment doc: one table, rows = triggers, columns =
WhatsApp/Email/Web Push, each cell showing that channel's state with create/edit/toggle/test-send
actions — backed entirely by the already-built and verified admin API (FEAT-20260822-1214).

## Current state (verified)
`app/(admin)/admin/page.tsx` is a placeholder behind the already-working auth guard
(FEAT-20260822-1215). `app/unauthorized/page.tsx` already exists and works — nothing to build for
that part of this item's original description, it's already done. Backend: `GET/POST
/api/admin/triggers/`, `PATCH/DELETE /api/admin/triggers/{id}/`, upsert/toggle/test-send on
`/api/admin/triggers/{id}/templates/{channel}/...`, all `IsAdminUser`-protected and verified via
curl in FEAT-20260822-1214.

## URL-routing (continuing the directive from FEAT-20260822-1215/1216)
Per the user's explicit instruction, the template editor is its OWN route, not a modal driven by
local component state:
- `/admin` — the table itself. Reads `GET /api/admin/triggers/`. Each cell links to
  `/admin/triggers/[id]/templates/[channel]` and shows a quick-glance state (no template / active /
  inactive) without needing to open it.
- `/admin/triggers/new` — a real route for creating a trigger (key, display name, description),
  not an inline form or modal on the table page. Submits `POST /api/admin/triggers/`, redirects to
  `/admin` on success.
- `/admin/triggers/[id]/templates/[channel]` — the cell editor. One route handles both "create"
  (cell has no template yet) and "edit" (cell already has one) since the backend endpoint is
  already an upsert — the page just pre-fills the form if data comes back, empty otherwise. Channel-
  appropriate fields: `subject`/`body` for email/webpush, `wa_template_name`/`wa_language_code`/
  `wa_variable_mapping` for whatsapp. Includes the on/off toggle and a test-send box (recipient +
  button, shows the result inline) — all three admin actions for a cell (per the assignment's
  "Create, edit, test send, and turn channels on/off from the admin panel") live on this one route,
  matching how the assignment doc describes a "cell", not split across further routes.
- Deleting a trigger row is a button directly on the `/admin` table (confirm, then
  `DELETE /api/admin/triggers/{id}/`, refetch) — not significant enough UI state to need its own
  route.

## Design rationale
- **One route per screen, not per micro-action**: toggling/test-sending within the already-open
  cell editor are treated as actions on that screen (they don't change what conceptual "place" the
  admin is at), consistent with the directive being about navigable screens/states, not literally
  every button.
- **Reuses `lib/types.ts` (`Trigger`, `Template`, `Channel`)** from FEAT-20260822-1215 — already
  mirrors the DRF serializers exactly, including the "all 3 channel keys, null if missing" shape.
- **`authFetch` from `lib/auth.tsx`** for every admin API call — same 401-retry/403 handling as the
  rest of the app, no separate fetch logic for this item.
- Data is fetched client-side on each page (no server components fetching with the access token,
  since the token deliberately lives only in client-side React state per ADR-0001).

## Verification plan
Manually exercise the full cycle in a real browser against the real backend as `testadmin`: create a
trigger, open a cell, save a template, toggle it on, test-send it (expect a logged, visible failure
since no sandbox provider credentials exist yet — that's correct, not a bug), edit the same cell
again (confirm no duplicate/`IntegrityError`), delete the trigger. Confirm a non-staff user still
gets bounced to `/unauthorized` before seeing any of this (already covered by FEAT-20260822-1215's
guard, just re-confirming it still holds with real content behind it).
