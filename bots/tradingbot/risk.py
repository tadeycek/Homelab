"""Risk management — position sizing and pre-trade validation."""

from __future__ import annotations

import config


def position_size(balance: float) -> float:
    """Return the USDT amount to allocate on the next trade.

    Sizing rule (spot / no-leverage):
      position_usdt = balance * MAX_RISK_PCT

    A stop-loss hit therefore costs:
      balance * MAX_RISK_PCT * STOP_LOSS_PCT
    e.g. $200 * 25% * 1.5% = $0.75 (0.375% of account per loss)

    The result is capped at the full balance so we never overspend.

    Example (default config):
      balance = $200, MAX_RISK_PCT = 25%
      position = $200 * 0.25 = $50
    """
    if balance <= 0:
        return 0.0
    position_usdt = balance * config.MAX_RISK_PCT
    return min(position_usdt, balance)


def can_trade(balance: float, min_usdt: float = 1.0) -> bool:
    """Return True if there is enough balance to place a meaningful order."""
    return balance >= min_usdt
