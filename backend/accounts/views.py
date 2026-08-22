from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from notifications.services import fire_trigger

from .serializers import UserSerializer


def _set_refresh_cookie(response, refresh_token: str):
    response.set_cookie(
        key=settings.JWT_REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=settings.JWT_REFRESH_TOKEN_LIFETIME_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=settings.JWT_REFRESH_COOKIE_SECURE,
        samesite=settings.JWT_REFRESH_COOKIE_SAMESITE,
    )


def _clear_refresh_cookie(response):
    # Django's HttpResponse.delete_cookie() has no `secure` param, so it can't reproduce the
    # Secure flag the cookie was set with. When SameSite=None (required for the cross-domain
    # Vercel<->Render cookie), browsers silently ignore a Set-Cookie header that lacks Secure —
    # so delete_cookie() would leave the old cookie in place instead of clearing it. Overwriting
    # via set_cookie() with max_age=0 and the same flags it was set with clears it reliably.
    response.set_cookie(
        key=settings.JWT_REFRESH_COOKIE_NAME,
        value="",
        max_age=0,
        httponly=True,
        secure=settings.JWT_REFRESH_COOKIE_SECURE,
        samesite=settings.JWT_REFRESH_COOKIE_SAMESITE,
    )


def _blacklist_if_present(raw_refresh: str | None):
    """Best-effort: invalidate the refresh token so a copy of it can't be replayed later.
    Never raises — an already-expired/invalid/missing token has nothing to invalidate."""
    if not raw_refresh:
        return
    try:
        RefreshToken(raw_refresh).blacklist()
    except TokenError:
        pass


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username", "")
        password = request.data.get("password", "")
        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response({"detail": "Invalid credentials."}, status=401)

        refresh = RefreshToken.for_user(user)
        fire_trigger("login", user=user, context={"name": user.first_name or user.username})
        response = Response({"access_token": str(refresh.access_token), "user": UserSerializer(user).data})
        _set_refresh_cookie(response, str(refresh))
        return response


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        if request.user.is_authenticated:
            fire_trigger(
                "logout",
                user=request.user,
                context={"name": request.user.first_name or request.user.username},
            )
        _blacklist_if_present(request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME))
        response = Response(status=204)
        _clear_refresh_cookie(response)
        return response


class RefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw_refresh = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        if not raw_refresh:
            return Response({"detail": "No refresh token cookie."}, status=401)

        try:
            old_refresh = RefreshToken(raw_refresh)
        except TokenError as e:
            return Response({"detail": str(e)}, status=401)

        # Rotate: this refresh token is single-use. Issue a brand-new refresh + access token pair
        # and blacklist the one just used, so a copied cookie stops working the moment either copy
        # is used once, rather than staying valid for its full lifetime.
        User = get_user_model()
        try:
            user = User.objects.get(pk=old_refresh["user_id"])
        except User.DoesNotExist:
            return Response({"detail": "User no longer exists."}, status=401)

        new_refresh = RefreshToken.for_user(user)
        old_refresh.blacklist()

        response = Response({"access_token": str(new_refresh.access_token)})
        _set_refresh_cookie(response, str(new_refresh))
        return response
