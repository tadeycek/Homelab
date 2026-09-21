"""Portfolio state — SQLite persistence for positions, trades, and estimates.

Three tables:
  positions  — currently open paper/live positions
  trades     — historical fills (opens and closes)
  estimates  — every LLM estimate + eventual outcome (for calibration)

The estimates table is the most important for improving the bot over time:
after enough markets resolve, run calibration analysis to see if p_true
matches actual resolution rates. If not, apply a correction factor to the
estimator prompts before going live.

All times are stored as ISO 8601 UTC strings.
"""
from __future__ import annotations

import logging
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Generator

from execution.broker import Fill

logger = logging.getLogger(__name__)

_DB_PATH = Path(__file__).parent.parent / "portfolio.db"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def _conn(db_path: Path = _DB_PATH) -> Generator[sqlite3.Connection, None, None]:
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    try:
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def init_db(db_path: Path = _DB_PATH) -> None:
    """Create tables if they don't exist. Safe to call multiple times."""
    with _conn(db_path) as con:
        con.executescript("""
            CREATE TABLE IF NOT EXISTS positions (
                condition_id    TEXT PRIMARY KEY,
                question        TEXT NOT NULL,
                side            TEXT NOT NULL,
                token_id        TEXT NOT NULL,
                entry_price     REAL NOT NULL,
                shares          REAL NOT NULL,
                stake_usdc      REAL NOT NULL,
                order_id        TEXT NOT NULL,
                opened_at       TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS trades (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                condition_id    TEXT NOT NULL,
                question        TEXT NOT NULL,
                side            TEXT NOT NULL,
                token_id        TEXT NOT NULL,
                fill_price      REAL NOT NULL,
                shares          REAL NOT NULL,
                stake_usdc      REAL NOT NULL,
                order_id        TEXT NOT NULL,
                action          TEXT NOT NULL,  -- 'open' or 'close'
                pnl_usdc        REAL,           -- NULL for opens; set on close
                created_at      TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS estimates (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                condition_id    TEXT NOT NULL,
                question        TEXT NOT NULL,
                p_true          REAL NOT NULL,
                confidence      REAL NOT NULL,
                rationale       TEXT,
                market_price    REAL,           -- live price at estimation time
                edge            REAL,
                outcome         INTEGER,        -- NULL=pending, 1=YES, 0=NO
                created_at      TEXT NOT NULL,
                resolved_at     TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_positions_cid ON positions(condition_id);
            CREATE INDEX IF NOT EXISTS idx_estimates_cid ON estimates(condition_id);
        """)
    logger.info("DB initialised at %s", db_path)


# ---------------------------------------------------------------------------
# Positions
# ---------------------------------------------------------------------------

def upsert_position(fill: Fill, db_path: Path = _DB_PATH) -> None:
    with _conn(db_path) as con:
        con.execute("""
            INSERT OR REPLACE INTO positions
              (condition_id, question, side, token_id, entry_price,
               shares, stake_usdc, order_id, opened_at)
            VALUES (?,?,?,?,?,?,?,?,?)
        """, (
            fill.condition_id, fill.question, fill.side, fill.token_id,
            fill.fill_price, fill.shares, fill.stake_usdc, fill.order_id, _now(),
        ))


def delete_position(condition_id: str, db_path: Path = _DB_PATH) -> None:
    with _conn(db_path) as con:
        con.execute("DELETE FROM positions WHERE condition_id = ?", (condition_id,))


def get_position(condition_id: str, db_path: Path = _DB_PATH) -> sqlite3.Row | None:
    with _conn(db_path) as con:
        return con.execute(
            "SELECT * FROM positions WHERE condition_id = ?", (condition_id,)
        ).fetchone()


def get_all_positions(db_path: Path = _DB_PATH) -> list[sqlite3.Row]:
    with _conn(db_path) as con:
        return con.execute("SELECT * FROM positions ORDER BY opened_at").fetchall()


def total_open_exposure(db_path: Path = _DB_PATH) -> float:
    with _conn(db_path) as con:
        row = con.execute("SELECT COALESCE(SUM(stake_usdc), 0) FROM positions").fetchone()
        return float(row[0])


