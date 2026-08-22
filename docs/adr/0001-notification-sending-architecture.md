# ADR-0001: Notification sending architecture

Branch: `main` (base: `main`, this is the initial commit history)

## Status
Accepted

## Context
The assignment needs a Django backend that, when a trigger fires (e.g. a user logs in), sends a
notification on up to 3 channels (WhatsApp Cloud API, Postmark email, OneSignal Web Push) without
ever blocking or breaking the user-facing action that caused the trigger. Two architectural
questions had to be settled before writing any code: how the sends are executed (sync vs. some
background job system), and how the code stays decoupled from the 3 providers' very different
APIs.

This carries forward the decisions made in a prior design discussion
(`docs/assignment/claude-discuss-files/scratchpad.md` sections 2 and 12, verified end-to-end in
`architecture-flows.md`) — recorded here as the project's actual ADR so it lives in the standard
location instead of only in the assignment discussion notes.

## Decision 1: Synchronous send via `ThreadPoolExecutor`, not a task queue

Rejected, in order:
- **django-q2** — needs a persistent `qcluster` worker process. Render's free tier has no
  Background Worker service type to run it on.
- **Django Channels** — needs a separate `runworker` process + Redis; solves WebSocket delivery,
  not "call 3 HTTP APIs without blocking the request."
- **Separate FastAPI service reflecting Django's DB** — one-shot schema snapshot (drift risk), two
  connection pools/deploys, and the assignment asks for one Django backend.

**Decision:** fire the 3 channel sends in parallel threads via `concurrent.futures.ThreadPoolExecutor`
(3 workers), inside the same request/response cycle that triggered them. No separate process, no
Redis — works on Render's free Web Service tier. A failed or slow channel send is logged to
`NotificationLog` and never blocks or fails the primary action (login/logout always succeeds
regardless of notification outcome).

Refinements settled during the flow trace:
- **No outer timeout on the thread batch.** `as_completed(timeout=...)` does not cancel a running
  thread — Python's `concurrent.futures` has no mechanism to force-kill one. It only stops Django
  from *waiting*. Each adapter's own `requests.post(..., timeout=8)` is already the real, sufficient
  bound; adding or tuning an outer timeout only risks an orphaned thread outliving the HTTP response,
  it does not reduce actual work done. So there is no outer timeout — just `future.result()` per
  future.
- **`close_old_connections()`** (from `django.db`) is called at the top of the per-channel send
  function, before any DB write — Django's standard pattern for safe DB access from a thread that
  isn't the main request thread.
- **Send and log-write are separate `try`/`except` blocks.** A `NotificationLog` write failure must
  never mask a send that actually succeeded, and must never raise unhandled from inside an `except`
  block (which would defeat the "never throw" guarantee `fire_trigger()` has to hold).

**Consequence:** login/logout latency is bounded by DB auth + up to ~8s of parallel external API
calls, not sub-second. The frontend must show an explicit loading state during login (tracked in the
website-pages spec) rather than let it look broken during a demo.

## Decision 2: Scoped hexagonal (ports & adapters) — sending boundary only

A counter-opinion was researched and weighed (Django-specific commentary arguing the boundary should
be built around services, not storage, since Django is Active-Record-shaped by design). Full
hexagonal purity — wrapping `Trigger`/`Template` ORM access in repository ports too — would add real
indirection with no practical payoff for a 2-day assignment on a DB shape that will never change.

**Decision:** ports & adapters ONLY at the notification-sending boundary, where hexagonal literature
itself names this pattern as a strong fit ("business logic interacts with multiple evolving external
integration points"):
- `NotificationPort` (ABC): one method, `send(*, recipient, message: RenderedMessage) -> dict`.
- `RenderedMessage`: channel-agnostic rendered shape (subject/body for email/webpush;
  template_name/language_code/variables for WhatsApp's positional-variable template format).
- Three adapters implement the port — `WhatsAppCloudAdapter`, `PostmarkEmailAdapter`,
  `OneSignalWebPushAdapter` — each owning exactly one provider's auth/request quirks.
- `notifications/services.py` never imports `requests` or a provider SDK directly, only calls
  `adapter.send(...)` through the port. A `CHANNEL_ADAPTERS` dict is the single place mapping
  channel → adapter instance.
- `Trigger`/`Template` ORM access is plain Django ORM, no repository wrapper.

**Consequence:** swapping a provider later is a new adapter class + one dict line, no orchestration
changes. A `FakeAdapter` can back unit tests of `fire_trigger()`'s branching/logging without real
HTTP calls.

## Decision 3: Trigger scope — event-based only, not time-based

Time-based triggers ("not logged in 1 day/week") need a scheduler periodically checking inactivity
and calling `fire_trigger()` on their behalf — independent of the sync-vs-async sending question
above (sync only governs how *one* fire executes, not what decides to trigger it). Render Cron Jobs
are paid-only, same wall as Background Workers; an external cron-ping workaround exists but is
fragile for a 2-day assignment demo.

**Decision:** scope to instant/event-based triggers only — **Login** and **Logout**. Document the
"no free-tier scheduler on Render" limitation plainly in the README rather than hack around it.

## Decision 4: Auth token storage split

JWT overall (Vercel and Render are separate domains; cross-domain session cookies don't fit as
cleanly as a token). **Access token: in-memory only** on the frontend (React state, never
persisted — gone on refresh, so XSS can't read a persisted copy). **Refresh token: httpOnly
cookie** — unreadable by JS, sent automatically by the browser. Requires
`CORS_ALLOW_CREDENTIALS = True` (Django) + `credentials: "include"` (frontend fetches) + correct
`SameSite`/`Secure` cookie flags for the cross-domain Vercel↔Render setup.

## Consequences
- Every `FEAT` spec touching sending, triggers, or auth should reference this ADR by path instead of
  re-deriving these decisions.
- The known limitation (no time-based triggers, sync send latency) must be called out explicitly in
  the README, not silently absorbed.
