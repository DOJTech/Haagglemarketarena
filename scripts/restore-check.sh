#!/usr/bin/env bash
# Proves a backup can actually be restored. Restores into a SCRATCH database (RESTORE_URL), never into production.
#   RESTORE_URL=postgres://...scratch-db... bash scripts/restore-check.sh backups/haggle-YYYYMMDDTHHMMSSZ.sql.gz
set -euo pipefail
: "${RESTORE_URL:?Set RESTORE_URL to an EMPTY scratch database}"
FILE="${1:?Usage: restore-check.sh <backup.sql.gz>}"
[ "$RESTORE_URL" != "${DATABASE_URL:-}" ] || { echo "Refusing: RESTORE_URL is the production DATABASE_URL." >&2; exit 1; }
[ -f "$FILE.sha256" ] && sha256sum -c "$FILE.sha256"
gzip -t "$FILE"
gunzip -c "$FILE" | psql --set ON_ERROR_STOP=1 -q "$RESTORE_URL" >/dev/null
echo "Restore finished. Row counts in the restored copy:"
psql "$RESTORE_URL" -Atc "select 'players',count(*) from players union all select 'runs',count(*) from runs union all select 'scores',count(*) from scores union all select 'accounts',count(*) from accounts"
