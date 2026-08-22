from django.conf import settings
from django.db import models


class Trigger(models.Model):
    key = models.SlugField(unique=True)  # e.g. "login", "logout"
    display_name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)  # global kill switch for the row
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.key


class Template(models.Model):
    CHANNEL_CHOICES = [("whatsapp", "WhatsApp"), ("email", "Email"), ("webpush", "Web Push")]

    trigger = models.ForeignKey(Trigger, related_name="templates", on_delete=models.CASCADE)
    channel = models.CharField(max_length=10, choices=CHANNEL_CHOICES)
    is_active = models.BooleanField(default=False)  # per-cell toggle

    # --- Email / WebPush fields (Django template syntax, free-form) ---
    subject = models.CharField(max_length=200, blank=True)  # email only
    body = models.TextField(blank=True)  # {{ name }}, {% if %} etc.

    # --- WhatsApp-specific fields (positional, Meta-approved) ---
    wa_template_name = models.CharField(max_length=100, blank=True)  # Meta-registered name
    wa_language_code = models.CharField(max_length=10, default="en_US")
    wa_approval_status = models.CharField(
        max_length=10,
        choices=[("pending", "Pending"), ("approved", "Approved"), ("rejected", "Rejected")],
        default="pending",
    )
    wa_variable_mapping = models.JSONField(default=list)  # ordered: ["user.name", "trigger.date"]

    class Meta:
        unique_together = ("trigger", "channel")

    def __str__(self):
        return f"{self.trigger.key}/{self.channel}"


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
