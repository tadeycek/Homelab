"""Decision engine — converts estimates into trade signals.

Given a market's live price and a Claude-estimated probability, this module:
  1. Determines which side (YES/NO) has positive edge (if any).
  2. Computes full Kelly fraction for that side.
  3. Applies the fractional Kelly multiplier from config.
  4. Returns a TradeSignal or None if the edge is below threshold.

Kelly formula for a binary contract:
  Contract pays $1 if you win, costs `price` per share.
  Net odds   b = (1 - price) / price
  Full Kelly = (p_win * b - (1 - p_win)) / b
             = (p_win - price) / (1 - price)

  Fractional Kelly = full_kelly * KELLY_FRACTION

This is conservative: a quarter-Kelly (0.25) loses roughly 1/16th the variance
of full Kelly while retaining ~3/4 of the long-run growth rate.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal

logger = logging.getLogger(__name__)

Side = Literal["BUY_YES", "BUY_NO"]


@dataclass
class TradeSignal:
    condition_id: str
    question: str
    side: Side
    token_id: str        # the CLOB token ID to trade
    price: float         # limit price for our order
    edge: float          # p_win - price  (always > 0 for a valid signal)
    p_win: float         # our estimated win probability
    full_kelly: float    # full Kelly fraction of bankroll
    kelly_frac: float    # fractional Kelly fraction (after multiplier)
    p_true_yes: float    # original YES estimate (for logging)
    confidence: float    # estimator confidence


def evaluate(
    *,
    condition_id: str,
    question: str,
    yes_token_id: str,
    no_token_id: str,
    p_true_yes: float,
    confidence: float,
    live_yes_price: float,
    min_edge: float = 0.08,
    min_confidence: float = 0.60,
    kelly_fraction: float = 0.25,
) -> TradeSignal | None:
    """Evaluate a candidate market and return a trade signal or None.

    Args:
        condition_id:     Gamma condition ID (for logging / persistence).
        question:         Human-readable question text.
        yes_token_id:     CLOB token ID for the YES outcome.
        no_token_id:      CLOB token ID for the NO outcome.
        p_true_yes:       Claude-estimated probability of YES resolution.
        confidence:       Estimator confidence (0–1).
        live_yes_price:   Current market price for YES (from CLOB mid).
        min_edge:         Minimum edge required to generate a signal.
        min_confidence:   Minimum estimator confidence required.
        kelly_fraction:   Fractional Kelly multiplier (0–1).

    Returns:
        TradeSignal if edge ≥ min_edge and confidence ≥ min_confidence,
        else None.
    """
    if confidence < min_confidence:
        logger.debug("Skip (low confidence %.2f): %s", confidence, question[:60])
        return None

    # We consider both YES and NO sides; pick the one with positive edge
    yes_edge = p_true_yes - live_yes_price
    no_edge = (1 - p_true_yes) - (1 - live_yes_price)

    if yes_edge >= no_edge and yes_edge >= min_edge:
        side: Side = "BUY_YES"
        p_win = p_true_yes
        price = live_yes_price
        token_id = yes_token_id
        edge = yes_edge
    elif no_edge > yes_edge and no_edge >= min_edge:
        side = "BUY_NO"
        p_win = 1 - p_true_yes
        price = 1 - live_yes_price
        token_id = no_token_id
        edge = no_edge
    else:
        logger.debug(
            "Skip (no edge — yes_edge=%.3f no_edge=%.3f): %s",
            yes_edge, no_edge, question[:60],
        )
        return None

    # Kelly: full fraction, then apply multiplier
    # b = net odds: you risk `price`, win `1-price`
    b = (1 - price) / price
    full_kelly = max(0.0, (p_win * b - (1 - p_win)) / b)
    frac_kelly = full_kelly * kelly_fraction

    if frac_kelly <= 0:
        logger.debug("Skip (negative Kelly): %s", question[:60])
        return None

    signal = TradeSignal(
        condition_id=condition_id,
        question=question,
        side=side,
        token_id=token_id,
        price=price,
        edge=edge,
        p_win=p_win,
        full_kelly=full_kelly,
        kelly_frac=frac_kelly,
        p_true_yes=p_true_yes,
        confidence=confidence,
    )
    logger.info(
        "SIGNAL  %-8s  price=%.3f  edge=+%.3f  kelly=%.4f  conf=%.2f  %s",
        side, price, edge, frac_kelly, confidence, question[:70],
    )
    return signal
