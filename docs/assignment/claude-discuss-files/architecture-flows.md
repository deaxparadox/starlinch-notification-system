# Connected Architecture — Flow Verification & Failure Analysis

Purpose: the main scratchpad.md records WHAT we decided and WHY, one decision at a time. This
document traces HOW those decisions actually connect when a real request moves through the whole
system — verifying each handoff between services, and finding where the chain can break.

Method: for each flow, walk it hop-by-hop (Browser -> Vercel -> Render -> Postgres -> external
provider -> back). At each hop, ask: what data crosses this boundary, in what shape, over what
protocol, and what happens if this hop fails. Do not assume a boundary works just because both
sides were separately designed correctly.

---

## 0. System map (who talks to whom)

```
┌─────────────┐        HTTPS/JSON+JWT        ┌──────────────────┐
│   Browser    │ ───────────────────────────► │  Next.js (Vercel) │
│ (end user or │ ◄─────────────────────────── │  - (website)       │
│  admin)      │                               │  - (admin)         │
└──────┬───────┘                               └─────────┬──────────┘
       │ Web Push subscribe                               │ HTTPS/JSON+JWT
       │ (browser-native, NOT via Vercel)                 ▼
       │                                        ┌──────────────────┐
       │                                        │  Django (Render)  │
       │                                        │  - auth views     │
       │                                        │  - admin API      │
       │                                        │  - fire_trigger()  │
       │                                        └───┬────┬────┬─────┘
       │                                            │    │    │
       │                            ┌───────────────┘    │    └────────────────┐
       │                            ▼                    ▼                     ▼
       │                    ┌──────────────┐   ┌──────────────────┐  ┌──────────────────┐
       │                    │  Postgres     │   │  WhatsApp Cloud   │  │  Postmark          │
       │                    │  (Render)     │   │  API (Meta)        │  │  (email)            │
       │                    └──────────────┘   └──────────────────┘  └──────────────────┘
       │                                                                          
       └──────────────────────────────────────────────────► OneSignal (REST send + subscribe)
```

Five independently-deployed/operated systems: Vercel, Render (Django), Render Postgres, and three
external providers (Meta, Postmark, OneSignal). Every arrow above is a place things can fail
independently of the others — that independence is the actual source of most of the risk below.

---

## Flow 1: User logs in on the website → notifications fire

### Hop-by-hop trace

1. **Browser → Next.js (Vercel)**: user submits login form on `(website)/login/page.tsx`.
   Client-side fetch via `lib/api-client.ts` to `POST {NEXT_PUBLIC_API_URL}/api/auth/login/` with
   `{username, password}`.

2. **Next.js → Django (Render)**: cross-origin request — Vercel's domain calling Render's domain.
   Requires `CORS_ALLOWED_ORIGINS` (comma-separated env var, split in Django settings) to include
   the exact Vercel URL + localhost for dev, plus `CORS_ALLOW_CREDENTIALS = True` since the refresh
   token travels as an httpOnly cookie (see step 6). See Issue #1 for what happens if this is missed.

3. **Django: authenticate** — validates credentials against `accounts.User`. On success, issues an
   access token (returned in the JSON body) and sets a refresh token as an httpOnly cookie (section
   6). This part is self-contained, no external dependency.

4. **Django: fire_trigger("login", user=user, context={...})** — called synchronously, INSIDE the
   same request-response cycle, BEFORE the response is returned to the browser. This is the crux of
   the whole sync-send design (section 2): the login HTTP response is now coupled to the completion
   of the ThreadPoolExecutor batch.
   - `Trigger.objects.get(key="login", is_active=True)` — DB read on Render Postgres. Same-region
     as Django on Render, low latency, not a real risk.
   - For each active Template (whatsapp/email/webpush), `ThreadPoolExecutor` fires 3 threads:
     - **WhatsApp thread** → `WhatsAppCloudAdapter.send()` → outbound HTTPS to
       `graph.facebook.com`. Real network hop, real external latency, real failure surface.
     - **Email thread** → `PostmarkEmailAdapter.send()` → outbound HTTPS to `api.postmarkapp.com`.
     - **WebPush thread** → `OneSignalWebPushAdapter.send()` → outbound HTTPS to
       `onesignal.com/api/v1/notifications`.
   - Each thread's result (success/failure) written to `NotificationLog` — DB write on Postgres,
     preceded by `close_old_connections()` since this write happens on a background thread, not the
     main request thread.
   - No outer `as_completed(timeout=...)` — each adapter's own `requests` call is capped at 8s, which
     is already the real, sufficient bound (see Issue #3/#4 resolution below for why an outer timeout
     was removed rather than tuned).

5. **Django → Next.js**: HTTP response `{access_token, user}` returned (+ refresh cookie set) ONLY
   after step 4 completes. Worst case ~8s if a provider call hangs near its own timeout. **This is
   the actual, measurable cost of the sync design** — not theoretical, and the frontend needs an
   explicit loading state to communicate it (section 15).

6. **Next.js → Browser**: access token kept in memory (React state/context, never persisted);
   refresh token already arrived as an httpOnly cookie set directly by Django in step 3 — Next.js
   never touches it directly. Redirect based on `is_staff` claim (section 11).

