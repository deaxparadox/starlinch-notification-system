# FEAT-20260823-0454 — Backend stats endpoint

Branch: `feature/design-refresh-v2` (base: `main`)

## What's being built

`GET /api/admin/stats/` — the real data FEAT-20260823-0455's Overview page needs. Doesn't exist
today.

## Current state (verified)

`backend/notifications/views.py` has `NotificationLogListView` (list + filter by
trigger/channel/status, no aggregation) and no endpoint that returns counts. `NotificationLog` has
`status` (`sent`/`failed`), `is_test`, `created_at`. `Trigger` has `is_active`. All existing admin
endpoints use `IsAdminUser` and live in `backend/notifications/urls.py` under `/api/admin/`.

## Response shape

```json
{
  "sent_today": 128,
  "failed_today": 3,
  "active_triggers": 2,
  "total_triggers": 2,
  "recent": [ /* up to 5 NotificationLogSerializer rows, most recent first */ ]
}
```

- "Today" = `timezone.localdate()`, filtered on `created_at__date`, using Django's configured
  timezone rather than naive UTC-vs-server-clock assumptions.
- **`is_test=True` rows are excluded from all 4 counts and from `recent`.** A test-send is an
  admin clicking "test" in the template editor, not a real notification — counting those would
  make the Overview page lie about real activity. This wasn't explicit in ADR-0003 but is a direct
  consequence of what "today's real activity" has to mean; treating it as obvious rather than
  logging a separate item for it.
- `recent` reuses the existing `NotificationLogSerializer` unchanged — no new serializer needed.

## Changes

- New `StatsView(APIView)` in `backend/notifications/views.py`, `IsAdminUser`, single `get()`.
- New route `path("stats/", StatsView.as_view(), name="admin-stats")` in
  `backend/notifications/urls.py`.

## Out of scope

- No date-range filtering, no per-channel breakdown — the approved mockup only shows today's
  sent/failed totals and an active-trigger count; adding more than that isn't asked for.
- No caching — this is a small aggregate query against a table with no real production data
  volume yet; add caching later only if it's ever actually slow.

## Verification plan

Against the real local `docker-compose` backend: confirm the endpoint requires admin auth (401/403
for anonymous/non-staff), and confirm the numbers it returns actually match what's in the database
for a known test user/day (create a couple of real `NotificationLog` rows including one `is_test`
row, confirm the test row is excluded from every count, then clean up).
