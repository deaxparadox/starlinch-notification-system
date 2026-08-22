from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    phone_number = models.CharField(max_length=20, blank=True)  # E.164, used for WhatsApp sends
    last_seen_at = models.DateTimeField(null=True, blank=True)
