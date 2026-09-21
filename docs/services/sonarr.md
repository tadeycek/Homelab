# Sonarr

> TV manager: finds, downloads and organises series and new episodes.

| | |
|---|---|
| Status | Running |
| Address | http://<server>:8989 |
| Defined in | `docker-compose.yml` (`sonarr:`) |
| Image | `lscr.io/linuxserver/sonarr:latest` |
| Data | `/mnt/data/docker/sonarr/config`; library under `/mnt/data/media/tv` |

## What it does

- Monitors for TV shows, sends downloads to qBittorrent, then renames and moves finished files into the library.

## Why it is here

- It automates getting TV shows into the library instead of doing it by hand.

## How it is set up

- LinuxServer.io image with `PUID=1000`, `PGID=1000`, `TZ`.
- Port 8989. Config in `/config`.
- `/mnt/data` is mounted as `/data` in qBittorrent, Sonarr, Radarr and Lidarr, so downloads and the media library are on one filesystem inside every container. Paths used in the apps therefore start with `/data`.

## First run

- Set the root folder to `/data/media/tv`, add qBittorrent as the download client, and add the indexer link from Prowlarr.

## Data and backups

- `sonarr/config` is included in the [backup](../backup.md). Its database is a live SQLite file copied while the app runs.

## Operating notes

- Its API key (Settings, General) is what Prowlarr and Jellyseerr use to connect; it is stored only in the config volume.

## Related

- [Prowlarr](prowlarr.md), [qBittorrent](qbittorrent.md), [Jellyfin](jellyfin.md)
