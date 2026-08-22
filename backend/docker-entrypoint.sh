#!/bin/sh
set -e

python manage.py migrate --noinput

# exec replaces this shell process with gunicorn, so it receives signals (e.g. Render's SIGTERM
# on deploy/restart) directly instead of them going to an intermediary shell.
exec gunicorn config.wsgi:application --bind "0.0.0.0:${PORT:-10000}"