# ---------------------------------------------------------------------------
# Trades
# ---------------------------------------------------------------------------

def record_trade(
    fill: Fill,
    action: str,
    pnl: float | None = None,
    db_path: Path = _DB_PATH,
) -> None:
    with _conn(db_path) as con:
        con.execute("""
            INSERT INTO trades
              (condition_id, question, side, token_id, fill_price, shares,
               stake_usdc, order_id, action, pnl_usdc, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """, (
            fill.condition_id, fill.question, fill.side, fill.token_id,
            fill.fill_price, fill.shares, fill.stake_usdc, fill.order_id,
            action, pnl, _now(),
        ))


def get_all_trades(db_path: Path = _DB_PATH) -> list[sqlite3.Row]:
    with _conn(db_path) as con:
        return con.execute("SELECT * FROM trades ORDER BY created_at DESC").fetchall()


def total_realised_pnl(db_path: Path = _DB_PATH) -> float:
    with _conn(db_path) as con:
        row = con.execute(
            "SELECT COALESCE(SUM(pnl_usdc), 0) FROM trades WHERE action = 'close'"
        ).fetchone()
        return float(row[0])


# ---------------------------------------------------------------------------
# Estimates
# ---------------------------------------------------------------------------

def record_estimate(
    *,
    condition_id: str,
    question: str,
    p_true: float,
    confidence: float,
    rationale: str,
    market_price: float,
    edge: float,
    db_path: Path = _DB_PATH,
) -> None:
    with _conn(db_path) as con:
        con.execute("""
            INSERT INTO estimates
              (condition_id, question, p_true, confidence, rationale,
               market_price, edge, created_at)
            VALUES (?,?,?,?,?,?,?,?)
        """, (condition_id, question, p_true, confidence, rationale,
              market_price, edge, _now()))


def update_estimate_outcome(
    condition_id: str,
    outcome: int,  # 1=YES, 0=NO
    db_path: Path = _DB_PATH,
) -> None:
    with _conn(db_path) as con:
        con.execute("""
            UPDATE estimates
               SET outcome = ?, resolved_at = ?
             WHERE condition_id = ? AND outcome IS NULL
        """, (outcome, _now(), condition_id))


def was_recently_estimated(
    condition_id: str,
    cooldown_seconds: int,
    db_path: Path = _DB_PATH,
) -> bool:
    """Return True if this market was estimated within the last cooldown_seconds."""
    with _conn(db_path) as con:
        row = con.execute(
            "SELECT created_at FROM estimates WHERE condition_id = ? ORDER BY created_at DESC LIMIT 1",
            (condition_id,),
        ).fetchone()
    if row is None:
        return False
    last = datetime.fromisoformat(row["created_at"])
    age = (datetime.now(timezone.utc) - last).total_seconds()
    return age < cooldown_seconds


def get_estimates_for_calibration(db_path: Path = _DB_PATH) -> list[sqlite3.Row]:
    """Return all estimates that have resolved outcomes — for calibration analysis."""
    with _conn(db_path) as con:
        return con.execute(
            "SELECT * FROM estimates WHERE outcome IS NOT NULL ORDER BY created_at"
        ).fetchall()


# ---------------------------------------------------------------------------
# Summary helpers
# ---------------------------------------------------------------------------

def print_summary(db_path: Path = _DB_PATH) -> None:
    positions = get_all_positions(db_path)
    pnl = total_realised_pnl(db_path)
    exposure = total_open_exposure(db_path)

    print(f"\n{'='*60}")
    print(f"  Open positions : {len(positions)}")
    print(f"  Open exposure  : ${exposure:.2f}")
    print(f"  Realised P&L   : ${pnl:+.2f}")
    print(f"{'='*60}")

    if positions:
        print("\n  Condition ID               Side      Shares   Stake   EntryPx")
        for p in positions:
            print(
                f"  {p['condition_id'][:26]:<28} {p['side']:<10}"
                f" {p['shares']:>6.2f}  ${p['stake_usdc']:>6.2f}  {p['entry_price']:.3f}"
            )
    print()
