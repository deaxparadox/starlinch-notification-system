# BUG-20260823-0329 — First admin account on Render free tier (no Shell access)

Branch: `main` (base: `main`)

## What's broken

`README.md`'s "How to log in as admin" and "Deployment" sections currently say:

> Once live, open the service's **Shell** tab and run `python manage.py createsuperuser`.

Verified against Render's current docs (not from memory): **free web services have no
Shell/SSH access, and cannot run one-off Jobs either** — both require a paid plan. There is no
way to run an interactive management command against a free-tier deployment at all. The
documented path to create the first admin account is simply impossible on the tier this project
targets.

## Root cause

The deployment prep (`FEAT-20260822-1218`) assumed Render Shell access would be available for
this one-time setup step, the same way local `docker compose` gives you a shell into the
container. That assumption was never verified against Render's free-tier feature matrix at the
time, and it's wrong.

## Fix

`docker-entrypoint.sh` already runs once, automatically, on every container start (it currently
does `migrate --noinput` then `exec gunicorn`). This is the only code that reliably executes on a
free-tier deploy with no manual/interactive access — so the first admin account has to be created
here, not via a command run by hand.

Add a step after `migrate`, before `exec gunicorn`:

- If `DJANGO_SUPERUSER_USERNAME` is set (the trigger — unset means "do nothing", the existing
  default), read `DJANGO_SUPERUSER_USERNAME` / `DJANGO_SUPERUSER_EMAIL` / `DJANGO_SUPERUSER_PASSWORD`
  and create that user as a superuser **only if a user with that username doesn't already exist**.
- Values are read from `os.environ` inside a Python snippet (`manage.py shell -c`), not
  interpolated into the shell command as text — avoids any quoting/injection risk if the password
  contains special characters.
- Idempotent by construction (existence check, not try/catch-and-ignore) — safe to leave these env
  vars set permanently; every future restart/redeploy just logs "already exists, skipping" instead
  of erroring or duplicating.
- Log a clear line either way (created vs skipped) — this is a visible, intentional fallback per
  the project's config rules, not a silent one.
- Not required for the app to start — no crash, no behavior change at all when these vars are
  unset (matches how the other optional provider-credential vars already work in
  `backend/config/settings.py`).

**No admin-panel self-registration UI.** Considered and rejected: the admin panel itself is
gated behind `IsAdminUser`, so a self-signup flow would need to exist *outside* that gate,
which either means an unauthenticated "create the first admin" endpoint (a standing attack
surface for zero benefit once one admin exists) or a special-cased "only works when zero admins
exist" endpoint (extra code solving a problem the entrypoint already solves for free). The
existing admin panel already supports creating further admin users once the first one is logged
in — that's the intended path for every admin after the first.

## Changes

1. `backend/docker-entrypoint.sh` — add the conditional, idempotent superuser-creation step.
2. `render.yaml` — add `DJANGO_SUPERUSER_USERNAME`, `DJANGO_SUPERUSER_EMAIL`,
   `DJANGO_SUPERUSER_PASSWORD` as optional env vars (`sync: false`, prompted at Blueprint setup,
   not given a default).
3. `backend/.env.example` — document the same three vars under the existing "optional" section,
   so local `docker compose` can use this same mechanism instead of (or alongside) the seeded
   `testadmin` user.
4. `README.md` — replace the Shell-tab instructions in both "How to log in as admin" and
   "Deployment" with instructions to set these three env vars in Render before/at first deploy.

## Out of scope

- Rotating/removing the bootstrap admin later — not asked for, and the admin panel already lets
  any admin deactivate or recreate accounts once logged in.
- Any change to local `docker compose`'s existing seeded `testadmin` — that keeps working exactly
  as-is; the new mechanism is additive, not a replacement, for local dev.

## Verification plan

- Local: `docker compose up --build` with the three new env vars set in root `.env` — confirm the
  log line shows creation, confirm login works with those credentials, confirm a second
  `docker compose up` logs "already exists, skipping" instead of erroring.
- Confirm behavior is unchanged (no new log lines, no error) when the three vars are absent, as
  they are today in the default `.env.example`/`docker-compose.yml` setup.
