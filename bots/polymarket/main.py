"""Polymarket trading bot — main orchestration loop.

Pipeline each cycle:
  1. Discover active binary markets via Gamma API
  2. Heuristic pre-filter (liquidity, time, bias)
  3. Fetch live CLOB price for each candidate
  4. Fetch news context and run Claude estimation
  5. Decision engine (edge + Kelly)
  6. Risk gates (position caps, slippage, exposure)
  7. Paper (or live) broker fill
  8. Re-assess open positions for stop/exit

Run modes:
  python main.py              # paper trading loop (default)
  python main.py --live       # live trading (Phase 7 — requires funded wallet)
  python main.py --once       # single cycle then exit (useful for testing)
  python main.py --summary    # print portfolio summary and exit

Environment:
  Copy .env.example → .env and fill in ANTHROPIC_API_KEY at minimum.
  For live trading also set PK, FUNDER.
"""
from __future__ import annotations

import argparse
import logging
import sys
import time

import config as _config_module
from config import cfg
from data.gamma import fetch_markets
from data.clob import fetch_mid_price, fetch_orderbook
from engine import decision, risk
from execution.broker import Broker
from execution.paper import PaperBroker
from portfolio import state as portfolio
from signals import estimator, filters
from signals.news import recent_context

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("bot.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger("main")


# ---------------------------------------------------------------------------
# Candidate pool — refreshed when exhausted, consumed in batches each cycle
# ---------------------------------------------------------------------------

_pool: list[filters.Candidate] = []
_pool_offset: int = 0


def _refresh_pool() -> None:
    global _pool, _pool_offset
    logger.info("=== Refreshing candidate pool ===")
    markets = fetch_markets(max_markets=3000)
    if not markets:
        logger.warning("No markets returned from Gamma.")
        _pool = []
        _pool_offset = 0
        return
    _pool = filters.apply(
        markets,
        min_liquidity=cfg.min_liquidity,
        min_volume=cfg.min_volume,
        min_days=cfg.min_days_to_resolve,
        max_days=cfg.max_days_to_resolve,
        max_candidates=cfg.pool_size,
    )
    _pool_offset = 0
    logger.info("Pool ready: %d markets (batch size %d → %d cycles before refresh).",
                len(_pool), cfg.batch_size,
                -(-len(_pool) // cfg.batch_size) if _pool else 0)


# ---------------------------------------------------------------------------
# Core cycle
# ---------------------------------------------------------------------------

def run_cycle(broker: Broker) -> None:
    """Evaluate the next batch of candidates, then check open position stops."""
    global _pool_offset

    # ---- 1. Refresh pool when exhausted ------------------------------------
    if _pool_offset >= len(_pool):
        _refresh_pool()
        if not _pool:
            logger.info("No candidates after filter — nothing to do.")
            return

    # ---- 2. Slice this cycle's batch ---------------------------------------
    batch = _pool[_pool_offset: _pool_offset + cfg.batch_size]
    _pool_offset += cfg.batch_size
    logger.info("=== Cycle: markets %d–%d of %d ===",
                _pool_offset - len(batch) + 1, _pool_offset, len(_pool))

    # ---- 3–5. Live price + news + estimate + decision ----------------------
    for candidate in batch:
        m = candidate.market
        cid = m.condition_id

        # Skip if we already have an open position on this market
        if portfolio.get_position(cid):
            logger.debug("Skipping %s — already in portfolio.", cid[:20])
            continue

        # Live mid-price from CLOB (more accurate than Gamma's cached price)
        live_yes_price = fetch_mid_price(m.yes_token_id)
        if live_yes_price is None:
            logger.debug("Dead CLOB for %s — skip.", cid[:20])
            continue

        # News context
        context = recent_context(m.question)

        # LLM estimate
        try:
            est = estimator.estimate(
                question=m.question,
                end_date=m.end_date,
                context=context,
                description=m.description,
                model=cfg.estimator_model,
            )
        except Exception as exc:
            logger.warning("Estimator failed for '%s': %s", m.question[:60], exc)
            continue

        # Record estimate for calibration
        portfolio.record_estimate(
            condition_id=cid,
            question=m.question,
            p_true=est.p_true,
            confidence=est.confidence,
            rationale=est.rationale,
            market_price=live_yes_price,
            edge=est.p_true - live_yes_price,
        )

        # Decision engine
        signal = decision.evaluate(
            condition_id=cid,
            question=m.question,
            yes_token_id=m.yes_token_id,
            no_token_id=m.no_token_id,
            p_true_yes=est.p_true,
            confidence=est.confidence,
            live_yes_price=live_yes_price,
            min_edge=cfg.min_edge,
            min_confidence=cfg.min_confidence,
            kelly_fraction=cfg.kelly_fraction,
        )
        if signal is None:
            continue

        # ---- 6. Risk gates -------------------------------------------------
        try:
            book = fetch_orderbook(signal.token_id)
        except Exception as exc:
            logger.warning("Book fetch failed for signal %s: %s", cid[:20], exc)
            continue

        risk_result = risk.check(
            signal,
            bankroll=cfg.bankroll_usdc,
            open_exposure=portfolio.total_open_exposure(),
            has_position=portfolio.get_position(cid) is not None,
            book=book,
            max_position_frac=cfg.max_position_frac,
            max_total_exposure=cfg.max_total_exposure,
            min_stake=cfg.min_stake_usdc,
        )

        if risk_result.verdict == "REJECT":
            logger.info("RISK REJECT  %s  reason: %s", signal.side, risk_result.reason)
            continue

        # ---- 7. Execute (paper or live) ------------------------------------
        fill = broker.open_position(signal, stake_usdc=risk_result.stake_usdc)
        if fill is None:
            logger.warning("Broker returned no fill for %s.", cid[:20])
            continue

        portfolio.upsert_position(fill)
        portfolio.record_trade(fill, action="open")
        logger.info(
            "POSITION OPENED  %s  $%.2f  fill=%.4f  order=%s",
            signal.side, fill.stake_usdc, fill.fill_price, fill.order_id,
        )

    # ---- 8. Stop/exit check for open positions ----------------------------
    _check_stops(broker)


def _check_stops(broker: Broker) -> None:
    """Re-evaluate each open position for exit conditions."""
    positions = portfolio.get_all_positions()
    if not positions:
        return

    logger.info("Checking stops for %d open positions.", len(positions))

    for pos in positions:
        cid = pos["condition_id"]
        current_price = fetch_mid_price(pos["token_id"])
        if current_price is None:
            continue

        stop = risk.evaluate_stop(
            condition_id=cid,
            entry_price=pos["entry_price"],
            current_price=current_price,
            new_edge=None,  # simplified: re-estimation only on new cycles
            stop_edge=cfg.stop_edge,
        )

        if stop.should_exit:
            logger.info("STOP TRIGGERED  %s  reason: %s", cid[:20], stop.reason)
            from execution.broker import Fill
            open_fill = Fill(
                condition_id=cid,
                question=pos["question"],
                side=pos["side"],
                token_id=pos["token_id"],
                requested_price=pos["entry_price"],
                fill_price=pos["entry_price"],
                shares=pos["shares"],
                stake_usdc=pos["stake_usdc"],
                order_id=pos["order_id"],
            )
            close_fill = broker.close_position(open_fill)
            if close_fill:
                pnl = close_fill.stake_usdc - pos["stake_usdc"]
                portfolio.record_trade(close_fill, action="close", pnl=pnl)
                portfolio.delete_position(cid)
                logger.info(
                    "POSITION CLOSED  P&L=$%+.2f  order=%s",
                    pnl, close_fill.order_id,
                )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Polymarket Trading Bot")
    parser.add_argument("--live", action="store_true",
                        help="Enable live trading (default: paper)")
    parser.add_argument("--once", action="store_true",
                        help="Run one cycle and exit")
    parser.add_argument("--summary", action="store_true",
                        help="Print portfolio summary and exit")
    args = parser.parse_args()

    # Validate config
    cfg.validate()

    # Init DB
    portfolio.init_db()

    if args.summary:
        portfolio.print_summary()
        return

    # Init estimator
    estimator.init(cfg.anthropic_api_key)

    # Choose broker
    if args.live:
        if not cfg.pk:
            logger.error("Live mode requires PK in .env. Aborting.")
            sys.exit(1)
        from execution.live import LiveBroker
        broker: Broker = LiveBroker(
            pk=cfg.pk,
            funder=cfg.funder,
            taker_fee=cfg.taker_fee,
        )
        broker.setup()  # type: ignore[attr-defined]
        logger.warning("!!! LIVE TRADING ENABLED — real money at risk !!!")
    else:
        broker = PaperBroker(taker_fee=cfg.taker_fee)
        logger.info("Paper trading mode.")

    if args.once:
        run_cycle(broker)
        portfolio.print_summary()
        return

    # Main loop
    logger.info("Starting main loop (interval: %ds).", cfg.loop_interval_seconds)
    while True:
        try:
            run_cycle(broker)
            portfolio.print_summary()
        except KeyboardInterrupt:
            logger.info("Interrupted by user. Exiting.")
            break
        except Exception as exc:
            logger.exception("Unhandled exception in cycle: %s", exc)
            # Don't crash the loop on unexpected errors — log and wait
        time.sleep(cfg.loop_interval_seconds)


if __name__ == "__main__":
    main()
