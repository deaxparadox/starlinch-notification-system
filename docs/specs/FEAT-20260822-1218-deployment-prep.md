# FEAT-20260822-1218 — Deployment prep

Branch: `main` (base: `main`)

## Scope change (confirmed with user before starting)
The user doesn't have Render/Vercel accounts yet and will do the actual account setup and
deployment themselves. This item's scope is therefore: make the repo actually deployable
(fix real gaps, don't just assume the existing Dockerfile works), and hand off clear instructions.
Actual account creation, the live deploy, and running `createsuperuser` against the live database
are done by the user — the exact steps for that are written up in FEAT-20260822-1219's README, not
executed here.

## Current state (verified) and gaps found
Read `backend/Dockerfile` and `docker-compose.yml` before starting. Two real gaps, not assumptions:
1. `Dockerfile` hardcoded `--bind 0.0.0.0:8000`. Verified against Render's current docs: Render
   injects a `$PORT` env var (default `10000`) and the container must bind to it — a hardcoded port
   would simply fail to receive traffic on Render.
2. No static file serving configured for production (`DEBUG=False` means Django's dev-server static
   handling is off, and nothing else serves `/static/`) — Django's own `/admin/` (used for
   `createsuperuser`/browsing model data) would render completely unstyled.

## Changes made
- **`backend/Dockerfile`**: binds to `${PORT:-10000}` instead of a hardcoded port.
  `collectstatic` runs at build time using throwaway env values (`DJANGO_SECRET_KEY` etc. aren't
  available until Render injects the real ones at container runtime; `collectstatic` never touches
  the database so this is safe).
- **`backend/docker-entrypoint.sh`** (new): runs `migrate --noinput` then `exec`s gunicorn — `exec`
  replaces the shell process so gunicorn becomes PID 1 and receives Render's shutdown signal
  directly, instead of it going to an intermediary shell (Docker itself flagged the original
  shell-form `CMD` for exactly this). Migrations running on every container start is safe here
  specifically because this is a single free-tier instance, not a multi-replica deploy where
  concurrent migration runs would be a real risk.
- **`whitenoise`** added (`requirements.txt`, `MIDDLEWARE`, `STORAGES`) — serves collected static
  files directly from the Django process, no separate static host/CDN needed for a project this
  size.
- **`render.yaml`** (new, repo root): a Render Blueprint so the user can create both the web service
  and the managed Postgres database from one file via Render's "New Blueprint" flow, instead of
  configuring each by hand. Secrets and anything depending on not-yet-known values (the service's
  own hostname for `DJANGO_ALLOWED_HOSTS`, the Vercel URL for `CORS_ALLOWED_ORIGINS`, all provider
  credentials) are marked `sync: false` so Render prompts for them rather than guessing.

## Verification (done, not assumed)
Built the image locally (`docker build`) and ran the actual container against a real Postgres
(the same one `docker-compose` uses), passing env vars the way Render would inject them:
- `collectstatic` succeeded during build (157 files copied, 453 post-processed).
- Container started, ran migrations, gunicorn bound to `$PORT` correctly, and became PID 1
  (confirmed in the gunicorn startup log).
- `curl` confirmed the API (`/api/auth/login/`), Django admin login page, and a whitenoise-served
  static file (`/static/admin/css/base.css`) all return correct responses.
- `docker stop` (sends SIGTERM) shut the container down cleanly in ~0.6s with a clean
  "Handling signal: term" → worker exit → shutdown log, confirming the entrypoint's `exec` fix
  actually works, not just building without the earlier Docker lint warning.

## Explicitly out of scope here (handed to the user via README)
- Creating the Render/Vercel accounts.
- Running the Blueprint / linking the GitHub repo.
- Setting the `sync: false` env vars in Render's dashboard.
- Setting `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_ONESIGNAL_APP_ID` in Vercel's project settings.
- Running `createsuperuser` via Render's Shell tab against the live database.
- Known friction point to flag in the README: Render's free-tier managed Postgres expires after a
  time limit — worth noting so it isn't mistaken for a bug later.
