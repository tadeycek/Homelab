# Backups

`scripts/backup.sh` snapshots the data that git cannot restore.

```bash
sudo scripts/backup.sh        # take a snapshot
sudo scripts/backup.sh -n     # dry run
```

Snapshots go to `/home/tadej/backups/homelab/<date>_<time>/` on the **OS disk**,
so they sit on a different physical drive than the data in `/mnt/data`. Override
with `BACKUP_DIR=...`; keep more or fewer with `KEEP=N` (default 7). The script
refuses to run if the destination is on the same disk as the data.

Snapshots are hard-linked to the previous one, so an unchanged file costs no
extra space. The first snapshot was ~3.3 GB; the second added ~0.1 GB.

## What is in a snapshot

| Path | Contents |
|---|---|
| `db/immich.sql.gz` | Immich Postgres dump |
| `db/nextcloud.sql.gz` | Nextcloud MariaDB dump |
| `db/vaultwarden.sqlite3` | Vaultwarden vault database (SQLite online backup) |
| `db/grafana.db` | Grafana database (SQLite online backup) |
| `data/` | A copy of `/mnt/data/docker`, minus the exclusions below |
| `secrets/secrets.tar.gz` | The gitignored files: `.env` files, `credentials.txt`, `certs/` |

Databases are dumped rather than copied because copying a live database
directory can produce a corrupt backup.

The snapshot directory holds passwords and keys, so it is mode 700, root-only.

## What is not backed up, and why

| Excluded | Reason |
|---|---|
| `/mnt/data/media` | Large and re-downloadable |
| `ollama/` (~14 GB) | Model files, re-pulled with `ollama pull` |
| `jellyfin/cache`, `immich/ml-cache`, `immich/redis` | Caches |
| `immich/db`, `nextcloud/db` | Raw database files; covered by the dumps |
| `skyfactory4/downloads` | Modpack download cache |
| Odysseus volumes | Third-party project |
| Photos and files themselves | Immich uploads and Nextcloud files are under `data/`, so they **are** included |

## Limits

- **Same machine.** A second disk protects against a disk failure, not against
  theft, fire or the whole laptop dying. Copy `/home/tadej/backups/homelab` to
  another machine or cloud storage occasionally, and treat it as sensitive.
- **Not scheduled.** There is no cron job yet. To run it nightly at 03:00, as root:

  ```
  0 3 * * * /home/tadej/homeserver/scripts/backup.sh >> /var/log/homelab-backup.log 2>&1
  ```

  (add with `sudo crontab -e`).
- **File-level copies of other apps** (Sonarr, Radarr, Jellyfin, Pi-hole, ...) are
  taken while the apps are running. That is normally fine, but a snapshot taken
  mid-write can be inconsistent. Take another one if a restore looks odd.
