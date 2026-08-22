from django.urls import path

from .views import (
    NotificationLogListView,
    TemplateToggleView,
    TemplateUpsertView,
    TestSendView,
    TriggerDetailView,
    TriggerListCreateView,
)

urlpatterns = [
    path("triggers/", TriggerListCreateView.as_view(), name="admin-trigger-list"),
    path("triggers/<int:pk>/", TriggerDetailView.as_view(), name="admin-trigger-detail"),
    path(
        "triggers/<int:trigger_id>/templates/<str:channel>/",
        TemplateUpsertView.as_view(),
        name="admin-template-upsert",
    ),
    path(
        "triggers/<int:trigger_id>/templates/<str:channel>/toggle/",
        TemplateToggleView.as_view(),
        name="admin-template-toggle",
    ),
    path(
        "triggers/<int:trigger_id>/templates/<str:channel>/test-send/",
        TestSendView.as_view(),
        name="admin-template-test-send",
    ),
    path("logs/", NotificationLogListView.as_view(), name="admin-notification-logs"),
]
