"""Data layer — fetches OHLCV candles from Binance via ccxt."""

from __future__ import annotations

import ccxt
import pandas as pd

import config


def _make_exchange() -> ccxt.Exchange:
    return ccxt.binance({"enableRateLimit": True})


def fetch_candles(
    symbol: str = config.SYMBOL,
    timeframe: str = config.TIMEFRAME,
    limit: int = config.CANDLE_LIMIT,
) -> pd.DataFrame:
    """Return a DataFrame with columns [timestamp, open, high, low, close, volume].

    Raises ccxt.BaseError on network/API failures — caller should handle.
    """
    exchange = _make_exchange()
    raw = exchange.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)
    df = pd.DataFrame(raw, columns=["timestamp", "open", "high", "low", "close", "volume"])
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True)
    df = df.set_index("timestamp")
    return df
