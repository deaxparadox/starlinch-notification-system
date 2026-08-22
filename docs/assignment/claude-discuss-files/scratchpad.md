# StarClinch Backend Developer Assignment — Discussion Log (CURRENT / VERIFIED)

Last updated: 2026-08-22 (post staleness pass)
Format: sequential log of everything discussed, in order. This is the FINAL, corrected version of
each decision — where later discussion changed an earlier decision, only the final version is kept
here (superseded content removed rather than left contradicting itself). See architecture-flows.md
for the connected end-to-end flow trace and bug fixes found by tracing those flows.

## Status Legend
- [ ] To Do  [~] In Progress  [x] Completed

---

## 1. Context (completed)
- Candidate: Strong Django (production) + Strong React/Next.js. Blank slate, no repo yet.
- Time budget: "2 days" per assignment doc, not to be treated as a hard constraint on quality.

## 2. Background job / async architecture (completed)
Rejected, in order: django-q2 (needs persistent qcluster worker — Render free tier has no
Background Worker service type), Django Channels (needs separate runworker process + Redis, trades
away delivery guarantees per Channels' own docs, solves WebSocket problems not "call 3 APIs without
blocking"), third FastAPI service w/ sqlacodegen reflecting Django's DB (one-shot snapshot, not live
sync — schema drift risk; two connection pools/deploys; assignment asks for ONE Django backend).

**DECISION: synchronous Django views + `concurrent.futures.ThreadPoolExecutor`** (3 workers) fire
WhatsApp/Email/WebPush in parallel inside the same request/response cycle. No separate process, no
Redis, works on Render free Web Service. Failures logged to NotificationLog, never block the primary
action (login always succeeds regardless of notification outcome).

**Refined further (see arch-flows doc for full trace)**: no artificial OUTER timeout on the thread
batch — each adapter's own `requests.post(..., timeout=8)` is already a sufficient, real bound; every
thread finishes within ~8s on its own. `close_old_connections()` (from `django.db`) called at the
start of each thread's DB write, Django's standard pattern for DB access from non-request threads —
avoids connection issues if a thread's write happens after the HTTP response already returned.

## 3. Frontend architecture (completed)
Single Next.js app. Route groups `(website)` and `(admin)` — no URL segment added, each gets its own
layout.tsx (different nav/auth needs) while staying one deployable app. Shared code (API client,
types, UI primitives) in `lib/`.

## 4. Trigger design (completed)
Fully dynamic — no hardcoded Python enum/choices of trigger keys anywhere. Admin creates Trigger
rows (key, display name, templates, toggles) via UI; developer separately writes
`fire_trigger("login", user=...)` at the relevant code call site. DB row is the source of truth for
"what does this send"; code only needs the string key (loose coupling) — mirrors Segment/Braze/
OneSignal's register-then-instrument pattern.
- `fire_trigger()` must NEVER throw if the key doesn't exist or is inactive — log a warning, return
  silently. Notification absence/failure must never break the user-facing action.
- Explicitly rejected: any "is this trigger referenced in code" tooling (static analysis/AST
  scanning) — that's a code-review-time concern (grep/read the code), not a runtime feature.

## 5. Template engine & variable mapping (completed)
Django's real template engine ({% if %}, {{ var }}) for Email/WebPush free-text body. Context dict
whitelisted per-trigger, never raw model instances (injection safety).

WhatsApp is structurally different (confirmed via Meta Cloud API docs): requires Meta-side template
approval before sending outside the 24h customer window (mandatory in that case; approval up to 24h,
sandbox may be faster); variables are POSITIONAL (`{{1}}`, `{{2}}`), not named; send payload is
`POST /{phone_number_id}/messages`, `type="template"`, `template.name` (Meta-approved), 
`template.language.code`, `template.components[]` with ordered params. Schema: WhatsApp Template
fields (`wa_template_name`, `wa_language_code`, `wa_approval_status`, ordered `wa_variable_mapping`)
are distinct from Email/WebPush's free-text body — not forced into one shape.

