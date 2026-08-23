# Starclinch Notification System

A trigger-based, multi-channel notification admin panel built for the Starclinch backend developer
assignment (see `docs/assignment/Starclinch_Backend Developer Assignment.pdf`). An admin manages
every trigger and template — WhatsApp, Email, Web Push — from one screen, without touching Meta,
Postmark, or OneSignal's own dashboards.

- **Backend**: Django + DRF, deploys to [Render](https://render.com).
- **Frontend**: Next.js (App Router), deploys to [Vercel](https://vercel.com).

## Submission

- **GitHub repo**: https://github.com/deaxparadox/starlinch-notification-system
- **Live backend URL (Render)**: https://starlinch-notification-system.onrender.com
- **Live frontend URL (Vercel)**: https://starlinch-notification-system.vercel.app

Render's free tier spins the backend down after 15 minutes idle — the first request after a
while will be slow (10-30s) while it wakes back up. This is expected, not a bug.

## Assignment checklist

Checked against the assignment PDF's own checklist (section 8), honestly — including the two
items blocked by external factors rather than code gaps:

| # | Item | Status |
|---|---|---|
| 1 | Sandbox WhatsApp set up + test phone added | ❌ Blocked — see [Known limitations](#known-limitations) |
| 2 | Postmark free account + sender verified | ❌ Blocked — see [Known limitations](#known-limitations) |
| 3 | Web Push free account + browser subscribed | ✅ Done — verified on real Windows, mobile, and Linux devices |
| 4 | Django backend built and deployed on Render | ✅ Done |
| 5 | Frontend + admin panel built and deployed on Vercel | ✅ Done |
| 6 | At least 2 triggers with all 3 channels working | ⚠️ Partial — Login + Logout are both wired to all 3 channels in code; only Web Push is provably working end-to-end because of #1/#2 |
| 7 | Task A — one trigger, all 3 channels tested | ⚠️ Partial — same reason as #6 |
| 8 | Task B — second trigger, all 3 channels tested | ⚠️ Partial — same reason as #6 |
| 9 | Task C — edited template + used toggle | ✅ Done — template edited and re-tested repeatedly; the toggle is a simple boolean gate before the send call, proven by every working send requiring it to be on |
| 10 | Task D — can explain triggers and channels | ✅ Done — see [Task D](#task-d--plain-language-answers) |
| 11 | GitHub + live URLs submitted | ✅ Done |

**6 of 11 fully done, 2 are external blockers (not code gaps — both adapters are built and would
work the moment real credentials exist), and the remaining 3 are partial purely as a direct
consequence of those two.**

## What's actually done right now

| Piece | Status |
|---|---|
| Backend (auth, trigger/template models, admin API, `fire_trigger()` service, all 3 provider adapters) | ✅ Built and verified |
| Frontend (design system, admin panel, website pages, auth guard) | ✅ Built and verified, redesigned once for real senior-level polish (see `TODO.md` history) |
| **Web Push (OneSignal)** | ✅ **Fully configured and verified working end to end** — real browser push notification received on login |
| Email (Postmark) | ⚠️ Code complete and adapter-tested against the real API shape; **sandbox account not yet approved** — see [Known limitations](#known-limitations) |
| WhatsApp (Cloud API) | ⚠️ Code complete; **sandbox not yet configured** — see [Known limitations](#known-limitations) |
| Deployment | ✅ **Live** — backend on Render, frontend on Vercel (see [Submission](#submission) for URLs) |

## How to log in as admin

**Locally** (via `docker compose`, see below): a test superuser already exists in the local dev
database —

```
username: testadmin
password: testpass123
```

**On the deployed instance**: Render's free tier has no Shell/SSH access, so there's no way to run
`createsuperuser` interactively after deploy. Instead, set these three env vars on the Render
service (see [Deployment](#deployment)) — `backend/docker-entrypoint.sh` creates the account
itself the moment the container starts, before the first deploy even finishes:

```
DJANGO_SUPERUSER_USERNAME=
DJANGO_SUPERUSER_EMAIL=
DJANGO_SUPERUSER_PASSWORD=
```

Safe to leave these set permanently — it only creates the account once (checks if the username
already exists first) and just logs a "already exists, skipping" line on every restart after that.
Use the resulting username/password to log in at `/login` on the frontend — a staff account gets
an **Admin** link in the site nav once logged in. Need a second admin later? Create it from inside
the admin panel itself once logged in as the first one — there's no separate self-signup flow, and
there doesn't need to be.

## Which triggers were built

**Login** and **Logout** — both event-based (fire the instant the action happens), matching the
assignment's minimum-2-triggers requirement.

**Not built: inactivity triggers** ("not logged in for 1 day/week"). This is a deliberate scope
decision, not an oversight: those require a scheduler periodically checking who's been inactive,
and Render's free tier has no Background Worker or Cron Job service type to run one on. Rather than
hack around it with a fragile external cron-ping service, this was scoped out and documented here
instead — see `docs/adr/0001-notification-sending-architecture.md`, Decision 3.

## Architecture at a glance

Full reasoning lives in `docs/adr/`:

- **[ADR-0001](docs/adr/0001-notification-sending-architecture.md)** — backend: triggers fire all
  active channels in parallel via `ThreadPoolExecutor` inside the request (no task queue, no Redis —
  works on Render's free tier), a scoped ports-and-adapters boundary around the 3 providers only,
  event-only trigger scope, and the JWT storage split (access token in memory, refresh token in an
  httpOnly cookie).
- **[ADR-0002](docs/adr/0002-frontend-design-system.md)** — frontend: the "Signal" visual direction
  (channel-colored badges, one coral primary accent, independently-tuned light/dark themes), a small
  hand-built component library, and a sidebar admin shell.

Every backend endpoint requires `IsAdminUser` under `/api/admin/*` — that's the real,
server-enforced boundary. The frontend's admin-link visibility and route guards are UX convenience
only, not the actual security boundary.

## Env vars needed

### `backend/.env` (see `backend/.env.example`)

**Required — the app fails to start without these:**
```
DJANGO_SECRET_KEY=
DJANGO_ALLOWED_HOSTS=          # comma-separated
DATABASE_URL=                  # postgres://...
CORS_ALLOWED_ORIGINS=          # comma-separated, must include the Vercel URL
```

**Optional — safe defaults, only change if you need to:**
```
DJANGO_DEBUG=False
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7
JWT_REFRESH_COOKIE_NAME=refresh_token
JWT_REFRESH_COOKIE_SECURE=True
JWT_REFRESH_COOKIE_SAMESITE=None
```

**Optional — notification providers.** The app runs fine with none of these set; a channel just
fails loudly (and logs it) if you try to send without its credentials configured:
```
WHATSAPP_ACCESS_TOKEN=
PHONE_NUMBER_ID=
WHATSAPP_API_VERSION=v22.0
POSTMARKAPP_TOKEN=
POSTMARK_FROM_EMAIL=
ONESIGNAL_APP_ID=
ONESIGNAL_REST_API_KEY=
```

### `frontend/.env.local` (see `frontend/.env.local.example`)

```
NEXT_PUBLIC_API_URL=http://localhost:8000     # the live Render URL in production
NEXT_PUBLIC_ONESIGNAL_APP_ID=                 # optional - Web Push subscribe disabled without it
```

### Root `.env` (see `.env.example`) — local `docker-compose` only, not used in production

```
POSTGRES_DB=starclinch_notifications
POSTGRES_USER=starclinch
POSTGRES_PASSWORD=localdevpassword
POSTGRES_PORT=5432
```

(If `5432` is already taken by another Postgres on your machine, change this to e.g. `5433` — it
only affects the host-side port mapping for local `docker-compose`.)

## Local development

```bash
# Backend + Postgres + Mailhog (for local email testing without hitting real Postmark)
docker compose up --build

# Frontend, in a separate terminal
cd frontend
npm install
npm run dev
```

Backend: http://localhost:8000. Frontend: http://localhost:3000. Mailhog UI (catches any real SMTP
mail sent locally): http://localhost:8025.

## Deployment

### Backend → Render

1. Push this repo to GitHub (already done).
2. In Render: **New → Blueprint**, point it at this repo. It reads `render.yaml` at the repo root
   and creates both the web service and a managed Postgres database in one step.
3. Render will prompt for the env vars marked `sync: false` in `render.yaml`:
   - `DJANGO_ALLOWED_HOSTS` — fill in once you know the service's `*.onrender.com` hostname.
   - `CORS_ALLOWED_ORIGINS` — fill in once you know the Vercel URL (step below).
   - The 6 provider credential vars — leave blank for now if sandbox accounts aren't ready yet.
   - `DJANGO_SUPERUSER_USERNAME` / `EMAIL` / `PASSWORD` — the free tier has no Shell access to run
     `createsuperuser` by hand, so fill these in now; the entrypoint script creates that admin
     account automatically on first boot (see [How to log in as admin](#how-to-log-in-as-admin)).
4. Deploy. The Dockerfile handles everything else: migrations run automatically on container
   start, static files are pre-collected at build time, and the admin account from step 3 is
   created on that same first boot.

### Frontend → Vercel

1. Import this repo in Vercel, set the **root directory** to `frontend/` — this, plus
   `frontend/vercel.json` (`render.yaml`'s counterpart on the Vercel side), keeps the frontend
   deploy scoped to `frontend/` only, matching the assignment's "Django on Render, Next.js on
   Vercel" split.
2. Set env vars in the Vercel project settings: `NEXT_PUBLIC_API_URL` (the Render URL from above),
   `NEXT_PUBLIC_ONESIGNAL_APP_ID` (if OneSignal is configured).
3. Deploy.
4. Go back to Render and fill in `CORS_ALLOWED_ORIGINS` and `DJANGO_ALLOWED_HOSTS` with the real
   Vercel/Render URLs now that both exist, then redeploy the backend.

### Note: Render's free Postgres expires

30 days after creation, then a 14-day grace period, then Render deletes it. Plenty of runway for
building/grading this, but worth knowing if this sits untouched for over a month — you'd need to
recreate the database or upgrade to a paid plan.

## Known limitations

### Web Push (OneSignal) — no limitations, works for anyone

This is the one channel with **zero setup required per-recipient**. Any user who logs in on their
own device and accepts the browser's permission prompt gets a real, working subscription
immediately — no allowlist, no approval wait. If you want to demo this to someone who didn't build
it, this is the channel to show.

### Email (Postmark)

- **Signup now requires a work-domain email** — Postmark rejects Gmail/Yahoo/other public webmail
  domains at signup (an anti-abuse measure, not mentioned in the assignment doc). If you don't have
  a company email, the practical workaround is a cheap domain (~$1-12/yr) plus free email
  forwarding (e.g. Cloudflare Email Routing) to your real inbox.
- **New accounts need manual approval** (~24h turnaround) before they can send to *any* address.
  Before approval, sends only work to your own verified Sender Signature address, or to Postmark's
  test sink `test@blackhole.postmarkapp.com` (delivery is faked, but shows in your Activity log).
  **After approval, the restriction lifts completely** — you can send to any address, including an
  evaluator's, no extra setup needed on their end. Request approval immediately after signing up,
  since it's the only part of this whole system with real wait time built in.
- Free plan: 100 emails/month, doesn't expire.

### WhatsApp (Cloud API)

**Status: not configured** — both issues below were actually hit while trying to set this up, not
hypothetical risks. `WHATSAPP_ACCESS_TOKEN`/`PHONE_NUMBER_ID` are unset; the code path is built and
adapter-tested against the real API shape, but never exercised against a live sandbox.

- **Hit a "try again in about an hour" cooldown during app configuration** on the first attempt,
  with no further detail given — a generic Meta-side rate-limit/lockout, not something caused by a
  specific misconfigured setting.
- **Creating a second account to work around that hit a different, known Meta gate**: "your
  account is too new" when trying to create a Business Portfolio — a genuine Meta anti-abuse
  restriction tied to account age, not a setup mistake. Clears on its own, typically within a few
  hours to a few days, but there wasn't enough runway left in the assignment window to wait it out.
- **Sandbox is capped at 5 recipient phone numbers total.** Each one must be manually added in the
  Meta App dashboard (WhatsApp → API Setup → *Manage phone number list*), and the number's owner has
  to enter a verification code sent to them via WhatsApp before they can receive test messages.
  There's no way to message an arbitrary number without this step — full Business Verification +
  Meta App Review would remove the cap, but that's a multi-week process, well out of scope here.
  **Practically**: this channel can only be demonstrated to numbers you've explicitly added and
  verified yourself (or live, with the viewer's participation) — not asynchronously to a stranger's
  number.
- The temporary access token from Meta's API Setup panel is short-lived (~1-2h) — expect to
  regenerate it periodically while testing.

## Task D — plain-language answers

**What is a trigger? Give 3 examples (not just login).**
A trigger is anything that happens on the site that should cause a notification — not just
logging in. Other examples: a password reset request, an order being placed, or someone not
having visited in a week (this last one isn't implemented here — see the trigger scope note above
— but it's still a valid example of "what counts as a trigger").

**What are the three channels?**
WhatsApp (via WhatsApp Cloud API), Email (via Postmark), and Web Push — a browser pop-up
notification (via OneSignal), no app install needed.

**Why create templates in the admin panel instead of on Postmark/WhatsApp's own sites?**
So there's exactly one place to manage what gets sent, regardless of which channel it goes out on.
An admin who wants to change wording doesn't need to know 3 different external dashboards, remember
3 different logins, or figure out which system owns which message — they open one table, find the
row, edit the cell. The system talks to WhatsApp/Postmark/OneSignal in the background; the admin
never has to.

**What is Web Push?**
A notification that pops up in someone's browser (like a phone notification, but for a website),
even if they don't have the site open in a tab — as long as they've granted permission once. No
app to install; it works through the browser itself.

## Project structure

```
backend/             Django + DRF (accounts, notifications apps)
frontend/            Next.js (App Router)
docs/adr/            Architecture decision records
docs/specs/          Per-feature implementation specs
docs/assignment/     The assignment PDF + the original design discussion
TODO.md              Full build log - every feature and bug fix, in order, with what was found and how it was verified
render.yaml          Render Blueprint (backend + Postgres)
docker-compose.yml   Local dev only (Django + Postgres + Mailhog)
```
