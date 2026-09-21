# node-exporter

> Exposes the host machine's CPU, memory, disk and network metrics for Prometheus.

| | |
|---|---|
| Status | Running |
| Address | http://<server>:9100/metrics (host network) |
| Defined in | `docker-compose.yml` (`node-exporter:`) |
| Image | `prom/node-exporter:latest` |
| Data | None |

## What it does

- Publishes hundreds of hardware and OS metrics in Prometheus format.

## Why it is here

- It is the source of the server's system graphs.

## How it is set up

- `network_mode: host` and `pid: host` so it sees the real host, with `/` mounted read-only at `/host` (`rslave`) and `--path.rootfs=/host`.
- No ports mapping is needed because it listens on the host directly.

## First run

- None.

## Data and backups

- Stateless. Nothing to back up.

## Operating notes

- It works: `curl localhost:9100/metrics` on the host returns metrics. Prometheus currently cannot reach it; see [Prometheus](prometheus.md#operating-notes).

## Related

- [Prometheus](prometheus.md), [Grafana](grafana.md)
