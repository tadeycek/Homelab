# Trading bot

> A **paper-trading** bot that simulates an EMA-crossover strategy on BTC/USDT. It never places real orders.

| | |
|---|---|
| Status | Running |
| Address | No UI; the [dashboard](dashboard.md) Bots page reads its log |
| Defined in | `bots/docker-compose.yml`; source in `bots/tradingbot/` |
| Image | Built from `bots/tradingbot.Dockerfile` (Python 3.12) |
| Data | `/mnt/data/docker/bots/tradingbot` (`trading_bot.log`) |

## What it does

- Fetches 1-minute BTC/USDT candles from Binance's public feed with ccxt (no API key), buys when a 3-period EMA crosses above an 8-period EMA and exits on the reverse crossover, with a 1.5% stop-loss and 2% take-profit, 25% of the balance per trade, and a simulated 200 USDT starting balance.

## Why it is here

- A small experiment in the homelab. Its source is in this repo because the separate GitHub repository was deleted.

## How it is set up

- Container built from `bots/tradingbot/`; `bots/tradingbot.entrypoint.sh` links the log into the data folder.
- No secrets: it uses Binance's public endpoint only.
- Settings are constants in `bots/tradingbot/config.py`.

## First run

- `docker compose up -d --build tradingbot` from the `bots/` directory.

## Data and backups

- The log is included in the [backup](../backup.md).

## Operating notes

- The README lists limitations: no fees or slippage, stop-loss and take-profit use closing prices only, no tests, and no drawdown kill-switch. Simulated results are optimistic.

## Related

- [Polymarket bot](polymarket-bot.md), [Dashboard](dashboard.md)
