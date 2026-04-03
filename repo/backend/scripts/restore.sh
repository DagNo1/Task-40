#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "usage: restore.sh <backup-file.sql>"
  exit 1
fi

BACKUP_FILE=$1
psql "$DATABASE_URL" < "$BACKUP_FILE"

echo "restore-complete:$BACKUP_FILE"
