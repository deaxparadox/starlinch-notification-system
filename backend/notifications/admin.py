from django.contrib import admin

from .models import NotificationLog, PushSubscription, Template, Trigger


class TemplateInline(admin.TabularInline):
    model = Template
    extra = 0


@admin.register(Trigger)
class TriggerAdmin(admin.ModelAdmin):
    list_display = ("key", "display_name", "is_active", "created_at")
    inlines = [TemplateInline]


@admin.register(NotificationLog)
class NotificationLogAdmin(admin.ModelAdmin):
    list_display = ("trigger", "channel", "recipient", "status", "is_test", "created_at")
    list_filter = ("channel", "status", "is_test")


admin.site.register(PushSubscription)
