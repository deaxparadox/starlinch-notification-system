from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class RenderedMessage:
    """Channel-agnostic rendered message. Email/WebPush use subject/body; WhatsApp uses the
    Meta-approved template name + positional variables instead of free text."""

    subject: str = ""
    body: str = ""
    template_name: str = ""
    language_code: str = ""
    variables: list = field(default_factory=list)


class AdapterNotConfigured(Exception):
    """Raised when a channel's provider credentials aren't set. Caught by _send_one and logged
    as a normal failed send — never crashes the request, just means this channel can't send yet."""


class NotificationPort(ABC):
    @abstractmethod
    def send(self, *, recipient: str, message: RenderedMessage) -> dict:
        """Send the message to recipient. Returns the provider's response body.
        Raises on any non-2xx response or transport error."""
        raise NotImplementedError
