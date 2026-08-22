# FEAT-20260822-1213 — Notifications core

Branch: `main` (base: `main`)

## What's being built
The actual notification engine: the DB models the admin table will map onto, the 3 provider
adapters, and the `fire_trigger()` service that sends on every active channel for a trigger without
ever blocking or breaking the caller. Plus wiring `fire_trigger("login", ...)` /
`fire_trigger("logout", ...)` into the existing auth views, since that's the only way to actually
exercise and verify this layer end to end.

Not in this item: any admin-facing HTTP endpoint to create/edit triggers or templates (that's
FEAT-20260822-1214) — triggers/templates for this item's verification are created directly via
Django shell/fixtures, not through an API.

## Current state (verified)
Read `backend/config/settings.py` and `backend/accounts/` before writing this spec:
- `accounts` app has `User` (custom, `AUTH_USER_MODEL`), JWT login/logout/refresh views. Login
  currently does auth only — no trigger fire yet. `INSTALLED_APPS`, `AUTH_USER_MODEL` already set.
- No `notifications` app exists yet. Nothing to migrate away from.

## Design rationale
Carries forward [ADR-0001](../adr/0001-notification-sending-architecture.md) in full: synchronous
`ThreadPoolExecutor` send (Decision 1), scoped ports & adapters (Decision 2), event-only triggers
(Decision 3 — only `login`/`logout` will exist as `Trigger` rows). The DB schema and the
`fire_trigger()`/`_send_one()` code are taken verbatim from the earlier verified design
(`docs/assignment/claude-discuss-files/scratchpad.md` sections 8 and 13) — that draft already fixed
the exception-inside-except bug, the redundant outer timeout, and the missing test-send-recipient
override, so there's no reason to re-derive it.

**Deviation from the original folder sketch:** the original discussion docs list a separate
`website` app for "demo trigger call sites (login/logout views)," distinct from `accounts`' auth
views. Since login/logout in this assignment IS the auth action — there's no separate "website
login page hits a different endpoint than the auth system" — a second app would just duplicate the
existing `accounts` login/logout views. `fire_trigger()` calls go directly into
`accounts/views.py`'s existing `LoginView`/`LogoutView`. No `website` app is created.

**Provider specifics verified against current docs (not memory) before writing adapters:**
- **WhatsApp Cloud API**: `POST https://graph.facebook.com/{WHATSAPP_API_VERSION}/{PHONE_NUMBER_ID}/messages`,
  header `Authorization: Bearer {WHATSAPP_ACCESS_TOKEN}`, body:
  `{"messaging_product": "whatsapp", "recipient_type": "individual", "to": recipient, "type": "template", "template": {"name": ..., "language": {"code": ...}, "components": [{"type": "body", "parameters": [{"type": "text", "text": v} for v in variables]}]}}`.
- **Postmark**: `POST https://api.postmarkapp.com/email`, header `X-Postmark-Server-Token: {POSTMARKAPP_TOKEN}`,
  body `{"From": POSTMARK_FROM_EMAIL, "To": recipient, "Subject": subject, "HtmlBody": body, "TextBody": body}`
  (both Html/Text bodies sent for client compatibility, per Postmark's own docs).
- **OneSignal**: `POST https://onesignal.com/api/v1/notifications`, header
  `Authorization: Key {ONESIGNAL_REST_API_KEY}`, body
  `{"app_id": ONESIGNAL_APP_ID, "include_subscription_ids": [recipient], "headings": {"en": subject_or_title}, "contents": {"en": body}}`.
  Note: the `PushSubscription.onesignal_player_id` model field keeps its name from the original
  schema decision, but its value is sent as a `include_subscription_ids` entry — OneSignal renamed
  "player_id" to "subscription_id" at the API level; same concept.

**Provider credentials are not fail-fast at Django startup.** Unlike `DJANGO_SECRET_KEY`/
`DATABASE_URL` (required for the server itself to run), `WHATSAPP_ACCESS_TOKEN`,
`POSTMARKAPP_TOKEN`, `ONESIGNAL_REST_API_KEY`, etc. are required only for a *send* to succeed — the
admin panel, trigger/template CRUD, and the rest of the site must work with zero sandbox accounts
configured yet (confirmed: none are set up yet). Each adapter reads its own config at call time and
raises a clear, descriptive exception if unset; `_send_one()`'s existing try/except turns that into
a normal logged `NotificationLog` failure, per `fire_trigger()`'s "never throw" guarantee. This *is*
the visible, explicit fallback Module 4 requires — a loud logged failure, not a silent no-op.

## DB schema (`notifications/models.py`)
`Trigger`, `Template` (`unique_together = ("trigger", "channel")`), `NotificationLog`,
`PushSubscription` — exact fields as in scratchpad.md section 8, unchanged.

## Ports & adapters
- `notifications/ports.py`: `NotificationPort` ABC (`send(*, recipient, message) -> dict`),
  `RenderedMessage` dataclass.
- `notifications/adapters/whatsapp_adapter.py`, `postmark_adapter.py`, `onesignal_adapter.py`: one
  class each, `requests.post(..., timeout=8)`, raises on non-2xx (caught by `_send_one`).

## Service layer (`notifications/services.py`)
`fire_trigger()`, `_send_one()`, `_log()`, `_render()`, `_resolve_recipient()`,
`CHANNEL_ADAPTERS` — the exact code from scratchpad.md section 13 (`ThreadPoolExecutor(max_workers=3)`,
no outer timeout, `close_old_connections()` before the DB write, send/log in separate try blocks,
`override_recipient`/`override_channel` params for the future test-send endpoint).

## Wiring
- `accounts/views.py` `LoginView`: after successful auth, call
  `fire_trigger("login", user=user, context={"name": user.first_name or user.username})` — never
  lets a notification failure affect the login response.
- `accounts/views.py` `LogoutView`: call `fire_trigger("logout", user=user, context={...})` — only
  when `request.user.is_authenticated` (logout is `AllowAny` and may be called with no valid access
  token; nothing to notify if there's no identified user).

## Verification plan
Since there's no admin API yet, verification is via Django shell: create a `Trigger(key="login")`
with `Template` rows using a `FakeAdapter` swapped into `CHANNEL_ADAPTERS` for the test, confirming
`fire_trigger()` calls the right adapters, writes `NotificationLog` rows, and never raises even when
an adapter raises. Then hit `POST /api/auth/login/` for real and confirm `NotificationLog` rows
appear (adapters will fail with "not configured" errors, logged as `status="failed"` — expected,
since no sandbox credentials exist yet).
