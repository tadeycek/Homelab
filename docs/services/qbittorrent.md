# qBittorrent

> The torrent client that the download managers send their downloads to.

| | |
|---|---|
| Status | Running |
| Address | http://<server>:8082 |
| Defined in | `docker-compose.yml` (`qbittorrent:`) |
| Image | `lscr.io/linuxserver/qbittorrent:latest` |
| Data | `/mnt/data/docker/qbittorrent/config`; downloads under `/mnt/data/downloads` |

## What it does

- Downloads and seeds torrents and exposes a web UI and API that Radarr, Sonarr and Lidarr control.

## Why it is here

- It is the download engine of the media pipeline.

## How it is set up

- LinuxServer.io image with `PUID=1000`, `PGID=1000`, `TZ`, `WEBUI_PORT=8082`.
- Ports: 8082 (web UI) and 6881 TCP/UDP (BitTorrent).
- `/mnt/data` is mounted as `/data` in qBittorrent, Sonarr, Radarr and Lidarr, so downloads and the media library are on one filesystem inside every container. Paths used in the apps therefore start with `/data`.
- Download paths used in the app, per the original setup notes: incomplete in `/data/downloads/incomplete`, complete in `/data/downloads/complete`.

## First run

- Log in with the initial credentials (LinuxServer images print a temporary password in the container log on first start), change the password, and set the download paths above.

## Data and backups

- `qbittorrent/config` is included in the [backup](../backup.md). Downloads are not.

## Operating notes

- There is **no VPN container** in this stack: torrent traffic leaves through the normal internet connection. That is a deliberate design choice to review, not an oversight this document can decide for you.
- Port 6881 is published; forward it on the router only if you want incoming connections.

## Related

- [Radarr](radarr.md), [Sonarr](sonarr.md), [Lidarr](lidarr.md)
