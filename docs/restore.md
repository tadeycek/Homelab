# Restoring the homelab

Rebuild order for a fresh machine, or after losing a disk. Git restores the
*configuration*; a backup snapshot restores the *data and secrets*
(see [backup.md](backup.md)).

## 0. What you need

- This repo (`git clone`).
- A backup snapshot, ideally a copy that is not on the dead machine.
  Its layout: `db/`, `data/`, `secrets/secrets.tar.gz`.

## 1. Base system

1. Install Ubuntu 24.04.
2. Install Docker Engine and the Compose plugin; add your user to the `docker` group.
3. Install Tailscale and run `sudo tailscale up` (see [host-setup.md](host-setup.md)).
4. Format the data disk as ext4, add the `/etc/fstab` line from
   [host-setup.md](host-setup.md), and `sudo mount -a`.

## 2. Get the code

```bash
git clone <repo-url> ~/homeserver
cd ~/homeserver
```

The bot source (`bots/tradingbot`, `bots/polymarket`) is part of this repo. Only their
`.env` files come from the backup. Odysseus is a third-party project and is not in
this repo; restore it separately if you still want it.

## 3. Restore secrets

```bash
sudo tar xzf <snapshot>/secrets/secrets.tar.gz -C ~/homeserver
sudo chown -R "$USER": ~/homeserver
chmod 600 ~/homeserver/.env ~/homeserver/services/*/.env
```

Without a snapshot, copy each `.env.example` to `.env` and fill it in. Note that
the database passwords must match what the restored databases already use.

## 4. Restore data

```bash
sudo rsync -a <snapshot>/data/ /mnt/data/docker/
```

Do **not** start the containers yet.

## 5. Bring up the stacks

```bash
cd ~/homeserver
# Databases first, so their dumps can be loaded (see step 6)
docker compose up -d nextcloud-db immich-db
```

## 6. Load the database dumps

Immich (Postgres):

```bash
zcat <snapshot>/db/immich.sql.gz | docker exec -i immich-db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
```

Nextcloud (MariaDB):

```bash
zcat <snapshot>/db/nextcloud.sql.gz | docker exec -i nextcloud-db sh -c 'mariadb -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'
```

Vaultwarden and Grafana are plain SQLite files. Stop the container, then:

```bash
cp <snapshot>/db/vaultwarden.sqlite3 /mnt/data/docker/vaultwarden/db.sqlite3
cp <snapshot>/db/grafana.db          /mnt/data/docker/grafana/grafana.db
```

## 7. Start everything

```bash
cd ~/homeserver
docker compose up -d --build                              # main stack
(cd services/duckdns     && docker compose up -d)
(cd services/skyfactory4 && docker compose up -d)
(cd bots                 && docker compose up -d --build)
```

`docker compose up -d` in the main stack also starts `lidarr` and `navidrome`,
which are currently kept stopped on purpose. Stop them again with
`docker compose stop lidarr navidrome` if you want the previous state.

## 8. Check

- `docker ps` shows the expected containers healthy.
- Open the dashboard, Pi-hole, Vaultwarden, Immich and Nextcloud and log in.
- Point your router's DNS at the server once Pi-hole is answering.
- Uptime Kuma should show everything green after a few minutes.

## What a restore does *not* recover

- `/mnt/data/media`: re-download it.
- Ollama models: `docker exec ollama ollama pull <model>`.
- Odysseus and its volumes.
- Anything changed after the snapshot was taken.
