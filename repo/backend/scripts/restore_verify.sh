#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "usage: restore_verify.sh <backup-file.sql>"
  exit 1
fi

BACKUP_FILE=$1
START=$(date +%s)

sh "$(dirname "$0")/restore.sh" "$BACKUP_FILE"

USER_COUNT=$(psql "$DATABASE_URL" -tAc 'SELECT COUNT(*) FROM "User"')
END=$(date +%s)
DURATION=$((END - START))

echo "restore-verification:user-count=$USER_COUNT"
echo "restore-verification:duration-seconds=$DURATION"

if [ "$DURATION" -le 7200 ]; then
  echo "restore-verification:PASS (<=2h)"
else
  echo "restore-verification:FAIL (>2h)"
  exit 1
fi
