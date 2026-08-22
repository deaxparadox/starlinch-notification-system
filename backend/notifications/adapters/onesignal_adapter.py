import requests
from django.conf import settings

from ..ports import AdapterNotConfigured, NotificationPort, RenderedMessage

ONESIGNAL_URL = "https://onesignal.com/api/v1/notifications"


class OneSignalWebPushAdapter(NotificationPort):
    def send(self, *, recipient: str, message: RenderedMessage) -> dict:
        if not settings.ONESIGNAL_APP_ID or not settings.ONESIGNAL_REST_API_KEY:
            raise AdapterNotConfigured("ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY not set")

        payload = {
            "app_id": settings.ONESIGNAL_APP_ID,
            # OneSignal renamed "player_id" to "subscription_id" at the API level; the recipient
            # here is a PushSubscription.onesignal_player_id value, same underlying concept.
            "include_subscription_ids": [recipient],
            "headings": {"en": message.subject or " "},
            "contents": {"en": message.body},
        }
        response = requests.post(
            ONESIGNAL_URL,
            json=payload,
            headers={"Authorization": f"Key {settings.ONESIGNAL_REST_API_KEY}"},
            timeout=8,
        )
        response.raise_for_status()
        return response.json()
