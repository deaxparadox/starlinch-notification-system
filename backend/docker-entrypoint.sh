#!/bin/sh
set -e

python manage.py migrate --noinput

# Render's free tier has no Shell/SSH access, so there's no way to run `createsuperuser`
# interactively after deploy. If these three vars are set, bootstrap the first admin here instead.
# Existence-checked (not try/catch), so it's safe to leave them set across every restart/redeploy -
# it creates the account once, then just logs that it's skipping on every run after that.
if [ -n "$DJANGO_SUPERUSER_USERNAME" ]; then
  python manage.py shell -c "
import os
from django.contrib.auth import get_user_model

User = get_user_model()
username = os.environ['DJANGO_SUPERUSER_USERNAME']

if User.objects.filter(username=username).exists():
    print(f'Superuser \"{username}\" already exists, skipping.')
else:
    User.objects.create_superuser(
        username,
        os.environ['DJANGO_SUPERUSER_EMAIL'],
        os.environ['DJANGO_SUPERUSER_PASSWORD'],
    )
    print(f'Created superuser \"{username}\".')
"
fi

# exec replaces this shell process with gunicorn, so it receives signals (e.g. Render's SIGTERM
# on deploy/restart) directly instead of them going to an intermediary shell.
exec gunicorn config.wsgi:application --bind "0.0.0.0:${PORT:-10000}"
