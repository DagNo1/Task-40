#!/usr/bin/env sh
set -eu

echo "[backend] waiting for database migrations to apply..."

ATTEMPTS=0
MAX_ATTEMPTS=30

until npx prisma migrate deploy; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
    echo "[backend] prisma migrate deploy failed after $MAX_ATTEMPTS attempts"
    exit 1
  fi

  echo "[backend] migration attempt $ATTEMPTS failed; retrying in 2s"
  sleep 2
done

echo "[backend] migrations applied; starting API"
exec npm run start
