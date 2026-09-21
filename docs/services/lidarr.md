# Lidarr

> Music manager: finds, downloads and organises albums.

| | |
|---|---|
| Status | **Stopped** (exited 3 months ago; kept stopped) |
| Address | http://<server>:8686 |
| Defined in | `docker-compose.yml` (`lidarr:`) |
| Image | `lscr.io/linuxserver/lidarr:latest` |
| Data | `/mnt/data/docker/lidarr/config`; library under `/mnt/data/media/music` |

## What it does

- Monitors for music, sends downloads to qBittorrent, then renames and moves finished files into the library.

## Why it is here

- It automates getting music into the library instead of doing it by hand.

## How it is set up

- LinuxServer.io image with `PUID=1000`, `PGID=1000`, `TZ`.
- Port 8686. Config in `/config`.
- `/mnt/data` is mounted as `/data` in qBittorrent, Sonarr, Radarr and Lidarr, so downloads and the media library are on one filesystem inside every container. Paths used in the apps therefore start with `/data`.

## First run

- Set the root folder to `/data/media/music`, add qBittorrent as the download client, and add the indexer link from Prowlarr.
- It has to be started with `docker compose up -d lidarr` when wanted.

## Data and backups

- `lidarr/config` is included in the [backup](../backup.md). Its database is a live SQLite file copied while the app runs.

## Operating notes

- Its API key (Settings, General) is what Prowlarr and Jellyseerr use to connect; it is stored only in the config volume.

## Related

- [Prowlarr](prowlarr.md), [qBittorrent](qbittorrent.md), [Jellyfin](jellyfin.md)
