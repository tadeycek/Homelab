"""Main loop — ties data, strategy, risk, and engine together."""

from __future__ import annotations

import logging
import sys
import time

import ccxt

import config
import data
import engine as eng
import risk
import strategy as strat

# --------------------------------------------------------------------------- #
#  Logging setup                                                               #
# --------------------------------------------------------------------------- #

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("trading_bot.log"),
    ],
)
log = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
#  Display helpers                                                             #
# --------------------------------------------------------------------------- #

def _fmt(value: float, decimals: int = 2, prefix: str = "") -> str:
    sign = "+" if value > 0 else ""
    return f"{prefix}{sign}{value:.{decimals}f}"


def _print_status(trader: eng.PaperTrader, price: float, result: strat.StrategyResult) -> None:
    equity = trader.equity(price)
    upnl = trader.unrealised_pnl(price)
    pos_info = "FLAT"
    if trader.in_position and trader.position is not None:
        p = trader.position
        pos_info = (
            f"LONG  entry={p.entry_price:.2f}  qty={p.quantity:.6f} BTC"
            f"  SL={p.stop_loss:.2f}  TP={p.take_profit:.2f}"
            f"  uPnL={_fmt(upnl, 2, '$')}"
        )

    log.info(
        "price=%-12.2f  fast_ema=%-10.2f  slow_ema=%-10.2f  signal=%-5s  "
        "balance=$%-8.2f  equity=$%-8.2f  pos=%s",
        price,
        result.fast_ema,
        result.slow_ema,
        result.signal.name,
        trader.balance,
        equity,
        pos_info,
    )


def _print_trade(label: str, trade: eng.ClosedTrade) -> None:
    log.info(
        "  %-12s id=%s  entry=%.2f  exit=%.2f  pnl=%s (%.2f%%)  reason=%s",
        label,
        trade.id,
        trade.entry_price,
        trade.exit_price,
        _fmt(trade.pnl, 2, "$"),
        trade.pnl_pct * 100,
        trade.reason,
    )


def _print_summary(trader: eng.PaperTrader) -> None:
    log.info("=" * 72)
    log.info("SUMMARY  trades=%d  wins=%d  win_rate=%.1f%%  total_pnl=%s  balance=$%.2f",
             len(trader.closed_trades),
             sum(1 for t in trader.closed_trades if t.pnl > 0),
             trader.win_rate() * 100,
             _fmt(trader.total_pnl(), 2, "$"),
             trader.balance)
    log.info("=" * 72)


# --------------------------------------------------------------------------- #
#  Single tick                                                                 #
# --------------------------------------------------------------------------- #

def tick(trader: eng.PaperTrader) -> None:
    """Fetch candles, evaluate strategy, manage exits and entries."""

    # 1. Fetch data
    try:
        df = data.fetch_candles()
    except ccxt.NetworkError as exc:
        log.warning("Network error, skipping tick: %s", exc)
        return
    except ccxt.BaseError as exc:
        log.error("Exchange error: %s", exc)
        return

    # 2. Evaluate strategy
    try:
        result = strat.analyse(df)
    except ValueError as exc:
        log.warning("Strategy error: %s", exc)
        return

    current_price = result.close

    # 3. Advance candle counter for open position, then check SL/TP
    trader.tick_position()
    closed = trader.check_exits(current_price)
    if closed is not None:
        _print_trade("CLOSED", closed)

    # 4. Act on crossover signal
    if result.signal == strat.Signal.BUY and not trader.in_position:
        if risk.can_trade(trader.balance):
            amount = risk.position_size(trader.balance)
            position = trader.open_position(current_price, amount)
            log.info(
                "  OPENED       id=%s  price=%.2f  qty=%.6f BTC  cost=$%.2f"
                "  SL=%.2f  TP=%.2f",
                position.id,
                position.entry_price,
                position.quantity,
                position.cost,
                position.stop_loss,
                position.take_profit,
            )
        else:
            log.warning("  BUY signal but balance too low to trade ($%.2f)", trader.balance)

    elif result.signal == strat.Signal.SELL and trader.in_position:
        if trader.candles_in_trade >= config.MIN_CANDLES_IN_TRADE:
            closed = trader.close_position(current_price, reason="signal")
            _print_trade("CLOSED", closed)
        else:
            log.info("  SELL signal ignored — only %d/%d candles in trade",
                     trader.candles_in_trade, config.MIN_CANDLES_IN_TRADE)

    # 5. Status line
    _print_status(trader, current_price, result)


# --------------------------------------------------------------------------- #
#  Entry point                                                                 #
# --------------------------------------------------------------------------- #

def main() -> None:
    log.info("=" * 72)
    log.info("Paper Trading Bot  |  %s  |  %s  |  balance=$%.2f",
             config.SYMBOL, config.TIMEFRAME, config.STARTING_BALANCE)
    log.info("EMA %d/%d  |  SL=%.1f%%  TP=%.1f%%  |  max_risk=%.0f%%  |  min_hold=%d candles",
             config.FAST_EMA, config.SLOW_EMA,
             config.STOP_LOSS_PCT * 100, config.TAKE_PROFIT_PCT * 100,
             config.MAX_RISK_PCT * 100, config.MIN_CANDLES_IN_TRADE)
    log.info("=" * 72)

    trader = eng.PaperTrader()

    try:
        while True:
            tick(trader)
            time.sleep(config.LOOP_INTERVAL)
    except KeyboardInterrupt:
        log.info("Interrupted by user.")
    finally:
        _print_summary(trader)


if __name__ == "__main__":
    main()
