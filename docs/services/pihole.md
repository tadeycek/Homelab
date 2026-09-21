# Pi-hole

> Network-wide DNS server and ad/tracker blocker.

| | |
|---|---|
| Status | Running (healthy) |
| Address | http://<server>:8080/admin; DNS on port 53 |
| Defined in | `docker-compose.yml` (`pihole:`) |
| Image | `pihole/pihole:latest` (v6) |
| Data | `/mnt/data/docker/pihole` |

## What it does

- Answers DNS queries for every device that uses this server as its resolver, blocks domains on its lists, and shows query statistics.

## Why it is here

- Blocks ads and trackers for the whole household without installing anything on each device.
- If the router hands out this server as the DNS resolver and Pi-hole is down, devices on the network lose name resolution.

## How it is set up

- Ports: 53 TCP and UDP for DNS, host 8080 to container 80 for the web UI (port 80 on the host belongs to Nginx Proxy Manager).
- `cap_add: NET_ADMIN`. The container's own resolvers are `127.0.0.1` and `1.1.1.1`.
- Volumes `pihole/etc-pihole` (configuration, gravity database, `pihole.toml`) and `pihole/etc-dnsmasq.d`.
- Host prerequisite: port 53 must be free, so the `systemd-resolved` stub listener is disabled (see [host setup](../host-setup.md#system-tuning-for-247-use)).
- Environment: `TZ`, and `WEBPASSWORD` from `.env` (`PIHOLE_WEBPASSWORD`).

## First run

- Point the router's DNS (or individual devices) at the server's LAN address.
- Add blocklists and local DNS records in the web UI.

## Data and backups

- `pihole/` is included in the [backup](../backup.md). Blocklists, local DNS records and settings live only there, not in git.

## Operating notes

- Pi-hole v6 stores the web password as a hash in `pihole.toml`. `WEBPASSWORD` seeds it on first start but is **not** re-applied on later restarts. To change it on a running container: `docker exec pihole pihole-FTL --config webserver.api.password "<new>"`, then update `.env`.
- The [dashboard](dashboard.md) authenticates to the v6 API with the same password.
- Recreating this container briefly interrupts DNS for the whole network.

## Related

- [Dashboard](dashboard.md) (statistics), [Nginx Proxy Manager](nginx-proxy-manager.md) (owns ports 80/443), [Host setup](../host-setup.md)
