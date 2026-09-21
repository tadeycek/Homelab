# Nextcloud (with MariaDB)

> Self-hosted file sync and sharing: a private cloud drive.

| | |
|---|---|
| Status | Running (`nextcloud` and `nextcloud-db`) |
| Address | http://<server>:8081 |
| Defined in | `docker-compose.yml` (`nextcloud-db:`, `nextcloud:`) |
| Image | `nextcloud:latest`, `mariadb:11` |
| Data | `/mnt/data/docker/nextcloud/html`, `/mnt/data/docker/nextcloud/db` |

## What it does

- Syncs files between devices, shares links, and provides a web file manager. Two containers work together: the Nextcloud app and its MariaDB database.

## Why it is here

- Personal file storage that is not tied to a third-party service.

## How it is set up

- `nextcloud-db`: MariaDB 11 started with `--transaction-isolation=READ-COMMITTED --log-bin=binlog --binlog-format=ROW`, the settings Nextcloud recommends. Database name and user `nextcloud`; passwords from `.env` (`NEXTCLOUD_DB_ROOT_PASSWORD`, `NEXTCLOUD_DB_PASSWORD`).
- `nextcloud`: port 8081 to container 80, `depends_on: nextcloud-db`, connects with `MYSQL_HOST=nextcloud-db`.
- Admin account `admin` created on first start from `NEXTCLOUD_ADMIN_PASSWORD`.
- The whole application, including user files by default, is under `nextcloud/html`.

## First run

- Wait for the first-start installation to finish, then log in as `admin`.
- Add `192.168.x.x` or the hostname you use to `trusted_domains` in `config/config.php` if the login page complains.

## Data and backups

- The database is dumped by `scripts/backup.sh` (`db/nextcloud.sql.gz`); the raw `nextcloud/db` directory is deliberately excluded because a live copy can be corrupt. `nextcloud/html` (files and config) is copied as is.
- Restore: load the dump into a fresh `nextcloud-db` ([restore guide](../restore.md)).

## Operating notes

- The admin password variable is only used by the first installation; changing it later does not change the account.
- Uses the `latest` tag. Nextcloud does not support skipping major versions, so pin a version before an upgrade.

## Related

- [Backups](../backup.md), [Restore guide](../restore.md)
