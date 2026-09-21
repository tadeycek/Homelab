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

## System tuning for 24/7 use

Verified on the live system. A fresh install needs these repeated, or the
server will suspend, lose Wi-Fi or fail to start Pi-hole.

| Setting | How |
|---|---|
| No sleep, suspend or hibernate | `sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target` |
| Closing the lid does nothing | `/etc/systemd/logind.conf`: `HandleLidSwitch=ignore`, `HandleLidSwitchExternalPower=ignore`, `HandleLidSwitchDocked=ignore` |
| Port 53 free for Pi-hole | `/etc/systemd/resolved.conf`: `DNSStubListener=no`, then `sudo systemctl restart systemd-resolved` |
| Auto-login after a reboot | `/etc/gdm3/custom.conf`: `AutomaticLoginEnable=true` and `AutomaticLogin=<user>` |
| Screen lock / idle off | dconf policy in `/etc/dconf/db/local.d/00-screensaver`, then `sudo dconf update` |
| Wi-Fi power save off | `/etc/NetworkManager/conf.d/wifi-powersave-off.conf` with `[connection]` / `wifi.powersave = 2`. Ubuntu also ships `default-wifi-powersave-on.conf` (value 3); the `off` file sorts later, so it wins. |

Local HTTPS certificates are made with `mkcert` (CA installed in the system
trust store, Chrome and Firefox) and stored in `certs/`. The current pair
expires in September 2028; regenerate with `mkcert <lan-ip> <hostname>`.

## Bots and third-party projects

| Path | What | Where it lives |
|---|---|---|
| `bots/tradingbot/` | Trading bot | source is in this repo |
| `bots/polymarket/` | Polymarket bot | source is in this repo; `.env` is gitignored |
| `odysseus/` | Third-party AI project running 4 containers | **not** in this repo (gitignored); obtain it from its upstream |

The bots were previously separate GitHub repositories. Those were deleted, so this repo
is now the only remote copy of their source. `bots/docker-compose.yml` builds them.
Runtime state (for example the Polymarket SQLite portfolio) lives in
`/mnt/data/docker/bots/` and is covered by the backup.

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
