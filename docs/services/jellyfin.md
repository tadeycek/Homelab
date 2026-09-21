# Jellyfin

> Media server for movies and TV shows, streamed to any device.

| | |
|---|---|
| Status | Running (healthy) |
| Address | http://<server>:8096 |
| Defined in | `docker-compose.yml` (`jellyfin:`) |
| Image | `jellyfin/jellyfin:latest` |
| Data | `/mnt/data/docker/jellyfin` (config, cache) and `/mnt/data/media` |

## What it does

- Scans the media folders, fetches artwork and metadata, and streams video to browsers, phones and TVs (transcoding when the client cannot play the file directly).

## Why it is here

- It is the front end for the media pipeline: [Radarr](radarr.md) and [Sonarr](sonarr.md) put files in the library and Jellyfin makes them watchable. [Jellyseerr](jellyseerr.md) sits on top for requests.

## How it is set up

- `network_mode: host`, so DLNA/UPnP discovery works on the LAN. The web UI is then on the host's port 8096 (no `ports:` mapping needed).
- Volumes: `jellyfin/config`, `jellyfin/cache`, and `/mnt/data/media` mounted as `/media`.
- Environment: `TZ`, `JELLYFIN_PublishedServerUrl=http://localhost:8096`.
- No GPU device is passed to the container, so transcoding runs on the CPU (an i7-11800H). The CPU's Intel integrated GPU could do hardware transcoding if `/dev/dri` were passed in and enabled in Jellyfin; that is not set up.

## First run

- Complete the setup wizard, create the admin account, and add libraries at `/media/movies` and `/media/tv`.

## Data and backups

- `jellyfin/config` is included in the [backup](../backup.md); `jellyfin/cache` is not (it is rebuilt). The media itself is **not** backed up.

## Operating notes

- Because it uses the host network it does not join `homeserver_default`; other containers reach it through the host address, not by name.
- The published-server URL is `localhost`, which is fine for the web UI but not for apps on other devices; set the real address in Jellyfin's networking settings if a client cannot connect.

## Related

- [Radarr](radarr.md), [Sonarr](sonarr.md), [Jellyseerr](jellyseerr.md), [Navidrome](navidrome.md) (music)