### Issues found in this flow

Issues #1-#4 were found by this trace. All four are now resolved — see the **Resolution log**
section near the end of this document for the final fix applied to each. Summary: #1 CORS (env-var
driven, now in section 11 of scratchpad.md), #2 JWT storage (access in-memory + refresh httpOnly
cookie, section 6), #3 outer timeout was solving the wrong problem and was removed rather than tuned,
#4 exception-inside-except bug in `_send_one` (fixed with separated try blocks, section 13's final
code).

---

## Flow 2: Admin creates a Trigger + fills in a Template cell

1. **Browser → Next.js (admin)**: admin panel calls `POST /api/admin/triggers/` then
   `PATCH /api/admin/triggers/{id}/templates/{channel}/` (upsert, scratchpad section 11).
2. **Next.js → Django**: same CORS + auth-token concerns as Flow 1, PLUS the `IsAdminUser` check
   (scratchpad section 11) — resolved by Issue #5 (see Resolution log): `createsuperuser` sets
   `is_staff=True` automatically and works fine with the custom User model, no extra setup needed.
3. **Django → Postgres**: row create/update. `unique_together = ("trigger", "channel")` means the
   PATCH endpoint must use `get_or_create` (then update), not plain `create()` — plain create on a
   second save to the same cell throws `IntegrityError`. Flag for Claude Code: the endpoint spec says
   "upsert" in prose (scratchpad section 11); make sure the actual DRF view implements it that way.
4. **Django → Next.js → Browser**: updated Trigger (all 3 channel keys per the serializer decision)
   returned, table re-renders.

### Issues found

Issues #5 and #6 were found by this trace — see Resolution log. #5: no defined path existed to
create the first admin account (resolved — standard `createsuperuser`, documented in README). #6: a
narrow toggle-mid-flight race condition, deliberately not fixed (not worth it for a 2-day
assignment, documented rather than silently ignored).

---

## Flow 3: Browser subscribes to Web Push

