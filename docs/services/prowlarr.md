# Prowlarr

> Manages torrent indexers in one place and shares them with Radarr, Sonarr and Lidarr.

| | |
|---|---|
| Status | Running |
| Address | http://<server>:9696 |
| Defined in | `docker-compose.yml` (`prowlarr:`) |
| Image | `lscr.io/linuxserver/prowlarr:latest` |
| Data | `/mnt/data/docker/prowlarr/config` |

## What it does

- Holds the list of indexers (the sites that are searched) and pushes them to the other \*arr apps so each does not need its own copy.

## Why it is here

- Adding an indexer once instead of three times, and keeping them in sync.

## How it is set up

- LinuxServer.io image with `PUID=1000`, `PGID=1000`, `TZ`. Port 9696. Config in `/config`. It needs no access to the media, so it has no `/data` mount.

## First run

- Add indexers, then add Radarr and Sonarr under Settings, Apps, using their URLs and API keys.

## Data and backups

- `prowlarr/config` is included in the [backup](../backup.md).

## Operating notes

- Inside the compose network, apps reach each other by container name (for example `http://radarr:7878`).

## Related

- [Radarr](radarr.md), [Sonarr](sonarr.md), [Lidarr](lidarr.md)
