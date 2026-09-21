# Polymarket bot

> A trading bot for Polymarket prediction markets that uses Claude to estimate probabilities. Defaults to paper trading.

| | |
|---|---|
| Status | **Stopped** (exited 2 months ago) |
| Address | No UI; the [dashboard](dashboard.md) Bots page reads its data |
| Defined in | `bots/docker-compose.yml`; source in `bots/polymarket/` |
| Image | Built from `bots/polymarket.Dockerfile` (Python 3.12) |
| Data | `/mnt/data/docker/bots/polymarket` (`portfolio.db`, `bot.log`) |

## What it does

- Each cycle it finds active markets, filters them, reads the live order book, asks Claude for a probability estimate, decides with an edge and Kelly-fraction rule, applies risk limits, and simulates the fill.
- ['Run modes: `python main.py` (paper loop), `--live` (real orders, needs a funded wallet), `--once`, `--summary`.', 'Key defaults (all overridable in `.env`): bankroll 500 USDC, minimum edge 0.08, minimum confidence 0.6, Kelly fraction 0.25, max position 5% and max total exposure 50% of bankroll, loop every 900 seconds, estimator model `claude-sonnet-4-6`.']

## Why it is here

- It is a project, not infrastructure. Its source was moved into this repo when the separate GitHub repository was deleted, so this repo is now its only remote copy.

## How it is set up

- Container built from `bots/polymarket/`, run through `bots/polymarket.entrypoint.sh`, which links `portfolio.db` and `bot.log` into the mounted data folder so state survives rebuilds.
- Secrets come from `bots/polymarket/.env` (`env_file`); log rotation is capped at 3 files of 10 MB.
- Modules: `data/` (Gamma and CLOB API clients), `signals/` (filters, news, LLM estimator), `engine/` (decision and risk), `execution/` (paper and live brokers), `portfolio/` (SQLite state), `tests/`.

## First run

- Copy `bots/polymarket/.env.example` to `.env` and set `ANTHROPIC_API_KEY`. `PK` and `FUNDER` are needed only for live trading.
- From the `bots/` directory: `docker compose up -d --build polymarket-bot`.

## Data and backups

- `portfolio.db` (a live SQLite file in WAL mode) and the log are included in the [backup](../backup.md) via `/mnt/data/docker/bots`. `bots/polymarket/.env` is in `secrets/secrets.tar.gz`.

## Operating notes

- Live mode uses a wallet private key (`PK`); never commit `.env` and think carefully before enabling `--live`.
- Calls the Anthropic API, which costs money each cycle.

## Related

- [Trading bot](tradingbot.md), [Dashboard](dashboard.md)
