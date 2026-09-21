# SkyFactory 4 (Minecraft server)

> A modded Minecraft 1.12.2 (Forge) server running the SkyFactory 4 modpack.

| | |
|---|---|
| Status | Running (healthy) |
| Address | `<hostname>:25601` (host port) to container 25565 |
| Defined in | `services/skyfactory4/docker-compose.yml` |
| Image | `itzg/minecraft-server:java8` |
| Data | `/mnt/data/docker/skyfactory4/data` (world and mods), `world-backups/` |

## What it does

- A Forge 1.12.2 game server. The world, mods and configuration live in the data directory.

## Why it is here

- Hosts a multiplayer modded server. Its compose file is versioned because the JVM settings and port mapping are what a rebuild needs; the world itself is data.

## How it is set up

- Its own compose project in `services/skyfactory4/`.
- Environment: `EULA=true`, `TYPE=CUSTOM` with `CUSTOM_SERVER=/data/forge-1.12.2-14.23.5.2860.jar`, `MEMORY=8G`, `TZ`.
- Java 8 image, which SkyFactory 4 requires. Port `25601:25565`, `stdin_open` and `tty` for a console.
- Networks: its own default network and the external `homeserver_default`, so containers on that network can reach it.
- The **whitelist is enforced**: `ENABLE_WHITELIST` is on and `WHITELIST` is filled from `MC_WHITELIST` in `services/skyfactory4/.env` (comma-separated usernames, kept out of git). The image resolves the names to UUIDs at start and merges them into `whitelist.json`; players added in-game are kept. Add someone by editing `MC_WHITELIST` and recreating the container, or with `docker exec skyfactory4 rcon-cli whitelist add <name>` for an immediate change (the `.env` list stays the source of truth).
- The data volume is an **absolute path** (`/mnt/data/docker/skyfactory4/data`), so the compose file works from the repo without moving the world.
- The [dashboard](dashboard.md) mounts the same directory to edit `server.properties`, game rules and the whitelist.

## First run

- Start it; the first boot generates the world and takes several minutes (the health check reports `starting` until Forge finishes loading).

## Data and backups

- `skyfactory4/data` and `world-backups` are included in the [backup](../backup.md); `skyfactory4/downloads` is not.

## Operating notes

- `services/skyfactory4/.env` holds `MC_WHITELIST` (used) and `CF_API_KEY`, which the compose file does not reference, so it may be unused.
- The public hostname that players use is provided by [DuckDNS](duckdns.md).
- The 8 GB heap is a large share of the machine's 32 GB; keep it in mind when adding other services.

## Related

- [Crafty](crafty.md), [DuckDNS](duckdns.md), [Dashboard](dashboard.md)
