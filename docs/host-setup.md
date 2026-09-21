# Host setup

Everything that exists on the machine *outside* the Docker Compose files.
If it is not written down here or in a compose file, it will not survive a rebuild.

## Hardware and OS

| | |
|---|---|
| Machine | Dell Latitude 5521 (laptop used as a server) |
| CPU / RAM | Intel i7-11800H, 32 GB |
| OS | Ubuntu 24.04 LTS |
| OS disk | `nvme1n1` (~477 GB): `/boot/efi` (vfat), `/` (ext4, ~474 GB) |
| Data disk | `nvme0n1` (~931 GB): ext4, mounted at `/mnt/data` |

The OS disk and the data disk are separate physical drives. That is what makes
the backups in [backup.md](backup.md) meaningful.

## Data disk mount

`/etc/fstab`:

```
UUID=<data-disk-uuid>  /mnt/data  ext4  defaults,nofail  0  2
```

Find the UUID of the data partition with `lsblk -f`. `nofail` lets the machine
boot even if the data disk is missing; containers that need it will then fail
to start rather than silently writing to the OS disk.

Layout under `/mnt/data`:

| Path | Contents |
|---|---|
| `docker/<service>/` | Config and app data for each container (bind mounts) |
| `media/` | Movies, shows, music. Large and re-downloadable, **not backed up** |
| `docker/skyfactory4/` | Minecraft world; its compose file is in `services/skyfactory4/` in this repo |

## Docker

- Docker Engine + the Compose plugin, installed from Docker's apt repository.
- The user running the stack is in the `docker` group.
- Networks: `homeserver_default` is the main network. `skyfactory4` joins it
  as an external network. `bots`, `duckdns` and `skyfactory4` also have their own
  default networks.
- **Named volumes** (data that is *not* under `/mnt/data`, lives in
  `/var/lib/docker/volumes/`):
  - one anonymous volume used by `immich-server`
  - Odysseus: `odysseus_chromadb-data`, `odysseus_ntfy-cache`, `odysseus_searxng-data`
    (third-party project, see below)

## Starting at boot

Every container has `restart: unless-stopped`, so Docker brings the stack back
after a reboot. That is the mechanism actually in use.

`homeserver.service` in this repo is a systemd unit that wraps
`docker compose up -d`. **It is not installed**: the copy in
`/etc/systemd/system/` is empty and masked. It is kept for reference only.
A container you stop by hand (currently `lidarr` and `navidrome`) stays stopped
across reboots.

## Tailscale

- Installed on the host (not in Docker), running as `tailscaled`, node name `homelab`.
- Provides remote access to the server without opening ports.
- The dashboard container mounts `/var/run/tailscale` read-only to show status.
- Join a new install with `sudo tailscale up` and log in interactively, or use an
  auth key from the Tailscale admin console (`TS_AUTHKEY` in `.env`).

## Separately versioned projects

Not part of this repo (see `.gitignore`):

| Path | What | Where it lives |
|---|---|---|
| `bots/tradingbot/` | Trading bot | github.com/tadeycek/TradingBot |
| `bots/polymarket/` | Polymarket bot | github.com/tadeycek/PolymarketBot |
| `odysseus/` | Third-party AI project running 4 containers | not mine; obtain it from its upstream |

`bots/docker-compose.yml` in this repo builds the two bots from those clones.

## Secrets

Real values live in gitignored `.env` files. Templates are committed as
`.env.example`:

| File | Used by |
|---|---|
| `.env` | main compose stack (`docker-compose.yml`) |
| `services/duckdns/.env` | DuckDNS token and subdomain |
| `services/skyfactory4/.env` | CurseForge API key |
| `bots/polymarket/.env` | Polymarket bot (Anthropic key) |
| `certs/` | local TLS certificates (used by Vaultwarden) |

`credentials.txt` is a private notes file and is never committed. All of the
above are included in each backup, in `secrets/secrets.tar.gz`.
