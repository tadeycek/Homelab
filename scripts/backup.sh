#!/usr/bin/env bash
# Homelab backup: /mnt/data/docker (configs + app data) plus the secrets that
# live outside git, onto the OS disk. Snapshots are hard-linked, so each one
# only costs the space of what changed.
#
# Usage:  sudo scripts/backup.sh [-n]        (-n = dry run, copy nothing)
# Env:    BACKUP_DIR  destination   (default: /home/tadej/backups/homelab)
#         KEEP        snapshots kept (default: 7)
#
# Not backed up on purpose: /mnt/data/media (re-downloadable), Ollama models,
# caches, and Odysseus (third-party project). See docs/backup.md.
set -euo pipefail

[ "$EUID" -eq 0 ] || exec sudo -E "$0" "$@"

DRY=""; [ "${1:-}" = "-n" ] && DRY="--dry-run"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
SRC=/mnt/data/docker
DEST="${BACKUP_DIR:-/home/tadej/backups/homelab}"
KEEP="${KEEP:-7}"
STAMP="$(date +%Y-%m-%d_%H%M)"
SNAP="$DEST/$STAMP"
log() { printf '[%s] %s\n' "$(date +%T)" "$*"; }

# Backing up onto the disk that holds the data would defeat the purpose.
[ "$(df --output=source "$SRC" | tail -1)" != "$(df --output=source "$(dirname "$DEST")" | tail -1)" ] \
  || { echo "refusing: $DEST is on the same disk as $SRC" >&2; exit 1; }

if [ -z "$DRY" ]; then
  mkdir -p "$SNAP/db" "$SNAP/secrets"
  chmod 700 "$DEST" "$SNAP" "$SNAP/secrets"
fi

# 1. Databases: consistent dumps instead of copying live database files.
if [ -z "$DRY" ]; then
  log "dump immich (postgres)"
  docker exec immich-db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$SNAP/db/immich.sql.gz"
  log "dump nextcloud (mariadb)"
  docker exec nextcloud-db sh -c 'mariadb-dump --single-transaction -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' | gzip > "$SNAP/db/nextcloud.sql.gz"
  log "snapshot vaultwarden (sqlite)"
  sqlite3 "$SRC/vaultwarden/db.sqlite3" ".backup '$SNAP/db/vaultwarden.sqlite3'"
  log "snapshot grafana (sqlite)"
  sqlite3 "$SRC/grafana/grafana.db" ".backup '$SNAP/db/grafana.db'"
fi

# 2. App data. Raw DB directories are excluded because the dumps above cover them.
log "rsync $SRC"
LINK=""; [ -d "$DEST/latest" ] && LINK="--link-dest=$DEST/latest/data"
rc=0
rsync -a --delete $DRY $LINK \
  --exclude='/ollama/' \
  --exclude='/jellyfin/cache/' \
  --exclude='/immich/ml-cache/' \
  --exclude='/immich/redis/' \
  --exclude='/immich/db/' \
  --exclude='/nextcloud/db/' \
  --exclude='/skyfactory4/downloads/' \
  --exclude='/vaultwarden/db.sqlite3*' \
  --exclude='/grafana/grafana.db*' \
  "$SRC/" "$SNAP/data/" || rc=$?
# 24 = files vanished mid-copy (normal for live services); anything else is a failure.
[ "$rc" -eq 0 ] || [ "$rc" -eq 24 ] || { echo "rsync failed (exit $rc)" >&2; exit "$rc"; }

# 3. Secrets that are gitignored, so git cannot restore them.
if [ -z "$DRY" ]; then
  log "collect secrets (mode 700)"
  ( cd "$REPO" && tar czf "$SNAP/secrets/secrets.tar.gz" \
      .env credentials.txt certs services/*/.env bots/*/.env 2>/dev/null ) || true
  chmod 600 "$SNAP/secrets/secrets.tar.gz"
  chmod -R go-rwx "$SNAP/db"

  ln -sfn "$SNAP" "$DEST/latest"

  # 4. Retention
  ls -1d "$DEST"/20*/ 2>/dev/null | sort | head -n -"$KEEP" | while read -r old; do
    log "prune $old"; rm -rf "$old"
  done
  log "done: $(du -sh "$SNAP" | cut -f1) in $SNAP ($(du -sh "$DEST" | cut -f1) total)"
fi