This flow is structurally different from the other two — it involves a THIRD party talking directly
to the browser (OneSignal's SDK), not just Vercel↔Render.

1. **Browser**: OneSignal Web SDK (loaded client-side in Next.js) prompts for notification
   permission — browser-native permission dialog, not controlled by either Vercel or Django.
2. **Browser ↔ OneSignal directly**: SDK registers the browser with OneSignal's own infrastructure
   (NOT via your Django backend at all) — this is a direct browser-to-OneSignal relationship. SDK
   receives a `player_id` (subscription ID) back from OneSignal.
3. **Browser → Next.js → Django**: `player_id` is THEN sent to your `POST /api/webpush/subscribe/`
   (section 10) so Django can store it in `PushSubscription`, tied to the logged-in `user`.
4. **VERIFY**: this means subscribe only works for an AUTHENTICATED user (JWT required to hit
   `/api/webpush/subscribe/`, per the endpoint's implied auth). **Ordering matters**: if a user
   subscribes to push BEFORE logging in (e.g. on first site visit, prompted immediately), the
   `player_id` exists in OneSignal but has nowhere to be stored in Django yet (no `user` to attach
   it to). This is a real ordering dependency not previously traced.
**Solution**: the frontend must only trigger the OneSignal subscribe prompt (or at least only POST
the resulting player_id to Django) AFTER login succeeds — i.e., call the OneSignal SDK subscribe flow
from inside the post-login success handler, not on initial page load for anonymous visitors.
**Concrete sequencing requirement for Claude Code**: subscribe-prompt trigger point = after
successful login, not on app mount.

---

## Flow 4: Full "Test Send" from admin panel (Task A/B/C)

1. Admin clicks "Test send" on a specific Template cell → `POST
   /api/admin/triggers/{id}/templates/{channel}/test-send/` with `{recipient: "...", is_test: true}`
   (scratchpad section 11).
2. This is Issue #7 — see Resolution log. Original `fire_trigger()` signature only derived recipients
   from a real `User` object, which doesn't fit "admin types an arbitrary phone/email into the UI."
   Fixed with an `override_recipient` param (final code in scratchpad section 13) that bypasses
   `_resolve_recipient` entirely when present — the test-send endpoint always passes it, the real
   trigger flow never does.

---

## Resolution log (post-review discussion with user)

**Issue #1 (CORS)** — CONFIRMED. `CORS_ALLOWED_ORIGINS` as a comma-separated env var, split in
Django settings: `os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",")`. User will populate the
actual Vercel URL in `.env` during development.

**Issue #2 (JWT storage)** — RESOLVED, and it's the correct industry pattern, not just "acceptable
for an assignment": **access token in memory (React state/context, never persisted — gone on
refresh, so XSS can't steal a persisted copy) + refresh token in an httpOnly cookie** (unreadable by
JS at all, browser sends it automatically). Requires `CORS_ALLOW_CREDENTIALS = True` on Django +
`credentials: "include"` on frontend fetches + correct `SameSite`/`Secure` cookie flags for the
cross-domain Vercel<->Render setup. This is genuinely better than the earlier "localStorage is fine
for a demo" framing — locking in as the real approach, not a simplification.

**Issues #3 and #4 (timeout tuning / sequential send+log) — CORRECTED, same underlying fix:**
- Traced precisely what `as_completed(timeout=...)` actually does: it does NOT cancel/kill the
  underlying thread when it times out (Python's concurrent.futures has no mechanism to force-kill a
  running thread) — it only stops Django from WAITING on it. The thread keeps running regardless
  until its own internal work finishes or times out. So "lowering the timeout to 5s" (originally
  proposed in Issue #3's fix) does not reduce actual work done — it just makes Django hand back the
  HTTP response sooner while the thread keeps running in the background, which INCREASES the chance
  of an orphaned thread outliving the request/response cycle. That earlier recommendation was wrong
  and is retracted.
- User correctly rejected a follow-up proposal (daemon threads + per-thread new DB connections) as
  unsafe at scale (hundreds/thousands of concurrent requests spawning independent DB connections).
- **ACTUAL FIX**: each adapter's own `requests.post(..., timeout=8)` is ALREADY a sufficient, real
  bound — every thread finishes within ~8s on its own regardless of what fire_trigger()'s outer
  logic does. No separate outer `as_completed(timeout=...)` is needed or should be tuned — it was
  redundant with a bound that already existed at the adapter level. REMOVE the outer timeout
  entirely; just call `future.result()` per future without an artificial outer deadline.
- For the DB-write-after-response-returned edge case: use Django's standard `close_old_connections()`
  (from `django.db`) at the start of each thread's DB write (inside `_send_one`, before
  `NotificationLog.objects.create()`) — Django's own recommended pattern for DB access from
  non-request threads. Reuses a valid pooled connection or transparently gets a fresh one; no manual
  per-thread connection lifecycle management, no unbounded connection growth at scale.
- Confirmed with user: the send-then-log sequence WITHIN one channel's `_send_one` should stay
  sequential (not parallelized) — you need to know whether the send succeeded before you know what
  status to log. This was already the design in Issue #4's original fix; user's question was
  clarifying, not challenging, that part.

**Issue #5 (first admin user)** — RESOLVED. Standard `python manage.py createsuperuser` works
completely normally with a custom AUTH_USER_MODEL, AS LONG AS `USERNAME_FIELD`/`REQUIRED_FIELDS` are
correctly defined — which they already are, inherited unchanged from `AbstractUser`
(`USERNAME_FIELD = "username"`, `REQUIRED_FIELDS = ["email"]`), since our custom `User` (section 12)
only adds `phone_number`/`last_seen_at` without touching those. No extra work needed. Run once via
Render's Shell tab against the deployed Postgres; document resulting credentials in README per the
assignment's explicit "how to log in as admin" requirement.

**Issue #6 (toggle-mid-flight race)** — CONFIRMED not worth solving for a 2-day assignment. Left as
a documented, deliberate non-fix.

**Issue #7 (Test Send doesn't support arbitrary recipients) — RESOLVED, user's proposed fix is
correct and simpler than the original suggestion.** Original suggestion was a separate function
(`fire_trigger_test`); user proposed instead: pass `is_test: true` + the typed-in `recipient` as
parameters from the admin UI's Test Send action, and have the existing send flow accept an optional
`override_recipient` that bypasses `_resolve_recipient(channel, user)` entirely when present.
Concretely:
```python
def _send_one(template, user, context, is_test, override_recipient=None):
    adapter = CHANNEL_ADAPTERS[template.channel]
    recipient = override_recipient or _resolve_recipient(template.channel, user)
    ...
```
Real trigger flow (`fire_trigger`) never passes `override_recipient`, always has a real `user`. Test-
send endpoint always passes `override_recipient` (the admin-typed value), can pass `user=None` since
`_resolve_recipient` is never reached on that path. One parameter with a fallback, not two separate
code paths — cleaner than the original proposal. This is now the confirmed design.

## Summary — issues requiring action before/during implementation

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | CORS not configured — total frontend failure if missed | High, easy fix | **RESOLVED** — env var driven |
| 2 | JWT storage location | Medium | **RESOLVED** — access token in memory, refresh in httpOnly cookie |
| 3 | Outer timeout tuning was solving the wrong problem | Medium | **RESOLVED** — removed, adapter-level `requests` timeout is the real bound |
| 4 | Exception-inside-except bug in `_send_one` | High, real bug | **RESOLVED** — separate try blocks + `close_old_connections()` |
| 5 | No defined path to create/seed the first admin user | High — graded deliverable gap | **RESOLVED** — standard `createsuperuser` works fine with custom User model |
| 6 | Toggle-mid-flight race condition | Low | **RESOLVED** — deliberately not fixing, documented |
| 7 | `fire_trigger()` didn't support arbitrary test-send recipients | **High — was breaking Task A/B as designed** | **RESOLVED** — `override_recipient` parameter |

**All 7 issues are now resolved.** This document + scratchpad.md together form the complete,
verified spec ready to hand to Claude Code for implementation.
