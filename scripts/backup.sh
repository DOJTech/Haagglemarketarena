#!/usr/bin/env bash
# Makes one compressed backup of the database and deletes backups older than BACKUP_KEEP_DAYS (default 14).
# Needs pg_dump (PostgreSQL client tools) and DATABASE_URL. Run it from a scheduler (cron, Render cron job, GitHub Actions).
# A backup on the SAME machine as the database is not a real backup: copy the file somewhere else (see docs/BACKUPS_AND_MONITORING.md).
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to the database address}"
DIR="${BACKUP_DIR:-./backups}"; KEEP="${BACKUP_KEEP_DAYS:-14}"
umask 077; mkdir -p "$DIR"
F="$DIR/haggle-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
pg_dump --no-owner --no-privileges "$DATABASE_URL" | gzip -9 > "$F"
gzip -t "$F"                      # the file is a valid archive
[ "$(stat -c %s "$F")" -gt 1000 ] || { echo "Backup looks empty: $F" >&2; rm -f "$F"; exit 1; }
sha256sum "$F" > "$F.sha256"
find "$DIR" -name 'haggle-*.sql.gz*' -mtime +"$KEEP" -delete
echo "Backup written: $F ($(du -h "$F" | cut -f1))"
