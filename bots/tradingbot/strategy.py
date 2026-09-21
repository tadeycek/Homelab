"""Strategy layer — pure EMA calculation and crossover detection.

No I/O or side effects here; all functions are deterministic given the same input.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum, auto

import pandas as pd

import config


class Signal(Enum):
    BUY = auto()
    SELL = auto()
    NONE = auto()


@dataclass(frozen=True)
class StrategyResult:
    fast_ema: float        # latest fast EMA value
    slow_ema: float        # latest slow EMA value
    prev_fast_ema: float   # previous fast EMA value
    prev_slow_ema: float   # previous slow EMA value
    signal: Signal
    close: float           # latest close price


def _ema_series(series: pd.Series, period: int) -> pd.Series:
    """Standard exponential moving average using pandas ewm (adjust=False matches most TA libs)."""
    return series.ewm(span=period, adjust=False).mean()


def analyse(
    df: pd.DataFrame,
    fast_period: int = config.FAST_EMA,
    slow_period: int = config.SLOW_EMA,
) -> StrategyResult:
    """Compute EMA crossover signal from a candle DataFrame.

    Requires at least (slow_period + 1) rows so that we can compare the last
    two data points.  Raises ValueError if the DataFrame is too short.
    """
    required = slow_period + 1
    if len(df) < required:
        raise ValueError(
            f"Need at least {required} candles, got {len(df)}."
        )

    close = df["close"].astype(float)
    fast = _ema_series(close, fast_period)
    slow = _ema_series(close, slow_period)

    fast_now, fast_prev = fast.iloc[-1], fast.iloc[-2]
    slow_now, slow_prev = slow.iloc[-1], slow.iloc[-2]

    # Crossover: fast crossed *above* slow → BUY
    # Crossunder: fast crossed *below* slow → SELL
    if fast_prev <= slow_prev and fast_now > slow_now:
        signal = Signal.BUY
    elif fast_prev >= slow_prev and fast_now < slow_now:
        signal = Signal.SELL
    else:
        signal = Signal.NONE

    return StrategyResult(
        fast_ema=fast_now,
        slow_ema=slow_now,
        prev_fast_ema=fast_prev,
        prev_slow_ema=slow_prev,
        signal=signal,
        close=close.iloc[-1],
    )
