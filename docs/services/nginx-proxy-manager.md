# Nginx Proxy Manager

> Reverse proxy with a web UI and automatic Let's Encrypt certificates.

| | |
|---|---|
| Status | Running |
| Address | Admin UI http://<server>:81; proxy on ports 80 and 443 |
| Defined in | `docker-compose.yml` (`nginx-proxy-manager:`) |
| Image | `jc21/nginx-proxy-manager:latest` |
| Data | `/mnt/data/docker/nginx-proxy-manager` |

## What it does

- Maps hostnames to internal services (for example `app.example.com` to a container port) and terminates HTTPS, requesting and renewing certificates automatically.

## Why it is here

- It is the single entry point if any service is exposed beyond the LAN, and a way to give internal services friendly names.
- Together with [DuckDNS](duckdns.md) it lets a dynamic home IP have a stable name.

## How it is set up

- Ports 80 and 443 for traffic and 81 for the admin UI.
- Volumes: `nginx-proxy-manager/data` (its SQLite database, proxy hosts, access lists) and `nginx-proxy-manager/letsencrypt` (issued certificates).
- No environment variables; all configuration is done in the UI and stored in the data volume.

## First run

- Log in to the admin UI on port 81. A fresh install uses the well-known default account (`admin@example.com` / `changeme`); change it immediately.
- Add proxy hosts, then request certificates from the SSL tab.

## Data and backups

- Both directories are included in the [backup](../backup.md). Proxy hosts and certificates exist **only** there, not in git.
- The database is a live SQLite file that is copied while running; take another snapshot if a restore looks inconsistent.

## Operating notes

- Port 80 on the host is used here, which is why Pi-hole's web UI is on 8080.
- Which hostnames are proxied is not recorded in this repo; export or screenshot them before a rebuild if you rely on them.

## Related

- [DuckDNS](duckdns.md), [Pi-hole](pihole.md)
