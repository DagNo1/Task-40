#!/usr/bin/env sh
set -eu

STAMP=$(date +%Y%m%d-%H%M%S)
OUT_DIR=${BACKUP_DIR:-/var/backups/sentineldesk}
mkdir -p "$OUT_DIR"

pg_dump "$DATABASE_URL" > "$OUT_DIR/sentineldesk-$STAMP.sql"
find "$OUT_DIR" -type f -name "sentineldesk-*.sql" -mtime +30 -delete

echo "backup-complete:$OUT_DIR/sentineldesk-$STAMP.sql"
