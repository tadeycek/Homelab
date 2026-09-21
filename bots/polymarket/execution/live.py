"""Live broker — real CLOB order placement (Phase 7).

Activate by passing a LiveBroker instance to the main loop instead of
PaperBroker. Everything upstream is identical.

Pre-flight checklist before enabling live trading:
  □ Paper-traded long enough to see calibration metrics (weeks, not days)
  □ PK, FUNDER, ANTHROPIC_API_KEY set in .env
  □ Wallet funded with USDC on Polygon + small MATIC/POL for gas
  □ Ran setup_creds() manually once and confirmed it doesn't error
  □ Tested with tiny size (min 1–5 USDC) on a single low-stakes market
  □ Set MAX_DAILY_LOSS_USDC to an amount you're comfortable losing today
"""
from __future__ import annotations

import logging
import uuid

from data.clob import LiveClobClient, fetch_orderbook
from engine.decision import TradeSignal
from execution.broker import Broker, Fill

logger = logging.getLogger(__name__)


class LiveBroker(Broker):
    def __init__(
        self,
        pk: str,
        funder: str = "",
        signature_type: int = 0,
        taker_fee: float = 0.0,
        max_daily_loss_usdc: float = 50.0,
    ) -> None:
        self._clob = LiveClobClient(pk=pk, funder=funder, signature_type=signature_type)
        self._fee = taker_fee
        self._max_daily_loss = max_daily_loss_usdc
        self._daily_loss: float = 0.0
        self._is_ready = False

    def setup(self) -> None:
        """Derive L2 credentials. Call once at startup before trading."""
        self._clob.setup_creds()
        self._is_ready = True
        logger.info("LiveBroker ready.")

    def _guard_daily_loss(self, stake: float) -> bool:
        if self._daily_loss + stake > self._max_daily_loss:
            logger.warning(
                "Daily loss circuit breaker: $%.2f + $%.2f > $%.2f limit",
                self._daily_loss, stake, self._max_daily_loss,
            )
            return False
        return True

    def open_position(self, signal: TradeSignal, stake_usdc: float) -> Fill | None:
        if not self._is_ready:
            raise RuntimeError("Call setup() before trading.")
        if not self._guard_daily_loss(stake_usdc):
            return None

        # Convert USDC stake to share count
        # shares = USDC / price_per_share (approximate — exact after fill)
        estimated_shares = round(stake_usdc / signal.price, 2)

        try:
            resp = self._clob.place_order(
                token_id=signal.token_id,
                price=round(signal.price, 2),
                size=estimated_shares,
                side="BUY",
            )
        except Exception as exc:
            logger.error("LiveBroker open_position failed: %s", exc)
            return None

        order_id = resp.get("orderID") or resp.get("id") or f"live-{uuid.uuid4().hex[:8]}"
        fill_price = float(resp.get("price") or signal.price)
        actual_shares = stake_usdc / fill_price

        fill = Fill(
            condition_id=signal.condition_id,
            question=signal.question,
            side=signal.side,
            token_id=signal.token_id,
            requested_price=signal.price,
            fill_price=fill_price,
            shares=actual_shares,
            stake_usdc=stake_usdc,
            order_id=order_id,
        )
        logger.info(
            "LIVE FILL  %-8s  %.4f USDC/share  %.2f shares  $%.2f  %s",
            signal.side, fill_price, actual_shares, stake_usdc, signal.question[:60],
        )
        return fill

    def close_position(self, fill: Fill) -> Fill | None:
        if not self._is_ready:
            raise RuntimeError("Call setup() before trading.")

        book = fetch_orderbook(fill.token_id)
        close_price = book.best_bid or fill.fill_price * 0.95

        try:
            resp = self._clob.place_order(
                token_id=fill.token_id,
                price=round(close_price, 2),
                size=round(fill.shares, 2),
                side="SELL",
            )
        except Exception as exc:
            logger.error("LiveBroker close_position failed: %s", exc)
            return None

        proceeds = fill.shares * float(resp.get("price") or close_price)
        net = proceeds * (1 - self._fee)
        pnl = net - fill.stake_usdc
        self._daily_loss += max(0.0, -pnl)

        order_id = resp.get("orderID") or resp.get("id") or f"live-close-{uuid.uuid4().hex[:8]}"
        return Fill(
            condition_id=fill.condition_id,
            question=fill.question,
            side="BUY_YES" if fill.side == "BUY_NO" else "BUY_NO",
            token_id=fill.token_id,
            requested_price=close_price,
            fill_price=float(resp.get("price") or close_price),
            shares=fill.shares,
            stake_usdc=net,
            order_id=order_id,
        )
