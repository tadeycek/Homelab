# Grafana

> Dashboards for metrics.

| | |
|---|---|
| Status | Running |
| Address | http://<server>:3002 |
| Defined in | `docker-compose.yml` (`grafana:`) |
| Image | `grafana/grafana:latest` |
| Data | `/mnt/data/docker/grafana` |

## What it does

- Draws graphs and dashboards from data sources such as [Prometheus](prometheus.md).

## Why it is here

- Turns the raw metrics into readable server-health dashboards.

## How it is set up

- Host port 3002 to container 3000 (3000 is Open WebUI).
- Environment: `GF_SECURITY_ADMIN_USER=tadej`, `GF_SECURITY_ADMIN_PASSWORD` from `.env` (`GRAFANA_ADMIN_PASSWORD`), `GF_USERS_ALLOW_SIGN_UP=false`.
- Data (its SQLite `grafana.db`, plugins) in `/var/lib/grafana`.

## First run

- Log in as `tadej`. Add a data source of type Prometheus with URL `http://prometheus:9090`, then import dashboard ID 1860 (Node Exporter Full).

## Data and backups

- `scripts/backup.sh` takes a consistent SQLite snapshot (`db/grafana.db`) and copies the rest of `grafana/`.

## Operating notes

- **As of this writing Grafana has no data sources and no dashboards configured**, so it is effectively an empty install. Even after adding the data source, node graphs stay empty until the [Prometheus target problem](prometheus.md#operating-notes) is fixed.
- The admin variables only apply on the first start; changing them later does not change an existing user.

## Related

- [Prometheus](prometheus.md), [node-exporter](node-exporter.md)
