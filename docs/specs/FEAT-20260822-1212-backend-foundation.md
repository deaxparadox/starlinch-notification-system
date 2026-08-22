# FEAT-20260822-1212 — Backend foundation

Branch: `main` (base: `main` — first code in the repo, no prior branch history)

## What's being built
The Django project skeleton the rest of the notifications app will sit on:
- Django + DRF project (`backend/config/`).
- Custom `User` model (`backend/accounts/`) from day one.
- JWT auth endpoints: login, logout, refresh — with the access/refresh token split from
  [ADR-0001](../adr/0001-notification-sending-architecture.md#decision-4-auth-token-storage-split).
- `Dockerfile` for the Django app + root `docker-compose.yml` (Django + Postgres + optional
  Mailhog) for local dev parity.
- Settings read from environment variables, failing loudly at startup if a required one is missing
  (`DJANGO_SECRET_KEY`, `DATABASE_URL`, `CORS_ALLOWED_ORIGINS`) — per this repo's Module 4 rule: no
  buried defaults for anything required to run.

This is foundation only — no `Trigger`/`Template`/notification-sending code yet (that's
FEAT-20260822-1213). `login`/`logout` views here just authenticate; the `fire_trigger(...)` call
gets wired into them in the next item, once `fire_trigger` exists.

## Current state (verified)
Empty repo — `git init` done, no backend code exists yet. Nothing to verify against; this is a
greenfield scaffold, generated with Django's own tooling (`django-admin startproject`,
`python manage.py startapp`) per this repo's Module 8 rule, not hand-written from scratch.

## Design rationale
- **Custom `AUTH_USER_MODEL` from day one** — swapping it in later means rewriting every FK that
  will point to `User` (Template test-sends, `NotificationLog`, `PushSubscription` in the next
  item). Cheaper to do now than to migrate later.
  - `phone_number` (E.164, for WhatsApp sends) added directly on `User`, not a separate `Profile`
    model — it's the only extra field needed.
  - `USERNAME_FIELD`/`REQUIRED_FIELDS` stay inherited unchanged from `AbstractUser`, so
    `python manage.py createsuperuser` works with no special handling — this becomes the documented
    way to create the first admin account (README, tracked in FEAT-20260822-1219).
- **JWT split** — see ADR-0001, Decision 4.
- **CORS** — `CORS_ALLOWED_ORIGINS` read from a comma-separated env var and split in settings, plus
  `CORS_ALLOW_CREDENTIALS = True` (needed once the refresh cookie is cross-domain between Vercel and
  Render). Missing this breaks every frontend API call at once, not partially — worth getting right
  now even though there's no frontend yet to test against.
- **Fail-fast config** — `DJANGO_SECRET_KEY`, `DATABASE_URL`, and `CORS_ALLOWED_ORIGINS` are read via
  a small helper that raises `ImproperlyConfigured` at startup if unset, rather than silently
  defaulting to something that "works" locally but is wrong in production (Module 4). Token
  lifetimes (`JWT_ACCESS_TOKEN_LIFETIME_MINUTES`, etc.) are genuine behavioral-tuning knobs and keep
  safe code defaults, per Module 4's exception for those.
- **Docker** — one `Dockerfile`, usable directly by Render as a Docker-based Web Service and inside
  local `docker-compose`. `docker-compose.yml` is local-dev-only; Render does not run compose in
  production.

## Proposed structure
```
backend/
├── Dockerfile
├── manage.py
├── requirements.txt
├── .env.example
├── config/            # settings, urls, wsgi/asgi — settings.py reads env vars, fails fast
├── accounts/          # custom User model, JWT auth views (login/logout/refresh)
docker-compose.yml       # repo root — django + postgres (+ mailhog), local dev only
```

## Endpoints (this item)
- `POST /api/auth/login/` — authenticate, return `{access_token, user}`, set refresh httpOnly
  cookie. (No `fire_trigger("login", ...)` call yet — added in FEAT-20260822-1213.)
- `POST /api/auth/logout/` — clears refresh cookie.
- `POST /api/auth/refresh/` — issues a new access token from the refresh cookie.

## Out of scope for this item
- `Trigger`/`Template`/`NotificationLog`/`PushSubscription` models, adapters, `fire_trigger()` —
  FEAT-20260822-1213.
- Admin-only API endpoints and `IsAdminUser` enforcement on them — FEAT-20260822-1214 (this item's
  auth views have no admin-only routes to protect yet).
- Actual deploy to Render — FEAT-20260822-1218.
