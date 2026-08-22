# BUG-20260823-0403 — Web Push only ever notifies one device per user

Branch: `main` (base: `main`)

## What's broken

Reported by the user testing across Windows, Linux, and mobile: no matter which device logs in,
only one specific device (Linux, in their test) ever receives the Web Push notification. Opening
and logging in from mobile still shows the notification on the Linux machine.

## Root cause (verified by reading the code, not assumed)

`backend/notifications/services.py:133-145`, `_resolve_recipient()`:

```python
if channel == "webpush":
    sub = user.pushsubscription_set.first()
    return sub.onesignal_player_id if sub else ""
```

A `PushSubscription` row is created per device/browser that subscribes (confirmed in
`backend/notifications/models.py:55-58` — plain `ForeignKey` to `User`, no uniqueness constraint
tying a user to a single row), so a user can genuinely have many. But this function only ever
returns one of them, via `.first()`. Django orders an unordered `.first()` queryset by primary
key to make it deterministic — so this always resolves to whichever device subscribed *first ever*
for that account, and keeps returning that same one on every future call, regardless of which
device actually performed the login. Every other subscribed device is silently never notified.

Ruled out as the cause (verified against OneSignal's current Web SDK docs via context7, not
memory): `frontend/lib/onesignal.ts`'s use of `OneSignal.User.PushSubscription.id` — this is
documented as "uniquely identif[ying] a specific browser's push channel," i.e. genuinely
per-device, not a person-level ID shared across a user's devices. The frontend is sending the
right value; the backend is just discarding all but one of them.

**Lateral check (Module 6):** email and WhatsApp don't have this problem — `User` has exactly one
`email` and one `phone_number` field each, no one-to-many relationship like `PushSubscription`
has. This bug is specific to web push's device-fan-out shape.

## Fix

A login/logout notification means "notify the account," not "notify one arbitrary device" — so
web push should send to every one of a user's currently subscribed devices.

- `_resolve_recipient()` returns a `list[str]` instead of a single `str`. For `email`/`whatsapp`
  it's a 0-or-1-item list (unchanged behavior, just a different return shape). For `webpush` it's
  every active `PushSubscription.onesignal_player_id` for that user (0, 1, or many).
- `_send_one()` loops over that recipient list: one `adapter.send()` call and one
  `NotificationLog` row per recipient, exactly like today's single-recipient logging — no
  `NotificationLog` schema change needed. `NotificationPort.send()`'s signature
  (`recipient: str`) is unchanged; the fan-out happens one layer above the adapter, not inside it.
- Chose one-call-per-device over batching all subscription ids into a single OneSignal API call
  (which OneSignal's API does support) so that a single stale/invalid device shows up as its own
  failed log row, instead of being invisible inside an all-succeeded/all-failed batch result.
  Confirmed with the user this is the intended tradeoff before writing this spec.
- `fire_trigger()`'s per-channel result (`results[template.channel]`) becomes an aggregate: sent
  if at least one recipient succeeded, failed only if every recipient failed (or there were none)
  — matches how a human would read "did the login notification go out."

## Out of scope

- Deduplicating subscriptions if the same device somehow re-subscribes with a new player_id
  (OneSignal's own SDK handles reuse on the same browser install already; not something this bug
  touches).
- Any change to email/WhatsApp sending — they're single-recipient by data model, not by this bug.

## Verification plan

Locally via `docker compose`, using the real OneSignal sandbox credentials already configured:
create 2+ `PushSubscription` rows for the same test user (two different browser contexts), fire
the `login` trigger, and confirm both devices receive a real push notification and both get their
own `NotificationLog` row. Confirm a user with zero subscriptions still logs a single clean
"failed / no recipient" row (unchanged from today), not one per non-existent device.