## 6. Auth approach (completed, FINAL — supersedes earlier "just JWT" framing)
JWT overall (Vercel frontend / Render backend are separate domains — cross-domain session cookies
don't fit as cleanly). Storage split, confirmed as the correct industry pattern, not a shortcut:
- **Access token: in-memory only** (React state/context, never persisted) — gone on refresh, so XSS
  can't read a persisted copy.
- **Refresh token: httpOnly cookie** — unreadable by JS at all; browser sends it automatically.
- Requires `CORS_ALLOW_CREDENTIALS = True` (Django) + `credentials: "include"` (frontend fetches) +
  correct `SameSite`/`Secure` cookie flags for the cross-domain Vercel<->Render setup.

## 7. Postmark / OneSignal content-ownership approach (completed)
Raw send, not provider-hosted templates. Postmark: use `POST /email` (raw Subject/HtmlBody/TextBody
authored in OUR admin, rendered via Django's template engine), NOT `POST /email/withTemplate` (would
mean editing content in Postmark's own dashboard — contradicts "admin manages all notifications from
one screen" and Task D's explicit question about this). Same principle for Web Push: compose in our
admin, push raw title/body via OneSignal's REST send API, no OneSignal-side template authoring.

## 8. DB Schema (completed)

```python
# notifications/models.py

class Trigger(models.Model):
    key = models.SlugField(unique=True)          # e.g. "login", "logout"
    display_name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)  # global kill switch for the row
    created_at = models.DateTimeField(auto_now_add=True)


class Template(models.Model):
    CHANNEL_CHOICES = [("whatsapp", "WhatsApp"), ("email", "Email"), ("webpush", "Web Push")]

    trigger = models.ForeignKey(Trigger, related_name="templates", on_delete=models.CASCADE)
    channel = models.CharField(max_length=10, choices=CHANNEL_CHOICES)
    is_active = models.BooleanField(default=False)  # per-cell toggle

    # --- Email / WebPush fields (Django template syntax, free-form) ---
    subject = models.CharField(max_length=200, blank=True)   # email only
    body = models.TextField(blank=True)                      # {{ name }}, {% if %} etc.

    # --- WhatsApp-specific fields (positional, Meta-approved) ---
    wa_template_name = models.CharField(max_length=100, blank=True)   # Meta-registered name
    wa_language_code = models.CharField(max_length=10, default="en_US")
    wa_approval_status = models.CharField(
        max_length=10,
        choices=[("pending", "Pending"), ("approved", "Approved"), ("rejected", "Rejected")],
        default="pending",
    )
    wa_variable_mapping = models.JSONField(default=list)  # ordered: ["user.name", "trigger.date"]

    class Meta:
        unique_together = ("trigger", "channel")  # one cell per trigger x channel


class NotificationLog(models.Model):
    trigger = models.ForeignKey(Trigger, on_delete=models.SET_NULL, null=True)
    channel = models.CharField(max_length=10, choices=Template.CHANNEL_CHOICES)
    recipient = models.CharField(max_length=255)  # email / phone / push subscription id
    status = models.CharField(max_length=10, choices=[("sent", "Sent"), ("failed", "Failed")])
    provider_response = models.JSONField(blank=True, null=True)
    error = models.TextField(blank=True)
    is_test = models.BooleanField(default=False)  # distinguishes "Test send" from real fires
    created_at = models.DateTimeField(auto_now_add=True)


class PushSubscription(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    onesignal_player_id = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

Rationale: Trigger/Template split maps directly to the admin table (rows=triggers,
columns=channels, cell=one Template row). NotificationLog gives Task C traceability/audit trail.
PushSubscription maps browser subscribers to users since OneSignal targets a player_id.
Deferred: WhatsApp attachments/media headers — text-only for v1.

## 9. User model (completed — merged with former section 12)
**Custom AUTH_USER_MODEL from day one** (extend AbstractUser) — correct timing since swapping later
requires rewriting every FK pointing to User, and Template test-sends/NotificationLog/
PushSubscription already reference users.

```python
# accounts/models.py
class User(AbstractUser):
    phone_number = models.CharField(max_length=20, blank=True)  # WhatsApp sends, E.164 format
    last_seen_at = models.DateTimeField(null=True, blank=True)  # kept on model even though
                                                                  # inactivity triggers are OUT of
                                                                  # scope — harmless to keep.
```
`AUTH_USER_MODEL = "accounts.User"`. phone_number lives directly on User (not a separate Profile).

Confirmed (see arch-flows doc): `python manage.py createsuperuser` works completely normally with
this custom model — `USERNAME_FIELD`/`REQUIRED_FIELDS` are inherited unchanged from AbstractUser, no
extra work needed. Run once via Render's Shell tab against deployed Postgres; document credentials
in README per the assignment's explicit "how to log in as admin" requirement.

## 10. Trigger scope — FINAL (completed)
Time-based triggers ("not logged in 1 day/week") need a SCHEDULER — something periodically checking
"who's been inactive N days" and calling fire_trigger() on their behalf. This is independent of
sync-vs-async sending (sync only governs how ONE fire executes, not what decides to trigger it).
Confirmed: Render Cron Jobs are PAID-ONLY (no free tier, same wall as Background Workers). A
workaround exists (external cron-ping service) but is fragile for a 2-day assignment demo.

**FINAL DECISION: scope to INSTANT/event-based triggers only — Login and Logout.** Inactivity
triggers explicitly OUT OF SCOPE. Reason: this is an interview assignment, not production — better
to clearly document the architectural limitation (no free-tier scheduler on Render) in README than
hack around it with a fragile external-ping workaround. Call this out explicitly in README's
"what we built vs what we'd need for the rest" section — doubles as strong Task D material.

## 11. Django app structure + API endpoints (completed)

```
backend/
├── config/                 # project settings, urls, wsgi/asgi
├── accounts/                # custom User model, JWT auth views
├── notifications/           # Trigger, Template, NotificationLog, PushSubscription
│   ├── models.py
│   ├── serializers.py
│   ├── views.py             # admin CRUD + test-send
│   ├── services.py          # fire_trigger(), _send_one(), _render(), _resolve_recipient()
│   ├── ports.py              # NotificationPort ABC, RenderedMessage dataclass
│   ├── adapters/              # whatsapp_adapter.py, postmark_adapter.py, onesignal_adapter.py
│   └── urls.py
└── website/                  # demo trigger call sites (login/logout views)
```

Endpoints:
- Auth: `POST /api/auth/login/` (fires Trigger "login", returns access token + sets refresh
  httpOnly cookie), `POST /api/auth/logout/` (fires "logout"), `POST /api/auth/refresh/`
- Admin Triggers: `GET/POST /api/admin/triggers/`, `PATCH/DELETE /api/admin/triggers/{id}/`
- Admin Templates: `PATCH /api/admin/triggers/{trigger_id}/templates/{channel}/` (upsert —
  MUST use get_or_create given unique_together, not plain create), `PATCH .../toggle/` (on/off),
  `POST .../test-send/` (Task A/B/C — accepts `{recipient, is_test: true}`, see section 13)
- Push subscribe: `POST /api/webpush/subscribe/` `{onesignal_player_id}` — auth required, called
  AFTER login succeeds (not on anonymous page load — OneSignal player_id has nowhere to attach
  without a logged-in user)
- Logs: `GET /api/admin/logs/?trigger=login&channel=email`

**Serializer decision**: `GET /api/admin/triggers/` always returns all 3 channel keys
(whatsapp/email/webpush) per trigger, `null` for channels with no Template row yet — NOT only
existing rows. Keeps "fill the gaps" logic in ONE place (Django serializer) instead of duplicated in
both backend and frontend. Frontend just reads `trigger.templates.webpush` → null or object.

**Auth/authorization pattern (admin vs regular users)**: single login endpoint, JWT carries
`is_staff`. Django enforces `IsAdminUser` (or equivalent) on every `/api/admin/*` view — the REAL,
backend-enforced boundary, checked every request regardless of frontend behavior. Frontend has two
separate jobs: (1) at login, redirect staff→`/admin`, others→`/` (pure UX convenience); (2) on any
admin API call returning 403 (direct URL nav, demoted session, manual API poking), show an explicit
Unauthorized page/state — not a silent failure, not a redirect-to-login (user IS authenticated, just
not authorized — different case).

**CORS**: `CORS_ALLOWED_ORIGINS` as a comma-separated env var, split in Django settings:
`os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",")`. Must include exact Vercel URL + localhost
for dev. Missing this breaks EVERY frontend feature at once (total failure, not partial) since every
API call crosses the Vercel→Render origin boundary.

## 12. Hexagonal architecture (Ports & Adapters) — scoped adoption (completed)
Researched before committing — found and weighed a real counter-opinion (a Django-specific
experiment concluding "Django is built around Active Record... the boundary should be built around
services, not storage," recommending vertical-slice as more Django-idiomatic instead). Full
hexagonal purity (wrapping Trigger/Template ORM access in repository ports too) would be real added
indirection with no practical payoff for a 2-day assignment on a DB backend that will never change.

**DECISION: scoped adoption** — ports & adapters ONLY at the notification-sending boundary
(WhatsApp/Postmark/OneSignal), which hexagonal literature names as a strong fit ("business logic
interacts with multiple evolving external integration points"). Did NOT wrap Trigger/Template ORM
access in repository ports.

- `NotificationPort` ABC: one abstract method `send(self, *, recipient, message: RenderedMessage) -> dict`
- `RenderedMessage` dataclass: channel-agnostic rendered shape (subject/body for email/webpush;
  template_name/language_code/variables for WhatsApp)
- Three adapters implementing the port: `WhatsAppCloudAdapter`, `PostmarkEmailAdapter`,
  `OneSignalWebPushAdapter` — each owns exactly one provider's request/auth quirks
- `services.py` imports NOTHING from `requests` or provider SDKs directly — only calls
  `adapter.send(...)` through the port. `CHANNEL_ADAPTERS` dict is the single place mapping
  channel → concrete adapter instance; swapping providers later = new adapter class + one dict line,
  zero changes to orchestration logic.
- Concrete payoff: testability — a `FakeAdapter(NotificationPort)` can record calls in memory for
  unit-testing fire_trigger's branching/logging without real HTTP calls.

## 13. fire_trigger() service layer — FINAL, CORRECTED (completed)
This supersedes all earlier drafts. Incorporates fixes found by tracing connected flows
(architecture-flows.md) — the exception-inside-except bug, the redundant/misleading outer timeout,
and the missing test-send recipient override are all fixed here.

```python
# notifications/services.py
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from django.db import close_old_connections
from django.template import Context, Template as DjangoTemplate
from .models import Trigger, Template, NotificationLog
from .ports import NotificationPort, RenderedMessage
from .adapters.whatsapp_adapter import WhatsAppCloudAdapter
from .adapters.postmark_adapter import PostmarkEmailAdapter
from .adapters.onesignal_adapter import OneSignalWebPushAdapter

logger = logging.getLogger(__name__)

CHANNEL_ADAPTERS: dict[str, NotificationPort] = {
    "whatsapp": WhatsAppCloudAdapter(),
    "email": PostmarkEmailAdapter(),
    "webpush": OneSignalWebPushAdapter(),
}


def fire_trigger(trigger_key: str, *, user=None, context: dict, is_test: bool = False,
                  override_recipient: str | None = None, override_channel: str | None = None) -> dict:
    """Never raises. A missing/inactive trigger or a channel failure must never break the
    caller's primary action (login, logout, etc.).
    - Real trigger fires: user=<real User>, override_recipient=None (resolved from user).
    - Test sends: override_recipient=<admin-typed value>, user can be None; override_channel
      limits the send to just the one cell being tested (not all active channels)."""
    try:
        trigger = Trigger.objects.prefetch_related("templates").get(key=trigger_key, is_active=True)
    except Trigger.DoesNotExist:
        logger.warning("fire_trigger: no active trigger for key=%s", trigger_key)
        return {}

    templates = [t for t in trigger.templates.all() if t.is_active]
    if override_channel:
        templates = [t for t in templates if t.channel == override_channel]
    if not templates:
        logger.info("fire_trigger: trigger=%s has no active channel templates", trigger_key)
        return {}

    results = {}
    with ThreadPoolExecutor(max_workers=3) as pool:
        # NOTE: no outer as_completed(timeout=...) — each adapter's own requests timeout (8s)
        # is already a sufficient, real bound. An outer timeout only stops Django from WAITING
        # on a thread, it does NOT cancel the thread — so tuning it doesn't reduce actual work,
        # it just increases the chance of an orphaned thread outliving the HTTP response.
        future_to_template = {
            pool.submit(_send_one, t, user, context, is_test, override_recipient): t
            for t in templates
        }
        for future in as_completed(future_to_template):
            template = future_to_template[future]
            try:
                results[template.channel] = future.result()
            except Exception as e:
                logger.error("fire_trigger: unexpected error on channel=%s: %s", template.channel, e)
                results[template.channel] = {"status": "failed", "error": str(e)}
    return results


def _send_one(template: Template, user, context: dict, is_test: bool,
               override_recipient: str | None) -> dict:
    close_old_connections()  # safe DB access from a non-request thread (Django's standard pattern)

    adapter: NotificationPort = CHANNEL_ADAPTERS[template.channel]
    recipient = override_recipient or _resolve_recipient(template.channel, user)

    if not recipient:
        _log(template, "", "failed", is_test, error="no recipient")
        return {"status": "failed", "error": "no recipient"}

    message = _render(template, context)

    # Send and log are SEPARATE try blocks, deliberately — a log-write failure must never be
    # able to overwrite a successful send's result, and must never raise unhandled from inside
    # an except block (which would defeat the whole "never throw" guarantee).
    try:
        provider_response = adapter.send(recipient=recipient, message=message)
        send_ok = True
    except Exception as e:
        logger.error("send failed channel=%s trigger=%s: %s", template.channel, template.trigger.key, e)
        _log(template, recipient, "failed", is_test, error=str(e))
        return {"status": "failed", "error": str(e)}

    try:
        _log(template, recipient, "sent", is_test, provider_response=provider_response)
    except Exception as log_err:
        # send succeeded — never let a logging failure downgrade that fact or raise further
        logger.error("NotificationLog write failed (send succeeded) channel=%s: %s",
                     template.channel, log_err)
    return {"status": "sent"}


def _log(template, recipient, status, is_test, provider_response=None, error=""):
    NotificationLog.objects.create(
        trigger=template.trigger, channel=template.channel, recipient=recipient,
        status=status, provider_response=provider_response, error=error, is_test=is_test,
    )


def _render(template: Template, context: dict) -> RenderedMessage:
    if template.channel == "whatsapp":
        values = [context.get(field) for field in template.wa_variable_mapping]
        return RenderedMessage(template_name=template.wa_template_name,
                                language_code=template.wa_language_code, variables=values)
    subject = DjangoTemplate(template.subject).render(Context(context)) if template.subject else ""
    body = DjangoTemplate(template.body).render(Context(context))
    return RenderedMessage(subject=subject, body=body)


def _resolve_recipient(channel: str, user) -> str:
    """Only called for REAL trigger fires (user is not None). Test sends bypass this entirely
    via override_recipient."""
    if user is None:
        return ""
    if channel == "email":
        return user.email or ""
    if channel == "whatsapp":
        return user.phone_number or ""
    if channel == "webpush":
        sub = user.pushsubscription_set.first()
        return sub.onesignal_player_id if sub else ""
    return ""
```

Called from the login view:
```python
def login_view(request):
    # ... authenticate, issue access token + set refresh httpOnly cookie ...
    fire_trigger("login", user=user, context={"name": user.first_name, "login_time": timezone.now()})
    return Response({"access_token": token, ...})
```

Called from the admin Test Send endpoint:
```python
def test_send_view(request, trigger_id, channel):
    recipient = request.data["recipient"]  # admin-typed value from the UI
    fire_trigger(
        trigger_key=Trigger.objects.get(id=trigger_id).key,
        user=None, context={}, is_test=True,
        override_recipient=recipient, override_channel=channel,
    )
```

## 14. Provider sandbox setups (completed)

**WhatsApp Cloud API** (verified via Meta docs, Aug 2026):
1. Register as Meta developer, create app with WhatsApp use case (select "Connect with customers
   through WhatsApp" — requires creating/linking a Business Portfolio).
2. Add WhatsApp product → auto-generates test number (sandbox) + WABA ID.
3. Grab from API Setup panel: Temporary access token, Test number, Phone Number ID, WABA ID →
   `.env`: `WHATSAPP_ACCESS_TOKEN`, `PHONE_NUMBER_ID`.
4. Add own phone number as verified test recipient (sandbox can ONLY message verified numbers).
5. Send first test message via API Setup panel before touching code.
- Token expiry: "Temporary access token" is short-lived (~1-2h); don't hardcode expiry assumptions,
  expect to regenerate periodically during the build window (matches assignment doc's own warning).
- **KNOWN BLOCKER hit during execution**: "Your Facebook account is too new to create a business
  account. Try again in an hour" — a genuine Meta anti-abuse restriction tied to the AGE of the
  personal Facebook account, not a setup mistake. Real-world reports: ~1h to 24-72h to clear. Advice
  given: don't retry repeatedly in a short window; use the account normally for a while; retry from
  the SAME device/network; avoid VPN/device-switching workarounds (makes it worse); if a much older
  personal FB account is available, prefer that over a fresh one. Purely a waiting problem, not a
  design gap — all code/schema/setup steps are fully specified regardless.

**Postmark** (verified via Postmark docs, Aug 2026):
1. Sign up at postmarkapp.com, free Developer plan (200 emails free).
2. Confirm Sender Signature via auto-sent verification email → `POSTMARK_FROM_EMAIL`.
3. **Request account approval** (not mentioned in assignment doc) — manual review, ~24h typical
   turnaround, requires stating expected volume/use case. Until approved, can only send to addresses
   OUTSIDE the verified domain restricted — but sending to the verified Sender Signature address
   itself works immediately, covering Task A/B test-send needs pre-approval.
4. Grab Server API Token (Server > API Tokens) → `POSTMARKAPP_TOKEN`.
- **Timeline risk**: ~24h approval is a meaningful chunk of a 2-day window. Recommendation: do
  Postmark signup + request approval FIRST, before starting the Django build, so it processes in the
  background rather than blocking end-to-end testing later.

**OneSignal** (verified via OneSignal docs, Aug 2026): no approval wait, no account-age gate — the
smooth one. Forever-free plan, up to 10,000 web push recipients per message.
1. Sign up, create app/org.
2. Create a website app, **channel = Web Push** (skip Android/iOS/Email/SMS/In-App — matches
   assignment's "Web Push only" instruction; Email is already Postmark's job).
3. Configure site URL — localhost:3000 for dev, add real Vercel URL as second Site origin post-deploy.
4. Grab `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY` from Settings > Keys & IDs.
5. Frontend: install OneSignal Web SDK for browser subscribe/permission-prompt flow. On subscribe,
   SDK yields a player_id → POST to `/api/webpush/subscribe/` → stored as `PushSubscription`.
- **Flagged for README/demo**: users CANNOT subscribe to web push in incognito/private browsing mode
  (confirmed via OneSignal docs) — note this so a grader testing in incognito doesn't mistake it for
  a bug.
- **Sequencing requirement**: subscribe-prompt must trigger AFTER successful login, not on app
  mount for anonymous visitors — the player_id has no `user` to attach to otherwise (traced in
  architecture-flows.md Flow 3).

## 15. Next.js app structure (completed)

```
frontend/
├── app/
│   ├── (website)/                  # public site — route group, own layout
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── login/page.tsx
│   │   └── logout/
│   ├── (admin)/                    # admin panel — separate route group, own layout
│   │   ├── layout.tsx              # auth guard + Unauthorized handling lives here
│   │   └── admin/
│   │       ├── page.tsx            # the ONE table: triggers x channels
│   │       └── triggers/[id]/page.tsx
│   ├── api/                        # only if a BFF-style proxy is genuinely needed
│   └── layout.tsx
├── lib/
│   ├── api-client.ts                # fetch wrapper, attaches access token, credentials:"include"
│   │                                 # for refresh cookie, throws typed FORBIDDEN on 403
│   ├── types.ts                     # Trigger, Template, NotificationLog TS types (mirror
│   │                                 # Django serializers)
│   ├── auth.ts                      # in-memory access token store + refresh-cookie flow
│   └── onesignal.ts                 # Web Push SDK init + subscribe helper (called post-login only)
├── components/
│   ├── website/                     # LoginForm etc
│   └── admin/                       # TriggerTable, TemplateEditorModal, ToggleSwitch,
│                                     # TestSendButton, UnauthorizedPage
└── .env.local
```

Login button needs an explicit loading state ("Logging in...") that visually accounts for
multi-second waits — the sync-send design (section 2) means login latency is DB auth + JWT +
up to ~8s of parallel external API calls, not a snappy sub-second response. Without this, a slow
login could look broken during grading/demo rather than intentional.

## 16. Docker + local dev (completed)
Render does NOT run docker-compose in production — builds/runs services independently (per-service
Dockerfile supported, multi-service compose is not); Vercel has its own Next.js build pipeline, not
Docker-based. docker-compose's role is LOCAL DEV PARITY only (one command: Django + Postgres
together), not the production deploy mechanism. Confirmed with user: this DOES replicate ~90% of
logical behavior (same migrations/ORM/app code) but does NOT replicate Render-specific runtime
constraints (free-tier cold starts, absence of worker/cron service, Render's env injection) — which
is exactly why the architecture was designed around those constraints directly rather than assuming
local parity would carry over.

**DECISION**: Django backend gets a `Dockerfile` (usable directly by Render as a Docker-based Web
Service, AND in local docker-compose). `docker-compose.yml` at repo root: django + postgres (+
optionally Mailhog for local email testing without hitting real Postmark). Next.js: no Docker needed
for Vercel; optional Dockerfile only for full local-parity if desired.

## 17. Working agreement (completed)
Implementation is handled by a separate Claude Code session, using this scratchpad + 
architecture-flows.md as the spec/context. This thread does not write further scratchpad-adjacent
files unless explicitly requested. No further code changes will be made directly in this thread —
corrections found here (e.g. section 13's fire_trigger rewrite) are design corrections to hand
forward, not live-edited application code.

---

## Remaining work (current, as of this pass)
- [ ] ACTUAL CODE — handed to Claude Code. This file + architecture-flows.md + handoff doc (see
      below) are the complete spec.
- [ ] Dockerfile (Django) + docker-compose.yml (Django + Postgres, local dev)
- [ ] Deployment: Render (Django via Dockerfile + managed Postgres) + Vercel (Next.js) — env var
      list finalized in the handoff document (.env.example)
- [ ] README — must cover: how to log in as admin (createsuperuser via Render Shell), which triggers
      built (Login/Logout only + why inactivity triggers are out of scope), full env var list, known
      friction points (Postmark ~24h approval, WhatsApp Meta business-account-age gate, OneSignal
      incognito limitation), Task D plain-language answers, JWT storage approach (access in-memory +
      refresh httpOnly cookie) as a talking point
- [ ] WhatsApp: blocked on Meta's business-account-age restriction — waiting problem, not a design
      problem. Proceed with everything else using placeholder .env values; swap in real values when
      cleared, no code changes needed.
- [ ] Submission checklist: GitHub repo(s), live Render URL, live Vercel URL — not started, comes
      after implementation + deployment.

## Open Questions for User
(none currently pending)
