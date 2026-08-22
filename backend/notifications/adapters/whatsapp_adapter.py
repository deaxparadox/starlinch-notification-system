import requests
from django.conf import settings

from ..ports import AdapterNotConfigured, NotificationPort, RenderedMessage


class WhatsAppCloudAdapter(NotificationPort):
    def send(self, *, recipient: str, message: RenderedMessage) -> dict:
        if not settings.WHATSAPP_ACCESS_TOKEN or not settings.PHONE_NUMBER_ID:
            raise AdapterNotConfigured("WHATSAPP_ACCESS_TOKEN / PHONE_NUMBER_ID not set")

        url = f"https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}/{settings.PHONE_NUMBER_ID}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": recipient,
            "type": "template",
            "template": {
                "name": message.template_name,
                "language": {"code": message.language_code},
                "components": [
                    {
                        "type": "body",
                        "parameters": [{"type": "text", "text": str(v)} for v in message.variables],
                    }
                ],
            },
        }
        response = requests.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}"},
            timeout=8,
        )
        response.raise_for_status()
        return response.json()
