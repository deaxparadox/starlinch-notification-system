FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Real env vars (DJANGO_SECRET_KEY, DATABASE_URL, etc.) are injected by Render at container
# RUNTIME, not available during this build step. collectstatic never touches the database or
# serves a request, so these throwaway values just need to satisfy settings.py's fail-fast
# checks for this one command - they aren't baked into the image's persistent environment.
RUN DJANGO_SECRET_KEY=build-time-only-unused-at-runtime \
    DJANGO_ALLOWED_HOSTS=localhost \
    DATABASE_URL=postgres://user:pass@localhost:5432/build \
    CORS_ALLOWED_ORIGINS=http://localhost \
    python manage.py collectstatic --noinput

# Render sets $PORT at runtime (default 10000) - the container must bind to it, not a
# hardcoded port. Migrations run on every container start: safe here since this is a single
# free-tier instance, not a multi-replica deploy.
EXPOSE 10000
CMD ["./docker-entrypoint.sh"]
