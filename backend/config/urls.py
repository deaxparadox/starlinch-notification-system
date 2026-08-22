from django.contrib import admin
from django.urls import include, path

from notifications.views import PushSubscriptionView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/admin/", include("notifications.urls")),
    path("api/webpush/subscribe/", PushSubscriptionView.as_view(), name="webpush-subscribe"),
]
