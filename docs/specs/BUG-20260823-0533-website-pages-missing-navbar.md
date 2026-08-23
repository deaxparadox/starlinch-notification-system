# BUG-20260823-0533 — login/logout/unauthorized never had the shared navbar

Branch: `feature/design-refresh-v2` (base: `main`)

## What's broken

Reported by the user after FEAT-20260823-0457: the login page looked barely changed — no navbar,
no visible gradient backdrop, the card floating with nothing framing it.

## Root cause (verified, not assumed)

Pre-existing, not something this redesign introduced: `WebsiteLayout`
(`frontend/app/(website)/layout.tsx`) renders the shared `<nav>`, but only pages physically located
*inside* the `(website)/` folder get wrapped by it — Next.js route groups only apply a layout to
files that actually live in that directory. `frontend/app/login/page.tsx`,
`frontend/app/logout/page.tsx`, and `frontend/app/unauthorized/page.tsx` were all sitting directly
under `app/`, siblings of `(website)/`, not inside it (confirmed with `find frontend/app -maxdepth
2 -iname page.tsx` — only the home page was actually inside `(website)/`). These three pages have
been missing the navbar since they were first built (FEAT-20260822-1216/1217), not since this
redesign — the redesign's own gradient/typography work was applied correctly to each page's own
content, which is why only the navbar was missing, not everything.

Separately verified the "no gradient" part of the report is **not** a code bug: a fresh
Playwright screenshot of the exact same running dev server (`http://localhost:3000/login`) shows
the gradient blobs, new card, and new button rendering correctly. This points to a stale browser
tab or dev-server build cache on the user's side after the branch checkout, not a real defect —
told the user directly to hard-refresh / restart their dev server rather than silently "fixing"
something that wasn't broken.

## Fix

Moved all three pages into `frontend/app/(website)/`:
`login/page.tsx`, `logout/page.tsx`, `unauthorized/page.tsx`. Route groups don't affect the URL, so
`/login`, `/logout`, `/unauthorized` are unchanged — only the layout wrapping them changes. No
other files existed in the old folders (confirmed via `ls`), so this was a pure move, no merge
needed.

## Verification

Playwright screenshots of all three pages post-move: navbar now renders on every one, alongside
the gradient/card treatment that was already correct. Checked browser console for anything new —
only pre-existing dev-environment noise (two 401s from the anonymous auth-check, OneSignal's
already-documented localhost-domain-restriction warning), nothing introduced by this move.
