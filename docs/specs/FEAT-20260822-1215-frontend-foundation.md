# FEAT-20260822-1215 — Frontend foundation

Branch: `main` (base: `main`)

## What's being built
The Next.js skeleton the actual pages (FEAT-20260822-1216, FEAT-20260822-1217) get built into:
project scaffold, the `(website)`/`(admin)` route-group split, the shared API client, and the auth
context. No real page content yet — placeholder pages just prove routing/build/auth-guard work.

## Current state (verified)
No `frontend/` directory exists. Backend is fully built and verified (`backend/`): auth endpoints
at `/api/auth/{login,logout,refresh}/`, admin endpoints at `/api/admin/...`, CORS already configured
for `http://localhost:3000` in `backend/.env`.

## Scope for this item vs. later items
- **This item**: project scaffold, route groups with placeholder pages, `lib/api-client.ts`,
  `lib/auth.tsx` (React context), `lib/types.ts`, the `(admin)` layout's auth guard (redirect
  unauthenticated → `/login`; redirect authenticated-but-not-staff → `/unauthorized`) and the
  `/unauthorized` route itself — the guard needs to exist before there's real admin content to
  guard.
- **FEAT-20260822-1216**: actual login/logout page UI, OneSignal Web Push subscribe flow.
- **FEAT-20260822-1217**: actual admin trigger×channel table UI inside the already-guarded
  `(admin)` layout.

## URL-routing requirement (user directive, not from the original discussion docs)
Every distinct screen/UI state must be a real, navigable URL — not a component-state toggle that
swaps content while the URL stays put. The only exception is secrets (access token) — those stay
in-memory only, never in the URL/query string/localStorage. Concretely for this item:
- "Not logged in" → **redirect** to `/login` (a real route), not an inline login form rendered in
  place.
- "Logged in but not staff" → **redirect** to `/unauthorized` (a real top-level route, outside both
  route groups so it's reachable regardless of which group triggered it), not a conditionally
  rendered component at the same URL.
- This carries forward into later items too: FEAT-20260822-1217's template editor should be a route
  (e.g. `/admin/triggers/[id]/templates/[channel]`), not a modal driven by local component state.

## Design rationale (from ADR-0001, Decision 4)
- **Access token**: React Context state only, never persisted (`localStorage`/`sessionStorage`) —
  gone on refresh, so it can't be read back by an XSS payload. Held in `lib/auth.tsx`'s
  `AuthProvider`.
- **Refresh token**: already an httpOnly cookie set directly by Django — the frontend never reads or
  writes it, only relies on `credentials: "include"` so the browser attaches it automatically.
- **Silent refresh**: on app mount, `AuthProvider` calls `POST /api/auth/refresh/` once
  (`credentials: "include"`) to recover a session after a page reload, since the in-memory access
  token doesn't survive one. A 401 there just means "not logged in" — not an error to surface.
- **`api-client.ts`**: thin `fetch` wrapper. Attaches `Authorization: Bearer <token>` from the auth
  context, always sends `credentials: "include"`. On a 401, attempts one silent refresh + retry
  (covers an access token that expired mid-session) before giving up. On a 403, throws a typed
  `ForbiddenError` — this is what the `(admin)` layout's guard catches to redirect to `/unauthorized`,
  per architecture-flows.md Flow 2 ("authenticated but not authorized — different case from
  not-logged-in, must not redirect to login").
- **`(admin)` layout guard**: client-side redirect is UX convenience only — the *real* security
  boundary is Django's `IsAdminUser`, already enforced backend-side (FEAT-20260822-1214). This guard
  exists so a non-admin doesn't see a confusing blank/broken table, not as the actual access control.

## Structure
```
frontend/
├── app/
│   ├── (website)/
│   │   ├── layout.tsx           # minimal placeholder nav
│   │   └── page.tsx             # placeholder home page
│   ├── (admin)/
│   │   ├── layout.tsx           # auth guard: redirects to /login or /unauthorized
│   │   └── admin/
│   │       └── page.tsx         # placeholder "Admin dashboard" — real table in FEAT-20260822-1217
│   ├── login/
│   │   └── page.tsx             # placeholder login route (real form in FEAT-20260822-1216)
│   ├── unauthorized/
│   │   └── page.tsx             # real route, outside both route groups
│   └── layout.tsx               # root layout, wraps app in AuthProvider
├── lib/
│   ├── api-client.ts
│   ├── auth.tsx                 # AuthProvider + useAuth() hook
│   └── types.ts                 # Trigger, Template, NotificationLog (mirrors DRF serializers)
├── .env.local.example
└── (standard Next.js config: package.json, tsconfig.json, next.config.ts, etc. — generated)
```

## Scaffolding
Generated via `npx create-next-app@latest frontend` (TypeScript, App Router, Tailwind, ESLint) per
this repo's Module 8 rule — no hand-written project skeleton.

## `.env.local.example`
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```
(Production value — the live Render URL — set directly in Vercel's project env vars at deploy time,
FEAT-20260822-1218.)

## Verification plan
`npm run build` succeeds; `npm run dev` serves the placeholder `(website)` home page, `/admin`
redirects to `/login` when logged out, and to `/unauthorized` when logged in as a non-staff user
(using the `regularuser` test account already created against the backend).
