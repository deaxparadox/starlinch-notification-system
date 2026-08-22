from django.shortcuts import get_object_or_404
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

        # update_or_create, not get_or_create: onesignal_player_id is globally unique. If this
        # browser's subscription was previously tied to a different user (e.g. someone else
        # logged in here earlier), it now belongs to whoever is subscribing now.
        PushSubscription.objects.update_or_create(
            onesignal_player_id=player_id, defaults={"user": request.user}
        )
        return Response(status=204)


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
