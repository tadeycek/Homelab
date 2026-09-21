# Vaultwarden

> A lightweight Bitwarden-compatible password manager server.

| | |
|---|---|
| Status | Running (healthy) |
| Address | https://<server>:8443 |
| Defined in | `docker-compose.yml` (`vaultwarden:`) |
| Image | `vaultwarden/server:latest` |
| Data | `/mnt/data/docker/vaultwarden` |

## What it does

- Stores passwords and secure notes and syncs them to the official Bitwarden apps and browser extensions.

## Why it is here

- A self-hosted password vault.

## How it is set up

- Serves HTTPS itself: `ROCKET_TLS` points at `cert.pem` and `key.pem` from the `certs/` folder (mounted read-only at `/ssl`), on port 8443. Bitwarden clients refuse plain HTTP.
- `DOMAIN` is the LAN address on 8443. `SIGNUPS_ALLOWED` is `"true"`.
- The certificates are made with mkcert, so each client device has to trust the mkcert root CA.
- The compose file mounts `/home/tadej/homeserver/certs` by **absolute path**, so the repo must live at that location, or the path must be edited.

## First run

- Create your account (`SIGNUPS_ALLOWED` is on), then set `SIGNUPS_ALLOWED: "false"` and recreate the container so nobody else can register.

## Data and backups

- `scripts/backup.sh` takes a consistent SQLite snapshot (`db/vaultwarden.sqlite3`). `db.sqlite3*` is excluded from the raw copy; attachments and keys in the folder are copied.
- This is the most sensitive data on the server; treat the backup folder accordingly.

## Operating notes

- Leaving signups open on a reachable server allows anyone who can connect to create an account.
- The certificates in `certs/` are gitignored; regenerate with `mkcert` if lost.

## Related

- [Host setup](../host-setup.md#secrets), [Backups](../backup.md)
