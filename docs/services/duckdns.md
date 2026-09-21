# DuckDNS

> Keeps a DuckDNS hostname pointed at the home connection's changing public IP.

| | |
|---|---|
| Status | Running |
| Address | No UI |
| Defined in | `services/duckdns/docker-compose.yml` |
| Image | `lscr.io/linuxserver/duckdns:latest` |
| Data | `/mnt/data/docker/duckdns/config` |

## What it does

- Periodically tells DuckDNS the current public IP, so a fixed name such as `<subdomain>.duckdns.org` always resolves to home.

## Why it is here

- A residential IP changes; without this, anything reached by name from outside (such as the Minecraft server) would break.
- It is defined in `services/duckdns/`, its own compose project, separate from the main stack.

## How it is set up

- Its own compose project in `services/duckdns/`. The token and subdomain come from `services/duckdns/.env` (`DUCKDNS_TOKEN`, `DUCKDNS_SUBDOMAINS`); the container runs as UID/GID 1000.
- The compose file uses an absolute path for its data volume, so it can be run from the repo without moving data.

## First run

- Copy `.env.example` to `.env`, set the token from duckdns.org and the subdomain, then `docker compose up -d` inside `services/duckdns/`.

## Data and backups

- `duckdns/config` is included in the [backup](../backup.md); `.env` is in `secrets/secrets.tar.gz`.

## Operating notes

- The subdomain is deliberately kept in `.env` so the public hostname is not published in the repo.
- Own network `duckdns_default`; it does not join `homeserver_default`.

## Related

- [SkyFactory 4](skyfactory4.md), [Nginx Proxy Manager](nginx-proxy-manager.md)
