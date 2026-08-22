# FEAT-20260823-0255 — Vercel project config

Branch: `main` (base: `main`)

## What's being built
`frontend/vercel.json` — the Vercel equivalent of `render.yaml`, so the "Django on Render only,
Next.js on Vercel only" split from the assignment PDF is enforced by a committed config file on
both sides, not just a dashboard setting nobody can see in the repo.

## Current state (verified)
`render.yaml` (repo root, from FEAT-20260822-1218) already scopes Render to only the backend
Docker service (`dockerContext: ./backend`) — no frontend service defined there at all. No
equivalent existed for Vercel. Verified current `vercel.json` schema and `ignoreCommand`'s exact
exit-code semantics against Vercel's live docs before writing this (not from memory) — exit `0`
skips the build, exit `1` continues it, the opposite of a naive guess.

## What's in it
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "ignoreCommand": "git diff --quiet HEAD^ HEAD ./"
}
```
- `framework: nextjs` — explicit, version-controlled framework declaration (Vercel auto-detects
  this too, but making it explicit means the repo states its own build assumptions instead of
  relying only on Vercel's detection).
- `ignoreCommand` — this is the monorepo-relevant part: skips triggering a Vercel rebuild when a
  push only touched `backend/` (or docs, or anything outside `frontend/`), since the command runs
  relative to the project's root directory (which must be set to `frontend/` in the Vercel
  dashboard's project settings when importing — that dashboard setting is what actually makes
  `frontend/` the deploy target; `vercel.json` alone doesn't set root directory).

## Out of scope
Security headers, redirects, image optimization config — none of that is needed for this app and
wasn't asked for; keeping this file to what's actually useful here.

## Verification plan
`vercel.json` validated as well-formed JSON. Full functional verification only happens once the
project is actually imported to Vercel with Root Directory set to `frontend/` — noted in the README
as part of the existing deployment steps.
