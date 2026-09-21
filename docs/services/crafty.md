# Crafty Controller

> A web panel for creating and managing Minecraft servers.

| | |
|---|---|
| Status | Running (currently managing **no** servers) |
| Address | https://<server>:8444 (self-signed certificate) |
| Defined in | `docker-compose.yml` (`crafty:`) |
| Image | `registry.gitlab.com/crafty-controller/crafty-4:latest` |
| Data | `/mnt/data/docker/crafty/{backups,logs,servers,config,import}` |

## What it does

- Creates, starts and stops Minecraft servers, edits their settings, shows consoles and logs, schedules backups, and installs mods.

## Why it is here

- A general-purpose Minecraft manager (Java and Bedrock, Fabric/Forge/Modrinth/CurseForge). It appears as a "games" card on the [dashboard](dashboard.md).

## How it is set up

- Ports: 8444 to container 8443 (the UI; 8443 on the host is Vaultwarden), 8000 (redirect), 8123 (Dynmap), 25565 to 25575 (Java servers) and 19132 to 19142 UDP (Bedrock).
- Five bind mounts under `crafty/`: backups, logs, servers, config, import.

## First run

- The first-login admin password is generated on a fresh install and written to `crafty/config/default-creds.txt` (user `admin`). Log in once and set a real password; Crafty forces the change.

## Data and backups

- All of `crafty/` is included in the [backup](../backup.md).

## Operating notes

- The current Minecraft server, [SkyFactory 4](skyfactory4.md), runs as its own container and is **not** managed by Crafty.
- `default-creds.txt` holds the initial password in plaintext on the data disk; delete it after the first login.

## Related

- [SkyFactory 4](skyfactory4.md), [Dashboard](dashboard.md)
