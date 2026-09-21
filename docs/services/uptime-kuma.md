# Uptime Kuma

> Checks whether services are up and alerts when they are not.

| | |
|---|---|
| Status | Running (healthy) |
| Address | http://<server>:3001 |
| Defined in | `docker-compose.yml` (`uptime-kuma:`) |
| Image | `louislam/uptime-kuma:1` |
| Data | `/mnt/data/docker/uptime-kuma` |

## What it does

- Runs periodic HTTP, TCP, ping and Docker checks against your services, shows a status page, and can send notifications.

## Why it is here

- It answers "is everything still working?" without checking each app by hand.

## How it is set up

- Port 3001. Data in `/app/data` (an SQLite database `kuma.db`, in WAL mode).
- Mounts the Docker socket so it can monitor containers directly.
- The image is pinned to major version `1`.

## First run

- Create the admin account, then add monitors and a notification channel. Monitors are configured in the UI and stored in `kuma.db`, not in this repo.

## Data and backups

- `uptime-kuma/` is included in the [backup](../backup.md).
- `kuma.db` uses WAL, so a plain file copy taken while it is writing can be inconsistent. The backup script does not yet take an SQLite snapshot of it (it does for Vaultwarden and Grafana).

## Operating notes

- The Docker socket mount makes this container root-equivalent on the host.

## Related

- [Portainer](portainer.md)
