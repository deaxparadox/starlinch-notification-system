# Claude Code Handoff — StarClinch Notification System

## How to use this document
Read this file first, then `scratchpad.md` (sequential decision log — what we decided and why),
then `architecture-flows.md` (connected end-to-end flow trace, bugs found and fixed by tracing real
request paths through the whole system). All three together are the complete spec. The final,
corrected `fire_trigger()` service-layer code is in scratchpad.md section 13 — implement that
version, not any earlier draft referenced inside architecture-flows.md's issue discussions (those
are the "before" state showing what was wrong and why; section 13 is the "after").

## Scope, stated plainly
- Backend: Django + DRF, deployed to Render (Dockerfile-based Web Service) + Render managed Postgres.
- Frontend: single Next.js app, deployed to Vercel.
- Triggers implemented: **Login and Logout only** (event-based/instant). Inactivity-based triggers
  ("not logged in 1 day/week") are explicitly OUT OF SCOPE — Render's free tier has no scheduler/cron
  service, and this was a deliberate, documented scope decision, not an oversight. Mention this in
  the README, don't attempt a workaround.
- Channels: WhatsApp Cloud API (sandbox), Postmark (raw send, not hosted templates), OneSignal Web
  Push only (no mobile/Android/iOS/Email/SMS/In-App channels from OneSignal — Email is Postmark's
  job).
- Trigger firing is synchronous, in-request, using `concurrent.futures.ThreadPoolExecutor` — no
  Celery, no Django-Q, no Channels, no Redis, no separate worker process. This is a deliberate,
  researched decision (see scratchpad.md section 2), not a shortcut — Render's free tier has no
  Background Worker or Cron Job service type, confirmed via Render's docs.
- Architecture pattern: scoped hexagonal (ports & adapters) applied ONLY at the notification-sending
  boundary (`notifications/ports.py`, `notifications/adapters/`). Do NOT wrap Trigger/Template
  Django ORM access in repository ports — that was explicitly rejected as unnecessary complexity.

## Non-negotiable implementation details (bugs already found and fixed — implement fixed version)
1. `fire_trigger()` and `_send_one()` — use the EXACT code in scratchpad.md section 13, including:
   - No outer `as_completed(timeout=...)` — removed deliberately, adapter-level `requests` timeout
     (8s) is the real bound. Do not re-add an outer timeout.
   - `close_old_connections()` called at the top of `_send_one`, before any DB write — required for
     safe DB access from a ThreadPoolExecutor thread.
   - Send and log-write are in SEPARATE try/except blocks — a log-write failure must never mask a
     successful send or raise unhandled from inside an except block.
   - `override_recipient` and `override_channel` params exist specifically for the Test Send
     endpoint — the admin-typed recipient bypasses `_resolve_recipient(channel, user)` entirely.
2. `PATCH /api/admin/triggers/{trigger_id}/templates/{channel}/` MUST use `get_or_create` (then
   update), not plain `create()` — `unique_together = ("trigger", "channel")` will raise
   `IntegrityError` on a second save to the same cell otherwise.
3. `GET /api/admin/triggers/` serializer MUST always return all 3 channel keys
   (whatsapp/email/webpush) per trigger, `null` for any channel with no Template row yet — this
   logic belongs in the serializer, not the frontend.
4. CORS: `CORS_ALLOWED_ORIGINS` read from a comma-separated env var and split in settings, plus
   `CORS_ALLOW_CREDENTIALS = True` (required because the refresh token travels as an httpOnly
   cookie, cross-domain between Vercel and Render).
5. Auth token split: **access token returned in the JSON response body, used in-memory only on the
   frontend (never localStorage) — refresh token set by Django as an httpOnly cookie.** Frontend
   fetches must use `credentials: "include"`.
6. `IsAdminUser` (or equivalent `is_staff` check) enforced on every `/api/admin/*` DRF view — this
   is the real, backend-enforced authorization boundary. The frontend's login-redirect and
   Unauthorized-page handling are UX only, never the actual security boundary.
7. First admin account: use standard `python manage.py createsuperuser` — works fine with the
   custom `AUTH_USER_MODEL`, no special handling needed. Run once via Render's Shell tab against the
   deployed Postgres. Document the resulting credentials in the README (assignment explicitly
   requires "how to log in as admin").
8. OneSignal Web Push subscribe flow must trigger AFTER successful login, not on anonymous page
   load — the `player_id` has no `user` to attach to otherwise.
9. Login button needs an explicit, sustained loading state ("Logging in...") — login latency is
   variable (DB auth + up to ~8s of parallel external API calls via `fire_trigger`), not
   sub-second, due to the synchronous send design.

