from rest_framework import serializers

from .models import NotificationLog, Template, Trigger


class TemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Template
        fields = [
            "id",
            "channel",
            "is_active",
            "subject",
            "body",
            "wa_template_name",
            "wa_language_code",
            "wa_approval_status",
            "wa_variable_mapping",
        ]


class TriggerSerializer(serializers.ModelSerializer):
    templates = serializers.SerializerMethodField()

    class Meta:
        model = Trigger
        fields = ["id", "key", "display_name", "description", "is_active", "created_at", "templates"]

    def get_templates(self, trigger):
        by_channel = {t.channel: t for t in trigger.templates.all()}
        return {
            channel: TemplateSerializer(by_channel[channel]).data if channel in by_channel else None
            for channel, _ in Template.CHANNEL_CHOICES
        }


class NotificationLogSerializer(serializers.ModelSerializer):
    trigger_key = serializers.CharField(source="trigger.key", default=None, read_only=True)

    class Meta:
        model = NotificationLog
        fields = [
            "id",
            "trigger_key",
            "channel",
            "recipient",
            "status",
            "provider_response",
            "error",
            "is_test",
            "created_at",
        ]
