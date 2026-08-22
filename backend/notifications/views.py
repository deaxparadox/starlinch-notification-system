from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import NotificationLog, PushSubscription, Template, Trigger
from .serializers import NotificationLogSerializer, TemplateSerializer, TriggerSerializer
from .services import fire_trigger


class TriggerListCreateView(generics.ListCreateAPIView):
    queryset = Trigger.objects.prefetch_related("templates").order_by("id")
    serializer_class = TriggerSerializer
    permission_classes = [IsAdminUser]


class TriggerDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Trigger.objects.prefetch_related("templates")
    serializer_class = TriggerSerializer
    permission_classes = [IsAdminUser]


class TemplateUpsertView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, trigger_id, channel):
        trigger = get_object_or_404(Trigger, pk=trigger_id)
        template, _ = Template.objects.get_or_create(trigger=trigger, channel=channel)
        serializer = TemplateSerializer(template, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class TemplateToggleView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, trigger_id, channel):
        trigger = get_object_or_404(Trigger, pk=trigger_id)
        template, _ = Template.objects.get_or_create(trigger=trigger, channel=channel)
        template.is_active = bool(request.data.get("is_active"))
        template.save(update_fields=["is_active"])
        return Response(TemplateSerializer(template).data)


class TestSendView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, trigger_id, channel):
        trigger = get_object_or_404(Trigger, pk=trigger_id)
        recipient = request.data.get("recipient", "")
        if not recipient:
            return Response({"detail": "recipient is required"}, status=400)

        result = fire_trigger(
            trigger.key,
            user=None,
            context={},
            is_test=True,
            override_recipient=recipient,
            override_channel=channel,
        )
        return Response(result)


class PushSubscriptionView(APIView):
    """Not an admin endpoint - any logged-in user can register their browser's OneSignal
    subscription id against their own account."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        player_id = request.data.get("onesignal_player_id", "")
        if not player_id:
            return Response({"detail": "onesignal_player_id is required"}, status=400)

        # A client-supplied player_id is untrusted input - nothing proves the requester's
        # browser actually owns this OneSignal subscription. Refuse to reassign a subscription
        # that already belongs to a DIFFERENT user (that would silently redirect their future
        # notifications to this requester and break their subscription). Creating a brand-new
        # row, or re-registering one this same user already owns, is still allowed.
        existing = PushSubscription.objects.filter(onesignal_player_id=player_id).first()
        if existing and existing.user_id != request.user.id:
            return Response(
                {"detail": "This push subscription is already registered to a different account."},
                status=409,
            )

        PushSubscription.objects.update_or_create(
            onesignal_player_id=player_id, defaults={"user": request.user}
        )
        return Response(status=204)


class StatsView(APIView):
    """Aggregate numbers for the admin Overview page. Test sends (is_test=True) are excluded from
    every count here - a "test" button click isn't real activity and would misrepresent it."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        today = timezone.localdate()
        real_logs_today = NotificationLog.objects.filter(is_test=False, created_at__date=today)
        recent = NotificationLog.objects.filter(is_test=False).select_related("trigger").order_by(
            "-created_at"
        )[:5]

        return Response(
            {
                "sent_today": real_logs_today.filter(status="sent").count(),
                "failed_today": real_logs_today.filter(status="failed").count(),
                "active_triggers": Trigger.objects.filter(is_active=True).count(),
                "total_triggers": Trigger.objects.count(),
                "recent": NotificationLogSerializer(recent, many=True).data,
            }
        )


class NotificationLogListView(generics.ListAPIView):
    serializer_class = NotificationLogSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = NotificationLog.objects.select_related("trigger").order_by("-created_at")
        trigger_key = self.request.query_params.get("trigger")
        channel = self.request.query_params.get("channel")
        status = self.request.query_params.get("status")
        if trigger_key:
            qs = qs.filter(trigger__key=trigger_key)
        if channel:
            qs = qs.filter(channel=channel)
        if status:
            qs = qs.filter(status=status)
        return qs
