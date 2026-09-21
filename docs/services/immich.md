# Immich (4 containers)

> Self-hosted photo and video library with face and object search, similar to Google Photos.

| | |
|---|---|
| Status | Running (`immich-server`, `immich-machine-learning`, `immich-redis`, `immich-db`) |
| Address | http://<server>:2283 |
| Defined in | `docker-compose.yml` (`immich-*`) |
| Image | `ghcr.io/immich-app/immich-server:release`, `...-machine-learning:release`, `redis:7-alpine`, `tensorchord/pgvecto-rs:pg14-v0.2.0` |
| Data | `/mnt/data/docker/immich/{upload,db,redis,ml-cache}` |

## What it does

- Backs up photos and videos from phones and browses them by date, person and content.
- ['**immich-server**: the web app, API and background jobs (port 2283).', '**immich-machine-learning**: face recognition and smart-search models, running on the CPU.', '**immich-redis**: job queue and cache.', '**immich-db**: PostgreSQL with the pgvecto.rs vector extension Immich needs for similarity search.']

## Why it is here

- A private replacement for a cloud photo service, with the photos on the data disk.

## How it is set up

- `immich-server` depends on the database and redis and reads the shared password from `.env` (`IMMICH_DB_PASSWORD`, also used by the database container).
- Photos are stored under `immich/upload`; the database under `immich/db`; the model cache under `immich/ml-cache`.
- The database image is pinned (`pg14-v0.2.0`) because the vector extension is version-sensitive.

## First run

- Open the web UI and create the admin account, then connect the phone app with the server address.

## Data and backups

- `scripts/backup.sh` dumps the database (`db/immich.sql.gz`) and copies `immich/upload` (the photos). The raw `immich/db` directory, `ml-cache` and `redis` are excluded (databases are dumped instead, the rest are rebuildable).
- `immich-server` also has an anonymous Docker volume that is not backed up; it has not been verified to hold anything irreplaceable.

## Operating notes

- The `release` tag follows the newest Immich, and Immich has had breaking changes between releases. Read the release notes before pulling a new image, and consider pinning a version.
- Restore the database dump **before** starting `immich-server`.

## Related

- [Backups](../backup.md), [Restore guide](../restore.md)
