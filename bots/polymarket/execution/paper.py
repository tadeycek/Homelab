"""Paper broker — simulate fills against the real CLOB order book.

No keys needed. All order-book reads are public.

Simulation model:
  - Opening: fill at the VWAP computed from the live ask side for `stake_usdc`.
  - Closing:  fill at the VWAP computed from the live bid side for our shares.
  - A small simulated fee (config.taker_fee) is deducted from proceeds.

This is conservative — real fills may be slightly better or worse depending on
timing, but VWAP gives a realistic cost estimate for the given order size.
"""
from __future__ import annotations

import logging
import uuid

from data.clob import OrderBook, fetch_orderbook
from engine.decision import TradeSignal
from execution.broker import Broker, Fill

logger = logging.getLogger(__name__)


class PaperBroker(Broker):
    def __init__(self, taker_fee: float = 0.0) -> None:
        self._fee = taker_fee

    def open_position(self, signal: TradeSignal, stake_usdc: float) -> Fill | None:
        """Simulate buying `stake_usdc` worth of the signal's token.

        Returns:
            Fill if the book has enough depth, None if VWAP calculation fails
            (book too thin — risk.check() should have caught this, but defense
            in depth is good).
        """
        try:
            book: OrderBook = fetch_orderbook(signal.token_id)
        except Exception as exc:
            logger.warning("Paper open_position: book fetch failed: %s", exc)
            return None

        vwap = book.vwap_to_fill(stake_usdc)
        if vwap is None:
            logger.warning("Paper open_position: book too thin for $%.2f", stake_usdc)
            return None

        # shares = USDC spent / price per share
        shares = stake_usdc / vwap
        fill = Fill(
            condition_id=signal.condition_id,
            question=signal.question,
            side=signal.side,
            token_id=signal.token_id,
            requested_price=signal.price,
            fill_price=vwap,
            shares=shares,
            stake_usdc=stake_usdc,
            order_id=f"paper-{uuid.uuid4().hex[:8]}",
        )
        logger.info(
            "PAPER FILL  %-8s  %.4f USDC/share  %.2f shares  $%.2f  %s",
            signal.side, vwap, shares, stake_usdc, signal.question[:60],
        )
        return fill

    def close_position(self, fill: Fill) -> Fill | None:
        """Simulate selling `fill.shares` back into the bid side of the book."""
        try:
            book: OrderBook = fetch_orderbook(fill.token_id)
        except Exception as exc:
            logger.warning("Paper close_position: book fetch failed: %s", exc)
            return None

        # Walk the bid side to estimate proceeds
        proceeds = self._vwap_bid(book, fill.shares)
        if proceeds is None:
            # No bid depth — assume worst-case: sell at best bid
            if book.best_bid is None:
                logger.warning("Paper close_position: no bids for %s", fill.token_id)
                return None
            proceeds = book.best_bid * fill.shares

        net_proceeds = proceeds * (1 - self._fee)
        close_fill = Fill(
            condition_id=fill.condition_id,
            question=fill.question,
            side="BUY_YES" if fill.side == "BUY_NO" else "BUY_NO",  # opposite
            token_id=fill.token_id,
            requested_price=book.best_bid or 0.0,
            fill_price=proceeds / fill.shares,
            shares=fill.shares,
            stake_usdc=net_proceeds,
            order_id=f"paper-close-{uuid.uuid4().hex[:8]}",
        )
        logger.info(
            "PAPER CLOSE  %.4f USDC/share  $%.2f proceeds  %s",
            close_fill.fill_price, net_proceeds, fill.question[:60],
        )
        return close_fill

    @staticmethod
    def _vwap_bid(book: OrderBook, shares: float) -> float | None:
        """Walk bid side and estimate total proceeds for `shares` sold."""
        remaining = shares
        proceeds = 0.0
        for level in book.bids:
            take = min(remaining, level.size)
            proceeds += take * level.price
            remaining -= take
            if remaining <= 0:
                break
        if remaining > 0:
            return None
        return proceeds
