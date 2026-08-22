import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

from django.db import close_old_connections
from django.template import Context
from django.template import Template as DjangoTemplate

from .adapters.onesignal_adapter import OneSignalWebPushAdapter
from .adapters.postmark_adapter import PostmarkEmailAdapter
from .adapters.whatsapp_adapter import WhatsAppCloudAdapter
from .models import NotificationLog, Template, Trigger
from .ports import NotificationPort, RenderedMessage

logger = logging.getLogger(__name__)

CHANNEL_ADAPTERS: dict[str, NotificationPort] = {
    "whatsapp": WhatsAppCloudAdapter(),
    "email": PostmarkEmailAdapter(),
    "webpush": OneSignalWebPushAdapter(),
}


def fire_trigger(
    trigger_key: str,
    *,
    user=None,
    context: dict,
    is_test: bool = False,
    override_recipient: str | None = None,
    override_channel: str | None = None,
) -> dict:
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
        # No outer as_completed(timeout=...) — each adapter's own requests timeout (8s) is
        # already a sufficient, real bound. An outer timeout only stops Django from WAITING on
        # a thread, it does NOT cancel it — so tuning it doesn't reduce actual work, it just
        # increases the chance of an orphaned thread outliving the HTTP response.
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


def _send_one(
    template: Template, user, context: dict, is_test: bool, override_recipient: str | None
) -> dict:
    close_old_connections()  # safe DB access from a non-request thread (Django's standard pattern)

    recipients = [override_recipient] if override_recipient else _resolve_recipients(template.channel, user)

    if not recipients:
        _log(template, "", "failed", is_test, error="no recipient")
        return {"status": "failed", "error": "no recipient"}

    message = _render(template, context)
    errors = []
    for recipient in recipients:
        error = _send_to_one_recipient(template, recipient, message, is_test)
        if error:
            errors.append(error)

    if len(errors) == len(recipients):
        return {"status": "failed", "error": "; ".join(errors)}
    return {"status": "sent"}


def _send_to_one_recipient(template: Template, recipient: str, message: RenderedMessage, is_test: bool) -> str:
    """Sends to a single recipient and logs the result. Returns an error string on failure, "" on
    success — never raises, so one device's failure can't stop the others in the loop above."""
    adapter: NotificationPort = CHANNEL_ADAPTERS[template.channel]

    # Send and log are SEPARATE try blocks, deliberately — a log-write failure must never be
    # able to overwrite a successful send's result, and must never raise unhandled from inside
    # an except block (which would defeat the whole "never throw" guarantee).
    try:
        provider_response = adapter.send(recipient=recipient, message=message)
    except Exception as e:
        logger.error(
            "send failed channel=%s trigger=%s: %s", template.channel, template.trigger.key, e
        )
        _log(template, recipient, "failed", is_test, error=str(e))
        return str(e)

    try:
        _log(template, recipient, "sent", is_test, provider_response=provider_response)
    except Exception as log_err:
        # send succeeded — never let a logging failure downgrade that fact or raise further
        logger.error(
            "NotificationLog write failed (send succeeded) channel=%s: %s",
            template.channel,
            log_err,
        )
    return ""


def _log(template, recipient, status, is_test, provider_response=None, error=""):
    NotificationLog.objects.create(
        trigger=template.trigger,
        channel=template.channel,
        recipient=recipient,
        status=status,
        provider_response=provider_response,
        error=error,
        is_test=is_test,
    )


def _render(template: Template, context: dict) -> RenderedMessage:
    if template.channel == "whatsapp":
        values = [context.get(field) for field in template.wa_variable_mapping]
        return RenderedMessage(
            template_name=template.wa_template_name,
            language_code=template.wa_language_code,
            variables=values,
        )
    subject = DjangoTemplate(template.subject).render(Context(context)) if template.subject else ""
    body = DjangoTemplate(template.body).render(Context(context))
    return RenderedMessage(subject=subject, body=body)


def _resolve_recipients(channel: str, user) -> list[str]:
    """Only called for REAL trigger fires (user is not None). Test sends bypass this entirely
    via override_recipient. Web push fans out to every device the user has subscribed on —
    email/whatsapp only ever have one recipient (the account's single email/phone number), but
    a user can have many PushSubscription rows, one per browser/device, and a trigger should
    notify all of them, not an arbitrary one."""
    if user is None:
        return []
    if channel == "email":
        return [user.email] if user.email else []
    if channel == "whatsapp":
        return [user.phone_number] if user.phone_number else []
    if channel == "webpush":
        return list(user.pushsubscription_set.values_list("onesignal_player_id", flat=True))
    return []
