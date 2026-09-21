# Portainer

> A web UI for managing Docker: containers, images, volumes and networks.

| | |
|---|---|
| Status | Running |
| Address | http://<server>:9000, https://<server>:9443 |
| Defined in | `docker-compose.yml` (`portainer:`) |
| Image | `portainer/portainer-ce:latest` |
| Data | `/mnt/data/docker/portainer` |

## What it does

- Lets you inspect, start, stop and open a console in any container, and browse logs, volumes and networks from the browser.

## Why it is here

- It is the fallback when the command line is not at hand, for example from a phone over Tailscale.
- Its admin account is pre-seeded from configuration, so the setup is reproducible.

## How it is set up

- Mounts the Docker socket (`/var/run/docker.sock`) and `/etc/localtime` (read-only).
- `security_opt: no-new-privileges:true`.
- The admin account is created at first start via `--admin-password`, passed as a **bcrypt hash** from `PORTAINER_ADMIN_PASSWORD_HASH` in `.env`. Portainer disables its first-run setup page if no admin is created shortly after it starts, which is why the account is seeded rather than created by hand.

## First run

- Fill in `PORTAINER_ADMIN_PASSWORD_HASH` before the first start (the generator command is in `.env.example`). Log in as `admin`.

## Data and backups

- `/mnt/data/docker/portainer` (Portainer's database and certificates) is included in the [backup](../backup.md).

## Operating notes

- The `--admin-password` option only applies while Portainer initialises a fresh data directory. Changing the environment variable later does not change an existing password; change it in the Portainer UI.
- The hash used to be written directly in `docker-compose.yml`; it was moved into `.env` and removed from the git history.
- Like the [dashboard](dashboard.md), it holds the Docker socket, so treat access to it as root access.

## Related

- [Dashboard](dashboard.md), [Uptime Kuma](uptime-kuma.md) (both also use the Docker socket)
