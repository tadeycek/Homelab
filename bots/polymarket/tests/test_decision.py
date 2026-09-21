"""Unit tests for engine.decision and engine.risk.

Run with:  pytest tests/test_decision.py -v
No external calls or API keys needed.
"""
from __future__ import annotations

import pytest

from engine.decision import evaluate, TradeSignal
from engine.risk import check, evaluate_stop, RiskResult
from data.clob import OrderBook, OrderLevel


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _signal(**kwargs) -> TradeSignal | None:
    defaults = dict(
        condition_id="abc123",
        question="Will X happen?",
        yes_token_id="tok_yes",
        no_token_id="tok_no",
        p_true_yes=0.65,
        confidence=0.75,
        live_yes_price=0.50,
        min_edge=0.08,
        min_confidence=0.60,
        kelly_fraction=0.25,
    )
    defaults.update(kwargs)
    return evaluate(**defaults)


def _book(bid: float = 0.48, ask: float = 0.52, depth: float = 1000.0) -> OrderBook:
    return OrderBook(
        token_id="tok_yes",
        bids=[OrderLevel(bid, depth)],
        asks=[OrderLevel(ask, depth)],
    )


# ---------------------------------------------------------------------------
# Decision engine tests
# ---------------------------------------------------------------------------

class TestDecisionEvaluate:
    def test_yes_side_positive_edge(self):
        """p_true=0.65 vs market=0.50 → buy YES with edge 0.15."""
        sig = _signal(p_true_yes=0.65, live_yes_price=0.50)
        assert sig is not None
        assert sig.side == "BUY_YES"
        assert pytest.approx(sig.edge, abs=1e-6) == 0.15
        assert sig.price == 0.50

    def test_no_side_positive_edge(self):
        """p_true=0.30 vs market_yes=0.55 → NO side has edge.
        NO edge = (1-0.30) - (1-0.55) = 0.70 - 0.45 = 0.25."""
        sig = _signal(p_true_yes=0.30, live_yes_price=0.55)
        assert sig is not None
        assert sig.side == "BUY_NO"
        assert pytest.approx(sig.edge, abs=1e-4) == 0.25

    def test_no_edge_returns_none(self):
        """p_true ≈ market price → no edge → None."""
        sig = _signal(p_true_yes=0.51, live_yes_price=0.50)
        assert sig is None  # edge 0.01 < min_edge 0.08

    def test_low_confidence_returns_none(self):
        sig = _signal(p_true_yes=0.70, live_yes_price=0.50, confidence=0.50)
        assert sig is None

    def test_kelly_fraction_applied(self):
        """Full Kelly should be multiplied by kelly_fraction."""
        sig = _signal(p_true_yes=0.65, live_yes_price=0.50, kelly_fraction=0.25)
        assert sig is not None
        # Full Kelly for p=0.65, price=0.50: b=1, kelly=0.65-0.50=0.15 / 1 = 0.15
        # (simplified: (p*b-(1-p))/b where b=1)  → 0.30 actually
        # Exact: b=(1-0.5)/0.5=1, full_k=(0.65*1-(1-0.65))/1 = 0.30
        assert pytest.approx(sig.full_kelly, abs=1e-4) == 0.30
        assert pytest.approx(sig.kelly_frac, abs=1e-4) == 0.30 * 0.25

    def test_zero_kelly_at_break_even(self):
        """At p_win = price, Kelly should be ~0."""
        sig = _signal(p_true_yes=0.50, live_yes_price=0.50,
                      min_edge=0.0, min_confidence=0.0)
        # evaluate() returns None when Kelly <= 0 (it checks frac_kelly > 0)
        # p=0.50, price=0.50 → full_kelly=0 → returns None
        assert sig is None

    def test_edge_caps_at_correct_side(self):
        """With YES edge = 0.20 and NO edge = -0.20, signal picks YES."""
        sig = _signal(p_true_yes=0.70, live_yes_price=0.50)
        assert sig is not None
        assert sig.side == "BUY_YES"

    def test_prefers_higher_edge_side(self):
        """When NO edge > YES edge, picks NO."""
        # p_true_yes=0.20, market_yes=0.45
        # YES edge = 0.20-0.45 = -0.25 (negative)
        # NO edge  = 0.80-0.55 = +0.25 → wins
        sig = _signal(p_true_yes=0.20, live_yes_price=0.45)
        assert sig is not None
        assert sig.side == "BUY_NO"
        assert pytest.approx(sig.edge, abs=1e-4) == 0.25


# ---------------------------------------------------------------------------
# Risk controls tests
# ---------------------------------------------------------------------------

