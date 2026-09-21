# Navidrome

> Music streaming server (Subsonic-compatible) for the local music library.

| | |
|---|---|
| Status | **Stopped** (exited 3 months ago) |
| Address | http://<server>:4533 |
| Defined in | `docker-compose.yml` (`navidrome:`) |
| Image | `deluan/navidrome:latest` |
| Data | `/mnt/data/docker/navidrome`; music at `/mnt/data/media/music` |

## What it does

- Serves the music library to Subsonic-compatible apps and its own web player.

## Why it is here

- A music counterpart to Jellyfin's video: [Lidarr](lidarr.md) fills the library and Navidrome plays it.

## How it is set up

- Runs as `1000:1000`. Port 4533.
- Environment: `ND_MUSICFOLDER=/music`, `ND_DATAFOLDER=/data`, `ND_LOGLEVEL=info`, `ND_SESSIONTIMEOUT=24h`.
- The music folder is mounted **read-only** (`/mnt/data/media/music:/music:ro`), so Navidrome can never change your files.

## First run

- Start it, open the UI and create the first admin user.

## Data and backups

- `navidrome/` (its database of users and playlists) is included in the [backup](../backup.md).

## Operating notes

- Currently stopped on purpose; start it with `docker compose up -d navidrome`.

## Related

- [Lidarr](lidarr.md)
