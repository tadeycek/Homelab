# Prometheus

> Time-series database that scrapes and stores metrics.

| | |
|---|---|
| Status | Running, but its `node` target is **down** (see below) |
| Address | http://<server>:9090 |
| Defined in | `docker-compose.yml` (`prometheus:`), config in `prometheus/prometheus.yml` |
| Image | `prom/prometheus:latest` |
| Data | `/mnt/data/docker/prometheus` |

## What it does

- Every 15 seconds it pulls metrics from its targets and stores them for 30 days (`--storage.tsdb.retention.time=30d`). [Grafana](grafana.md) is meant to draw them.

## Why it is here

- Historical CPU, memory, disk and network graphs for the server. Its configuration is versioned here because a scrape target list is easy to lose.

## How it is set up

- `prometheus/prometheus.yml` is bind-mounted read-only over the container's config (absolute path `/home/tadej/homeserver/prometheus/prometheus.yml`).
- Two scrape jobs: `node` (`localhost:9100`, [node-exporter](node-exporter.md)) and `prometheus` (`localhost:9090`, itself).
- Time-series data in `/prometheus`.

## First run

- Nothing to do; it starts scraping immediately.

## Data and backups

- `prometheus/` is included in the [backup](../backup.md), although 30-day metrics are rarely worth restoring.

## Operating notes

- **Known issue: the `node` target is down.** Prometheus runs on the default bridge network, so `localhost:9100` inside its container is the container itself, not the host. node-exporter uses `network_mode: host` and does answer on the host at port 9100. Verified with the Prometheus targets API: `node ... down`, `prometheus ... up`.
- Ways to fix it (not applied): point the target at the host's LAN address, use `host.docker.internal` with `extra_hosts: ["host.docker.internal:host-gateway"]`, or run Prometheus with `network_mode: host`.

## Related

- [node-exporter](node-exporter.md), [Grafana](grafana.md)
