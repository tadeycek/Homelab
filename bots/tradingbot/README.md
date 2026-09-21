# TradingBot

A **paper-trading** bot that simulates an EMA-crossover strategy on BTC/USDT using the Binance public feed via [ccxt](https://github.com/ccxt/ccxt).

> **This is a simulation only.** No real orders are ever placed. Not financial advice.

## Strategy

- **Signal:** Fast EMA (3) crossing above/below Slow EMA (8) on the 1-minute chart.
- **Entry:** BUY on bullish crossover (fast crosses above slow), SELL/exit on bearish crossover.
- **Risk model:** 25% of balance allocated per trade, 1.5% stop-loss, 2.0% take-profit.
- **Starting balance:** $200 USDT (simulated).

## Setup

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

## Run

```bash
python main.py
```

The bot fetches live OHLCV candles from Binance (public endpoint — no API key needed), evaluates the EMA signal once per minute, and logs simulated trade activity to stdout and `trading_bot.log`.

Press **Ctrl+C** to stop; a trade summary (closed trades, win rate, P&L) is printed on exit.

## Configuration

Edit [config.py](config.py) to change:

| Setting | Default | Description |
|---|---|---|
| `SYMBOL` | `BTC/USDT` | Trading pair |
| `TIMEFRAME` | `1m` | Candle interval |
| `FAST_EMA` | `3` | Fast EMA period |
| `SLOW_EMA` | `8` | Slow EMA period |
| `STARTING_BALANCE` | `200.0` | Simulated starting balance (USDT) |
| `MAX_RISK_PCT` | `0.25` | Fraction of balance allocated per trade |
| `STOP_LOSS_PCT` | `0.015` | Stop-loss distance (1.5%) |
| `TAKE_PROFIT_PCT` | `0.02` | Take-profit distance (2.0%) |
| `LOOP_INTERVAL` | `60` | Seconds between ticks |

## Known limitations / future improvements

- No trading fees or slippage modeled (results are optimistic).
- Stop-loss/take-profit checks only use the closing price, not candle high/low.
- The in-progress (unfinished) candle is included in signal calculation — can produce repaint.
- Dependencies are not pinned to exact versions.
- No tests.
- No drawdown kill-switch or daily-loss circuit breaker.
