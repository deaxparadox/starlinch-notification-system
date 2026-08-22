from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import NotificationLog, Template, Trigger
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
