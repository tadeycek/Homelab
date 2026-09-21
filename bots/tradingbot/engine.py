"""Paper trading engine — simulates order execution and tracks P&L.

State is held in the PaperTrader instance.  All prices are in USDT.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import config


@dataclass
class Position:
    id: str
    symbol: str
    entry_price: float
    quantity: float        # BTC quantity
    cost: float            # USDT spent (entry_price * quantity)
    stop_loss: float
    take_profit: float
    opened_at: datetime
    candles_open: int = 0  # incremented each tick; guards minimum hold time


@dataclass
class ClosedTrade:
    id: str
    symbol: str
    entry_price: float
    exit_price: float
    quantity: float
    cost: float
    proceeds: float
    pnl: float
    pnl_pct: float
    reason: str            # "stop_loss" | "take_profit" | "signal" | "manual"
    opened_at: datetime
    closed_at: datetime


@dataclass
class PaperTrader:
    balance: float = field(default_factory=lambda: config.STARTING_BALANCE)
    position: Optional[Position] = None
    closed_trades: list[ClosedTrade] = field(default_factory=list)

    # ------------------------------------------------------------------ #
    #  Read-only helpers                                                   #
    # ------------------------------------------------------------------ #

    @property
    def in_position(self) -> bool:
        return self.position is not None

    def equity(self, current_price: float) -> float:
        """Total account value: cash + unrealised position value."""
        if self.position is None:
            return self.balance
        return self.balance + self.position.quantity * current_price

    def unrealised_pnl(self, current_price: float) -> float:
        if self.position is None:
            return 0.0
        return (current_price - self.position.entry_price) * self.position.quantity

    def total_pnl(self) -> float:
        return sum(t.pnl for t in self.closed_trades)

    def win_rate(self) -> float:
        if not self.closed_trades:
            return 0.0
        wins = sum(1 for t in self.closed_trades if t.pnl > 0)
        return wins / len(self.closed_trades)

    def tick_position(self) -> None:
        """Call once per tick while in a position to advance the candle counter."""
        if self.position is not None:
            self.position.candles_open += 1

    @property
    def candles_in_trade(self) -> int:
        return self.position.candles_open if self.position is not None else 0

    # ------------------------------------------------------------------ #
    #  Order execution                                                     #
    # ------------------------------------------------------------------ #

    def open_position(self, price: float, usdt_amount: float) -> Position:
        """Buy BTC with *usdt_amount* at *price*.  Returns the new Position."""
        if self.in_position:
            raise RuntimeError("Already in a position — close it first.")
        if usdt_amount > self.balance:
            raise ValueError(f"Insufficient balance: have {self.balance:.2f}, need {usdt_amount:.2f}")
        if usdt_amount <= 0:
            raise ValueError("usdt_amount must be positive.")

        quantity = usdt_amount / price
        stop_loss = price * (1 - config.STOP_LOSS_PCT)
        take_profit = price * (1 + config.TAKE_PROFIT_PCT)

        pos = Position(
            id=str(uuid.uuid4())[:8],
            symbol=config.SYMBOL,
            entry_price=price,
            quantity=quantity,
            cost=usdt_amount,
            stop_loss=stop_loss,
            take_profit=take_profit,
            opened_at=datetime.now(timezone.utc),
        )
        self.balance -= usdt_amount
        self.position = pos
        return pos

    def close_position(self, price: float, reason: str) -> ClosedTrade:
        """Sell the entire open position at *price*."""
        if not self.in_position:
            raise RuntimeError("No open position to close.")
        assert self.position is not None
        pos = self.position
        proceeds = pos.quantity * price
        pnl = proceeds - pos.cost
        pnl_pct = pnl / pos.cost

        trade = ClosedTrade(
            id=pos.id,
            symbol=pos.symbol,
            entry_price=pos.entry_price,
            exit_price=price,
            quantity=pos.quantity,
            cost=pos.cost,
            proceeds=proceeds,
            pnl=pnl,
            pnl_pct=pnl_pct,
            reason=reason,
            opened_at=pos.opened_at,
            closed_at=datetime.now(timezone.utc),
        )
        self.balance += proceeds
        self.position = None
        self.closed_trades.append(trade)
        return trade

    # ------------------------------------------------------------------ #
    #  Stop/TP check (call on every tick while in position)               #
    # ------------------------------------------------------------------ #

    def check_exits(self, current_price: float) -> Optional[ClosedTrade]:
        """Close the position if price hit stop-loss or take-profit.

        Returns the ClosedTrade if triggered, else None.
        """
        if not self.in_position:
            return None
        assert self.position is not None
        pos = self.position
        if current_price <= pos.stop_loss:
            return self.close_position(current_price, reason="stop_loss")
        if current_price >= pos.take_profit:
            return self.close_position(current_price, reason="take_profit")
        return None