## Docker
- `Dockerfile` for the Django backend — must work standalone (usable directly by Render as a
  Docker-based Web Service) AND inside local `docker-compose`.
- `docker-compose.yml` at repo root: `django` + `postgres` services (+ optional `mailhog` for local
  email testing without hitting real Postmark) — LOCAL DEV ONLY. Render does not run docker-compose
  in production; it uses the Dockerfile directly, independently per service.
- Next.js frontend: no Docker required for Vercel deployment (Vercel has its own build pipeline).

## Known external blockers (not code problems — do not try to work around in code)
- **WhatsApp**: may be blocked by Meta's new-Facebook-account Business Portfolio creation
  restriction ("Your Facebook account is too new to create a business account"). This clears with
  time (roughly 1h to 24-72h per Meta/community reports), not with a code change. Implement the full
  WhatsApp adapter and flow regardless, using placeholder `.env` values — swap in real credentials
  the moment the restriction clears.
- **Postmark**: account approval can take ~24h after signup. Can still send to the verified Sender
  Signature address immediately, which covers Task A/B test-send needs pre-approval.
- **OneSignal**: no blockers — smooth setup, forever-free tier.

---

## `.env.example` — Django backend (`backend/.env.example`)

```env
# --- Django core ---
DJANGO_SECRET_KEY=changeme-generate-a-real-secret-key
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=your-app.onrender.com,localhost,127.0.0.1

# --- Database (Render provides this automatically for a managed Postgres instance;
#     for local docker-compose, point at the local postgres service instead) ---
DATABASE_URL=postgres://user:password@localhost:5432/starclinch_notifications

# --- CORS (comma-separated, no spaces) ---
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://your-app.vercel.app
CORS_ALLOW_CREDENTIALS=True

# --- JWT / auth ---
# Access token: short-lived, returned in response body, kept in-memory on frontend.
# Refresh token: longer-lived, set as an httpOnly cookie by Django.
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7
JWT_REFRESH_COOKIE_NAME=refresh_token
JWT_REFRESH_COOKIE_SECURE=True
JWT_REFRESH_COOKIE_SAMESITE=None

# --- WhatsApp Cloud API (Meta sandbox) ---
# From Meta App Dashboard > WhatsApp > API Setup
WHATSAPP_ACCESS_TOKEN=your_temporary_or_long_lived_token
PHONE_NUMBER_ID=your_test_phone_number_id
WHATSAPP_API_VERSION=v22.0

# --- Postmark ---
POSTMARKAPP_TOKEN=your_server_api_token
POSTMARK_FROM_EMAIL=your_verified_sender@example.com

# --- OneSignal (Web Push only) ---
ONESIGNAL_APP_ID=your_onesignal_app_id
ONESIGNAL_REST_API_KEY=your_onesignal_rest_api_key
```

## `.env.example` — Next.js frontend (`frontend/.env.local.example`)

```env
# --- Backend API ---
NEXT_PUBLIC_API_URL=http://localhost:8000
# Production: NEXT_PUBLIC_API_URL=https://your-app.onrender.com

# --- OneSignal (Web Push) ---
NEXT_PUBLIC_ONESIGNAL_APP_ID=your_onesignal_app_id
```

## `.env.example` — Local `docker-compose` (root `.env.example`, if compose reads its own file)

```env
# Postgres, for local docker-compose only — NOT used in production (Render provides
# DATABASE_URL directly for its managed Postgres instance)
POSTGRES_DB=starclinch_notifications
POSTGRES_USER=starclinch
POSTGRES_PASSWORD=localdevpassword
POSTGRES_PORT=5432
```

---

## README requirements (from the assignment doc — do not omit any of these)
1. How to log in as admin (the `createsuperuser` credentials/process).
2. Which triggers were built — Login, Logout — and an explicit note on why inactivity triggers
   (1 day/1 week) are out of scope (Render free tier has no scheduler/cron service).
3. Full env var list needed (mirror the `.env.example` files above).
4. Known friction points worth mentioning: Postmark's ~24h account approval, WhatsApp's Meta
   business-account-age restriction, OneSignal's incognito-mode subscribe limitation.
5. Plain-language answers for Task D's four questions (what is a trigger + 3 examples beyond login,
   the three channels, why templates live in the admin panel instead of Postmark/WhatsApp's own
   sites, what Web Push is) — the scratchpad's section 7 (content-ownership reasoning) is good raw
   material for the "why admin panel" answer specifically.
6. GitHub repo link(s), live Render URL, live Vercel URL.
