# TODO

## Todo
- FEAT-20260822-1218 — Deployment: Django backend on Render (+ managed Postgres), Next.js frontend on Vercel, first admin user created
- FEAT-20260822-1219 — README: admin login instructions, triggers built, env vars needed, known friction points, Task D plain-language answers

## In-Progress
- FEAT-20260822-1217 — Admin panel UI: trigger x channel table, template editor, toggles, test-send button, unauthorized page (spec: docs/specs/FEAT-20260822-1217-admin-panel-ui.md)

## Done
- FEAT-20260822-1216 — Website pages: login/logout pages that fire triggers, post-login Web Push subscribe flow (OneSignal) (spec: docs/specs/FEAT-20260822-1216-website-pages.md) [2026-08-22 19:56]
- FEAT-20260822-1215 — Frontend foundation: Next.js app skeleton with (website) and (admin) route groups, shared API client, auth handling (spec: docs/specs/FEAT-20260822-1215-frontend-foundation.md) [2026-08-22 19:34]
- FEAT-20260822-1214 — Admin API: CRUD for triggers/templates (upsert), toggle on/off, test-send, logs endpoints, IsAdminUser enforcement, CORS config (spec: docs/specs/FEAT-20260822-1214-admin-api.md) [2026-08-22 18:51]
- FEAT-20260822-1213 — Notifications core: Trigger/Template/NotificationLog/PushSubscription models, WhatsApp/Postmark/OneSignal adapters (ports & adapters pattern), fire_trigger() service layer (spec: docs/specs/FEAT-20260822-1213-notifications-core.md) [2026-08-22 18:47]
- FEAT-20260822-1212 — Backend foundation: Django project, custom User model, JWT login/logout/refresh (access token in body, refresh token in httpOnly cookie), Docker + docker-compose for local dev (spec: docs/specs/FEAT-20260822-1212-backend-foundation.md) [2026-08-22 18:24]
- BUG-20260822-1234 — Refresh token not invalidated on logout/refresh (session fixation risk), and logout's cookie-clear used Django's delete_cookie() which has no `secure` param and silently fails to clear a SameSite=None cookie in browsers. Found by automated security review of FEAT-20260822-1212's commit. Fixed: added rest_framework_simplejwt.token_blacklist, refresh tokens now rotate + blacklist the used token on every /refresh/ and /logout/ call, and cookie clearing uses set_cookie(max_age=0, ...) with matching flags instead of delete_cookie(). [2026-08-22 18:34]
