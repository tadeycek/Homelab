# TikTok Clip Factory (external, not in this repo)

> A Python web app that cuts source videos into short clips. The dashboard's Clips page is its front end.

| | |
|---|---|
| Status | Running as a **host** systemd service (`clipfactory.service`, enabled) |
| Address | http://<server>:5757 |
| Defined in | **Not in this repo.** Lives in `~/tiktok-clipper`, unit at `/etc/systemd/system/clipfactory.service` |
| Image | None; runs from a Python virtualenv (`venv/bin/python app.py`) |
| Data | `~/tiktok-clipper/{source_clips,output,thumbnails,audio}` |

## What it does

- A Flask app (`app.py`) that manages source videos and generates short clips; the dashboard proxies to it (`/api/cf/analyze`, `/api/cf/stream/:id`).

## Why it is here

- It is documented here because the dashboard depends on it and it is part of what the server runs, even though it is not a container and not in git.

## How it is set up

- A systemd unit runs `app.py` from `/home/tadej/tiktok-clipper` as user `tadej` with `Restart=on-failure`.
- The dashboard reaches it on the server's LAN address, port 5757, hard-coded in `server.js`.

## First run

- `setup.sh` creates the virtualenv and installs dependencies; `run.sh` starts it by hand (its banner text says port 5055, but the service listens on 5757).

## Data and backups

- **Not backed up and not in git.** `~/tiktok-clipper` is not a git repository, and `scripts/backup.sh` does not cover it (or `tiktok_config.json` inside it).

## Operating notes

- This is the biggest gap in the documented setup: if the disk fails, this app and its configuration are lost.
- A separate `~/clipfactory` folder (which is a git repo) also exists; how it relates to this project is not documented here.
- Options: add `~/tiktok-clipper` (without `venv`, media and secrets) to this repo, or at least to the backup script.

## Related

- [Dashboard](dashboard.md)
