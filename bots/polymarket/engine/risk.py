"""Risk controls — capital preservation layer.

Applied *after* decision.evaluate() returns a TradeSignal and *before* any
order is sent to the broker. All rules are stateless apart from the portfolio
state that is passed in. No mutation here — just approve / reject decisions.

Rules applied in order:
  1. Bankroll check               — we have enough cash
  2. Minimum stake floor          — don't trade dust
  3. Position cap                 — max_position_frac × bankroll
  4. Total exposure cap           — max_total_exposure × bankroll
  5. Slippage guard               — book too thin to fill cleanly
  6. Duplicate position guard     — already long this condition_id

Stop/exit logic (evaluate_stop):
  Re-assess an open position each cycle. Recommend exiting if:
    a. New edge is below stop_edge (our thesis has reversed)
    b. Live price has fallen enough from entry (unfavourable drift)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal

from data.clob import OrderBook
from engine.decision import TradeSignal

logger = logging.getLogger(__name__)

Verdict = Literal["APPROVE", "REJECT"]


@dataclass
class RiskResult:
    verdict: Verdict
    stake_usdc: float   # approved stake (0 if rejected)
    reason: str         # always populated — why approved or rejected


def check(
    signal: TradeSignal,
    *,
    bankroll: float,
    open_exposure: float,       # sum of current open stakes (USDC)
    has_position: bool,         # already holding this condition_id
    book: OrderBook,
    max_position_frac: float = 0.05,
    max_total_exposure: float = 0.50,
    min_stake: float = 5.0,
    max_slippage_frac: float = 0.06,  # reject if VWAP is >6% above mid (PM spreads are wide)
) -> RiskResult:
    """Apply all risk gates to a proposed trade. Returns a RiskResult.

    Args:
        signal:               Output from engine.decision.evaluate().
        bankroll:             Current available USDC (unrealised positions excluded
                              — they're tracked separately in open_exposure).
        open_exposure:        Total USDC currently staked across all open positions.
        has_position:         True if we already hold a position on this market.
        book:                 Live OrderBook from data.clob.fetch_orderbook().
        max_position_frac:    Max fraction of bankroll for a single position.
        max_total_exposure:   Max fraction of bankroll tied up across all positions.
        min_stake:            Minimum stake size in USDC (skip dust).
        max_slippage_frac:    Maximum allowed VWAP slippage over mid before reject.
    """
    # 1. Duplicate position guard
    if has_position:
        return RiskResult("REJECT", 0.0, "duplicate: already holding this market")

    # 2. Compute raw stake from Kelly fraction
    raw_stake = signal.kelly_frac * bankroll
    stake = min(raw_stake, max_position_frac * bankroll)

    # 3. Minimum stake floor
    if stake < min_stake:
        return RiskResult(
            "REJECT", 0.0,
            f"stake ${stake:.2f} below min ${min_stake:.2f}"
        )

    # 4. Total exposure cap
    if open_exposure + stake > max_total_exposure * bankroll:
        headroom = max_total_exposure * bankroll - open_exposure
        if headroom < min_stake:
            return RiskResult(
                "REJECT", 0.0,
                f"exposure cap: open=${open_exposure:.0f} + new=${stake:.0f} "
                f"> {max_total_exposure:.0%} × ${bankroll:.0f}"
            )
        # Scale down stake to fit within headroom
        stake = headroom
        if stake < min_stake:
            return RiskResult("REJECT", 0.0, "exposure cap: headroom too small after scale-down")

    # 5. Bankroll check
    if stake > bankroll:
        return RiskResult("REJECT", 0.0, f"insufficient bankroll ${bankroll:.0f}")

    # 6. Slippage guard
    mid = book.mid
    if mid is None:
        return RiskResult("REJECT", 0.0, "dead market: no bids or asks")

    vwap = book.vwap_to_fill(stake)
    if vwap is None:
        return RiskResult(
            "REJECT", 0.0,
            f"book too thin to fill ${stake:.0f}"
        )
    slippage = (vwap - mid) / mid
    if slippage > max_slippage_frac:
        return RiskResult(
            "REJECT", 0.0,
            f"slippage {slippage:.1%} > limit {max_slippage_frac:.1%}"
        )

    return RiskResult(
        "APPROVE", round(stake, 2),
        f"edge={signal.edge:.3f}  kelly={signal.kelly_frac:.4f}  "
        f"stake=${stake:.2f}  slippage={slippage:.2%}"
    )


@dataclass
class StopResult:
    should_exit: bool
    reason: str


def evaluate_stop(
    *,
    condition_id: str,
    entry_price: float,
    current_price: float,
    new_edge: float | None,     # None = we couldn't re-estimate this cycle
    stop_edge: float = 0.0,
    max_adverse_move: float = 0.20,  # exit if price moved >20% against us
) -> StopResult:
    """Decide whether to exit an open position.

    Args:
        entry_price:      Fill price when we entered the position.
        current_price:    Current live mid price.
        new_edge:         Re-computed edge from latest estimate. None if we
                          skipped re-estimation this cycle.
        stop_edge:        Minimum edge to stay in. Default 0 = exit if thesis flips.
        max_adverse_move: Exit if price has dropped this fraction from entry.
    """
    # a. Edge below stop threshold (thesis reversed)
    if new_edge is not None and new_edge < stop_edge:
        return StopResult(True, f"edge {new_edge:.3f} < stop {stop_edge:.3f}")

    # b. Adverse price move stop
    adverse_move = (entry_price - current_price) / entry_price
    if adverse_move > max_adverse_move:
        return StopResult(
            True,
            f"adverse move {adverse_move:.1%} > limit {max_adverse_move:.1%}"
        )

    return StopResult(False, "position OK")
