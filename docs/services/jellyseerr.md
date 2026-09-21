# Jellyseerr

> A request portal: people ask for a movie or show, and it is sent to Radarr or Sonarr automatically.

| | |
|---|---|
| Status | Running |
| Address | http://<server>:5055 |
| Defined in | `docker-compose.yml` (`jellyseerr:`) |
| Image | `fallenbagel/jellyseerr:latest` |
| Data | `/mnt/data/docker/jellyseerr/config` |

## What it does

- A search-and-request web app. Users log in with their Jellyfin account, request titles, and Jellyseerr forwards approved requests to Radarr (movies) or Sonarr (TV).

## Why it is here

- It lets other people at home ask for media without touching the download tools.

## How it is set up

- Port 5055, config in `/app/config`, `TZ` set. Nothing else; connections to Jellyfin, Radarr and Sonarr are configured in its UI and stored in the config volume.

## First run

- Run the setup wizard: sign in with Jellyfin, then add the Radarr and Sonarr servers using their API keys.

## Data and backups

- `jellyseerr/config` is included in the [backup](../backup.md).

## Operating notes

- The Radarr/Sonarr API keys it stores are secrets kept only in that volume, not in git.

## Related

- [Jellyfin](jellyfin.md), [Radarr](radarr.md), [Sonarr](sonarr.md)
