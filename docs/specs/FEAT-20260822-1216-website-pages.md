# FEAT-20260822-1216 — Website pages

Branch: `main` (base: `main`)

## What's being built
The real login/logout pages (placeholders exist from FEAT-20260822-1215), the home page showing
auth state, and the post-login OneSignal Web Push subscribe flow — including the one backend
endpoint this needs (`POST /api/webpush/subscribe/`) that wasn't built with the rest of the admin
API since it's tightly coupled to this frontend flow (per FEAT-20260822-1214's spec).

## Current state (verified)
`frontend/lib/auth.tsx` has `useAuth()` with `login()`, `logout()`, `status`, `user`.
`frontend/app/login/page.tsx` and `frontend/app/(website)/page.tsx` are placeholders. No
`PushSubscription`-related view/endpoint exists yet — only the model (FEAT-20260822-1213).
`notifications/models.py` has `PushSubscription(user, onesignal_player_id)`.

## Provider specifics verified against current docs (not memory)
OneSignal Web SDK v16 (current): load `https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js`,
queue calls via `window.OneSignalDeferred.push(async (OneSignal) => { ... })` until the SDK is
ready, `await OneSignal.init({ appId })`, prompt via
`await OneSignal.Notifications.requestPermission()`, read the subscription id via
`OneSignal.User.PushSubscription.id`.

## URL-routing (continuing FEAT-20260822-1215's directive)
- `/login` — real route, real form. Already exists as a placeholder; gets real content.
- `/logout` — a real route, not a button-only action with no URL. Visiting it (via a `<Link
  href="/logout">`) performs the logout call, fires the `logout` trigger server-side, and redirects
  to `/`. This mirrors `/login`'s treatment and keeps "just logged out" a real navigable state.
- `/` (website home) — shows the current auth state (logged in vs not) and links to `/login` or
  `/logout` accordingly. No content swap disguised as the same "state" — the link always points at
  a real destination route.
- If an already-authenticated user visits `/login`, redirect to `/` (nothing to do there).

## Backend addition: `POST /api/webpush/subscribe/`
- `notifications/views.py`: `PushSubscriptionView(APIView)`, `permission_classes = [IsAuthenticated]`
  (any logged-in user, not staff-only — this is not an admin endpoint).
- Body: `{"onesignal_player_id": "..."}`. Uses
  `PushSubscription.objects.update_or_create(onesignal_player_id=player_id, defaults={"user": request.user})`
  — `update_or_create` (not `get_or_create`) because the field is globally unique; if the same
  browser/subscription ID was previously tied to a different user (e.g. someone else logged in on
  the same browser earlier), it gets reassigned to whoever is subscribing now, matching "this
  browser's push subscription belongs to whoever is currently logged in."
- URL wired directly in `config/urls.py` (`path("api/webpush/subscribe/", ...)`), not under
  `/api/admin/` — this is a regular-user endpoint, unrelated to `notifications.urls`'s admin prefix.

## Design rationale
- **Subscribe only after login succeeds**, never on anonymous page load — the `player_id` has no
  `user` to attach to otherwise (ADR-0001 context, architecture-flows.md Flow 3). Concretely: the
  OneSignal SDK `<Script>` tag loads globally (harmless, no-op without a prompt), but
  `requestPermission()` is only called from the login page's post-`login()`-success handler.
- **Best-effort, non-blocking**: if `NEXT_PUBLIC_ONESIGNAL_APP_ID` is unset (not configured yet) or
  the subscribe call fails for any reason, log it and continue to `/` anyway — a failed push
  subscription must never block a successful login, mirroring `fire_trigger()`'s own
  never-block guarantee on the backend.
- **Login form errors**: invalid credentials shown inline on `/login` (from `login()`'s thrown
  `Error`), not a redirect or a generic crash.

## Verification plan
Real login with `testadmin` redirects to `/`, home page reflects logged-in state; `/logout` link
fires the actual logout call (verified via `NotificationLog` row appearing for the `logout`
trigger key) and returns to `/` showing logged-out state. `POST /api/webpush/subscribe/` tested via
curl with a fake player id string (no real OneSignal account exists yet) to confirm the row is
created/reassigned correctly and requires authentication.
