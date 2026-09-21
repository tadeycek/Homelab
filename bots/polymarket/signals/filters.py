"""Crowd-bias heuristic pre-filter.

Runs entirely on Gamma metadata — zero API calls, zero LLM tokens.
Takes the full market list from Gamma and returns a shortlist of candidates
worth paying LLM estimation cost on.

Filtering logic (applied in order):
  1. Liquidity & volume gate         — drop illiquid, untradeable markets
  2. Time gate                       — too-fresh or too-far-future markets
  3. Candidate shortlist cap         — bound per-cycle LLM cost
  4. Bias flags                      — annotate candidates with bias signals
     a. Longshot bias    (price < 0.10 or > 0.90)
     b. Near-even       (0.40–0.60) with high liquidity — good for LLM edge
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

from data.gamma import Market

logger = logging.getLogger(__name__)


@dataclass
class Candidate:
    market: Market
    # Bias signals found — informational, used in estimator prompt context
    longshot: bool = False    # tail priced <0.10 or >0.90 — longshot bias likely
    near_even: bool = False   # market is close to 50/50 — efficiency uncertain

    @property
    def question(self) -> str:
        return self.market.question

    @property
    def yes_price(self) -> float:
        return self.market.yes_price

    @property
    def no_price(self) -> float:
        return self.market.no_price


def apply(
    markets: list[Market],
    *,
    min_liquidity: float = 2000.0,
    min_volume: float = 10_000.0,
    min_days: int = 2,
    max_days: int = 60,
    max_candidates: int = 25,
) -> list[Candidate]:
    """Filter a list of Gamma markets down to a candidate shortlist.

    Args:
        markets:        Full list from data.gamma.fetch_markets().
        min_liquidity:  Minimum USDC liquidity. Below this, our orders move the
                        market too much and fills are unreliable.
        min_volume:     Minimum total USDC traded. Thin history → noisy prices.
        min_days:       Minimum days until resolution. <2 days = last-minute
                        chaos, LLM can't add much.
        max_days:       Maximum days until resolution. >60 days = prices are
                        dominated by slow information flow, low turnover.
        max_candidates: Hard cap on shortlist size — controls LLM API cost.

    Returns:
        List of Candidate objects, sorted by liquidity descending (most liquid
        first, so the bot prioritises markets with real depth).
    """
    passed: list[Candidate] = []
    dropped_liq = dropped_time = dropped_other = 0

    for m in markets:
        # 1. Liquidity / volume gate
        if m.liquidity < min_liquidity or m.volume < min_volume:
            dropped_liq += 1
            continue

        # 2. Time gate
        days = m.days_to_resolve
        if not (min_days <= days <= max_days):
            dropped_time += 1
            continue

        # 3. Price sanity (should sum to ~1 after Gamma parse, but double-check)
        if not (0.02 <= m.yes_price <= 0.98):
            dropped_other += 1
            continue

        # 4. Annotate bias signals
        longshot = m.yes_price < 0.10 or m.yes_price > 0.90
        near_even = 0.40 <= m.yes_price <= 0.60

        passed.append(Candidate(market=m, longshot=longshot, near_even=near_even))

    # Sort by liquidity descending — deepest markets first
    passed.sort(key=lambda c: c.market.liquidity, reverse=True)

    shortlist = passed[:max_candidates]

    logger.info(
        "Filter: %d in → %d passed → %d shortlisted  "
        "(dropped: liq=%d time=%d other=%d)",
        len(markets), len(passed), len(shortlist),
        dropped_liq, dropped_time, dropped_other,
    )
    return shortlist
