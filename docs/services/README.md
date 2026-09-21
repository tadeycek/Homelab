# Service documentation

One page per service: what it does, why it is part of the homelab, how it is configured here, first-run steps, what gets backed up, and known problems.

Ports are LAN ports on the server (`<server>` is its LAN address or Tailscale name). "Stopped" services are stopped on purpose; a plain `docker compose up -d` would start them, so start services by name instead.

## Platform & network

| Service | What it is | Port | Status |
|---|---|---|---|
| [dashboard](dashboard.md) | Custom status and control page (only custom app) | 4000 | Running |
| [portainer](portainer.md) | Docker management UI | 9000 / 9443 | Running |
| [pihole](pihole.md) | DNS server and ad blocker | 8080 (UI), 53 | Running |
| [nginx-proxy-manager](nginx-proxy-manager.md) | Reverse proxy and certificates | 81 (UI), 80, 443 | Running |
| [tailscale](tailscale.md) | Mesh VPN for remote access (host service) | host | Running |
| [duckdns](duckdns.md) | Keeps a DuckDNS name on the changing public IP | none | Running |

## Media

| Service | What it is | Port | Status |
|---|---|---|---|
| [jellyfin](jellyfin.md) | Movie and TV streaming | 8096 (host network) | Running |
| [jellyseerr](jellyseerr.md) | Media request portal | 5055 | Running |
| [radarr](radarr.md) | Movie automation | 7878 | Running |
| [sonarr](sonarr.md) | TV automation | 8989 | Running |
| [lidarr](lidarr.md) | Music automation | 8686 | Stopped |
| [prowlarr](prowlarr.md) | Indexer manager for the \*arr apps | 9696 | Running |
| [qbittorrent](qbittorrent.md) | Torrent client | 8082, 6881 | Running |
| [navidrome](navidrome.md) | Music streaming | 4533 | Stopped |

## Personal cloud

| Service | What it is | Port | Status |
|---|---|---|---|
| [nextcloud](nextcloud.md) | Files (with MariaDB) | 8081 | Running |
| [immich](immich.md) | Photos (server, ML, Redis, Postgres) | 2283 | Running |
| [vaultwarden](vaultwarden.md) | Password manager | 8443 (HTTPS) | Running |

## AI

| Service | What it is | Port | Status |
|---|---|---|---|
| [ollama](ollama.md) | Local language models | 11434 | Running |
| [open-webui](open-webui.md) | Chat interface for Ollama | 3000 | Running |

## Monitoring

| Service | What it is | Port | Status |
|---|---|---|---|
| [prometheus](prometheus.md) | Metrics database | 9090 | Running, node target down |
| [node-exporter](node-exporter.md) | Host metrics source | 9100 (host network) | Running |
| [grafana](grafana.md) | Dashboards | 3002 | Running, unconfigured |
| [uptime-kuma](uptime-kuma.md) | Availability checks and alerts | 3001 | Running |

## Games

| Service | What it is | Port | Status |
|---|---|---|---|
| [crafty](crafty.md) | Minecraft server manager | 8444 | Running, no servers |
| [skyfactory4](skyfactory4.md) | Modded Minecraft server | 25601 | Running |

## Projects

| Service | What it is | Port | Status |
|---|---|---|---|
| [polymarket-bot](polymarket-bot.md) | LLM-driven Polymarket bot (paper by default) | none | Stopped |
| [tradingbot](tradingbot.md) | Paper-trading EMA bot on BTC/USDT | none | Running |
| [clip-factory](clip-factory.md) | Video clip generator (host service, not in this repo) | 5757 | Running |

## Not documented here

- **Odysseus** (four containers: Odysseus, SearXNG, ChromaDB, ntfy) runs from `~/homeserver/odysseus/`. It is a third-party project, is gitignored, and is not covered by the backup script.

## How the pages are structured

Every page uses the same headings: *What it does*, *Why it is here*, *How it is set up*, *First run*, *Data and backups*, *Operating notes*, *Related*. Statements come from the compose files, the running system, or the app's own documented behaviour; where something is only an assumption, the page says so.
