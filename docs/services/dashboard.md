# Dashboard

> A custom status and control page for the whole server. It is the only application whose code lives in this repo.

| | |
|---|---|
| Status | Running |
| Address | http://<server>:4000 |
| Defined in | `docker-compose.yml` (`dashboard:`), source in `dashboard/` |
| Image | Built locally from `dashboard/Dockerfile` (Node 20) |
| Data | `/mnt/data/docker/dashboard` (`settings.json`) |

## What it does

- A single page that shows what is running and lets you act on it. Pages in the React client:
- ['**Dashboard**: launcher cards for every service (grouped by category) plus live system stats: CPU, RAM, disk, temperature and battery.', '**Models**: lists, pulls and deletes Ollama models.', '**Minecraft**: lists servers under the mounted Minecraft directory, edits `server.properties`, game rules and the whitelist, and sends console commands.', "**Bots**: reads the Polymarket bot's SQLite portfolio and the trading bot's log.", '**Clips**: front end for the separate [Clip Factory](clip-factory.md) service.', '**Settings**: show/hide and reorder service cards; saved to `settings.json`.']
- The Node server (`server.js`, Express) also exposes an API that reads the Docker socket (container list, logs, restart and stop), Pi-hole statistics, Tailscale status, and the Sonarr/Radarr download queue.

## Why it is here

- It gives one place to see the health of about 30 containers instead of opening each web UI.
- It is custom code, so unlike the other services it cannot be recreated from an image. That is why the source is committed here, and why the `.env` handling matters: the Pi-hole password is read from the environment, never hard-coded.

## How it is set up

- Multi-stage build: stage 1 builds the React client (`npm run build`), stage 2 runs the Node server and serves `client/dist`. The client build output is not committed; Docker rebuilds it.
- Port 4000. `restart: unless-stopped`.
- Bind mounts: `/mnt/data` (read-only) for disk stats; the Minecraft and bot data directories; `/sys/class/power_supply` and `/sys/class/hwmon` (read-only) for battery and temperatures; `/var/run/tailscale` (read-only) for Tailscale status; `/var/run/docker.sock` for container control.
- Environment: `PIHOLE_PASSWORD`, filled from `PIHOLE_WEBPASSWORD` in `.env`.

## First run

- `docker compose up -d --build dashboard` (a rebuild is needed after any change to `dashboard/`).
- Nothing to configure; service cards use built-in defaults until you change them in Settings.

## Data and backups

- `settings.json` under `/mnt/data/docker/dashboard` is included in every [backup](../backup.md).
- The bots' data it reads (`/mnt/data/docker/bots/`) is backed up too.

## Operating notes

- **The Docker socket is root-equivalent.** Anyone who can reach port 4000 can restart or stop containers. Keep it on the LAN or Tailscale; do not publish it through the reverse proxy.
- `Settings.tsx` and `server.js` contain Tailscale and LAN addresses as defaults. `server.js` also rewrites an older Tailscale address to the LAN one. Review these before making the repo public.
- Clip Factory is expected on the server's LAN address, port 5757, hard-coded in `server.js`.

## Related

- [Pi-hole](pihole.md), [Ollama](ollama.md), [Sonarr](sonarr.md)/[Radarr](radarr.md), [Tailscale](tailscale.md), [Crafty](crafty.md)/[SkyFactory 4](skyfactory4.md), [bots](polymarket-bot.md), [Clip Factory](clip-factory.md)