class TestRiskCheck:
    def _make_signal(self) -> TradeSignal:
        s = _signal(p_true_yes=0.70, live_yes_price=0.50)
        assert s is not None
        return s

    def test_approve_normal_trade(self):
        sig = self._make_signal()
        result = check(
            sig,
            bankroll=500.0,
            open_exposure=0.0,
            has_position=False,
            book=_book(bid=0.48, ask=0.52, depth=2000.0),
        )
        assert result.verdict == "APPROVE"
        assert result.stake_usdc > 0

    def test_reject_duplicate_position(self):
        sig = self._make_signal()
        result = check(
            sig, bankroll=500.0, open_exposure=0.0,
            has_position=True, book=_book(),
        )
        assert result.verdict == "REJECT"
        assert "duplicate" in result.reason

    def test_reject_below_min_stake(self):
        """With tiny bankroll, Kelly fraction yields dust — reject."""
        sig = _signal(p_true_yes=0.60, live_yes_price=0.50,
                      kelly_fraction=0.05)  # tiny multiplier
        assert sig is not None
        result = check(
            sig, bankroll=10.0, open_exposure=0.0,
            has_position=False, book=_book(depth=500.0),
            min_stake=5.0,
        )
        # kelly_frac ~ 0.05 * ((0.6*1-0.4)/1) = 0.05*0.2=0.01 → stake=$0.10
        assert result.verdict == "REJECT"
        assert "min" in result.reason.lower() or "stake" in result.reason.lower()

    def test_reject_exposure_cap(self):
        """Already at exposure cap → reject."""
        sig = self._make_signal()
        result = check(
            sig, bankroll=500.0,
            open_exposure=250.0,   # already at 50% cap
            has_position=False,
            book=_book(depth=5000.0),
            max_total_exposure=0.50,
        )
        assert result.verdict == "REJECT"

    def test_reject_dead_market(self):
        dead_book = OrderBook(token_id="tok_yes", bids=[], asks=[])
        sig = self._make_signal()
        result = check(
            sig, bankroll=500.0, open_exposure=0.0,
            has_position=False, book=dead_book,
        )
        assert result.verdict == "REJECT"
        assert "mid" in result.reason.lower() or "dead" in result.reason.lower()

    def test_position_cap_scales_down_not_reject(self):
        """Big Kelly output gets capped to max_position_frac, not rejected."""
        sig = _signal(p_true_yes=0.90, live_yes_price=0.50)  # huge edge → big Kelly
        assert sig is not None
        result = check(
            sig, bankroll=500.0, open_exposure=0.0,
            has_position=False, book=_book(depth=100_000.0),
            max_position_frac=0.05, min_stake=5.0,
        )
        assert result.verdict == "APPROVE"
        assert result.stake_usdc <= 0.05 * 500.0 + 0.01  # capped at 5% + float tolerance

    def test_reject_thin_book_slippage(self):
        """Book too thin for the stake → VWAP fails → reject."""
        sig = self._make_signal()
        thin_book = OrderBook(
            token_id="tok_yes",
            bids=[OrderLevel(0.48, 0.01)],   # only $0.005 of depth
            asks=[OrderLevel(0.52, 0.01)],
        )
        result = check(
            sig, bankroll=500.0, open_exposure=0.0,
            has_position=False, book=thin_book,
            min_stake=5.0,
        )
        assert result.verdict == "REJECT"


# ---------------------------------------------------------------------------
# Stop logic tests
# ---------------------------------------------------------------------------

class TestEvaluateStop:
    def test_no_stop_when_thesis_holds(self):
        result = evaluate_stop(
            condition_id="abc",
            entry_price=0.40,
            current_price=0.42,
            new_edge=0.10,
            stop_edge=0.0,
        )
        assert not result.should_exit

    def test_stop_on_negative_edge(self):
        result = evaluate_stop(
            condition_id="abc",
            entry_price=0.40,
            current_price=0.35,
            new_edge=-0.05,   # thesis reversed
            stop_edge=0.0,
        )
        assert result.should_exit
        assert "edge" in result.reason

    def test_stop_on_adverse_price_move(self):
        """25% adverse move → stop (limit 20%)."""
        result = evaluate_stop(
            condition_id="abc",
            entry_price=0.40,
            current_price=0.30,  # (0.40-0.30)/0.40 = 25% drop
            new_edge=None,
            stop_edge=0.0,
            max_adverse_move=0.20,
        )
        assert result.should_exit
        assert "adverse" in result.reason.lower()

    def test_no_stop_when_edge_is_none(self):
        """If we skipped re-estimation, only price-move stop applies."""
        result = evaluate_stop(
            condition_id="abc",
            entry_price=0.40,
            current_price=0.41,
            new_edge=None,
            stop_edge=0.0,
        )
        assert not result.should_exit
