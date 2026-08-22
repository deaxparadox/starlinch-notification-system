import requests
from django.conf import settings

from ..ports import AdapterNotConfigured, NotificationPort, RenderedMessage

POSTMARK_URL = "https://api.postmarkapp.com/email"


class PostmarkEmailAdapter(NotificationPort):
    def send(self, *, recipient: str, message: RenderedMessage) -> dict:
        if not settings.POSTMARKAPP_TOKEN or not settings.POSTMARK_FROM_EMAIL:
            raise AdapterNotConfigured("POSTMARKAPP_TOKEN / POSTMARK_FROM_EMAIL not set")

        payload = {
            "From": settings.POSTMARK_FROM_EMAIL,
            "To": recipient,
            "Subject": message.subject,
            "HtmlBody": message.body,
            "TextBody": message.body,
        }
        response = requests.post(
            POSTMARK_URL,
            json=payload,
            headers={
                "X-Postmark-Server-Token": settings.POSTMARKAPP_TOKEN,
                "Accept": "application/json",
            },
            timeout=8,
        )
        response.raise_for_status()
        return response.json()
