"""Central config — load .env, expose typed settings.

All thresholds are tunable via environment variables so you can adjust without
touching code. Import cfg everywhere else; never import os.getenv directly.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv()


def _float(name: str, default: float) -> float:
    raw = os.getenv(name)
    return float(raw) if raw else default


def _int(name: str, default: int) -> int:
    raw = os.getenv(name)
    return int(raw) if raw else default


@dataclass(frozen=True)
class Config:
    # --- Anthropic ---
    anthropic_api_key: str = field(default_factory=lambda: os.getenv("ANTHROPIC_API_KEY", ""))

    # --- Polymarket wallet (live trading only) ---
    pk: str = field(default_factory=lambda: os.getenv("PK", ""))
    funder: str = field(default_factory=lambda: os.getenv("FUNDER", ""))

    # --- Capital ---
    bankroll_usdc: float = field(default_factory=lambda: _float("BANKROLL_USDC", 500.0))

    # --- Discovery filters ---
    min_liquidity: float = field(default_factory=lambda: _float("MIN_LIQUIDITY", 2000.0))
    min_volume: float = field(default_factory=lambda: _float("MIN_VOLUME", 10000.0))
    min_days_to_resolve: int = field(default_factory=lambda: _int("MIN_DAYS_TO_RESOLVE", 2))
    max_days_to_resolve: int = field(default_factory=lambda: _int("MAX_DAYS_TO_RESOLVE", 60))
    # Total pool of candidates fetched at once; rotated through in batches.
    pool_size: int = field(default_factory=lambda: _int("MAX_CANDIDATES", 100))
    # How many markets to evaluate per cycle (one Claude call each).
    batch_size: int = field(default_factory=lambda: _int("BATCH_SIZE", 10))

    # --- Edge thresholds ---
    min_edge: float = field(default_factory=lambda: _float("MIN_EDGE", 0.08))
    min_confidence: float = field(default_factory=lambda: _float("MIN_CONFIDENCE", 0.6))
    stop_edge: float = field(default_factory=lambda: _float("STOP_EDGE", 0.0))

    # --- Sizing ---
    kelly_fraction: float = field(default_factory=lambda: _float("KELLY_FRACTION", 0.25))
    max_position_frac: float = field(default_factory=lambda: _float("MAX_POSITION_FRAC", 0.05))
    max_total_exposure: float = field(default_factory=lambda: _float("MAX_TOTAL_EXPOSURE", 0.5))
    min_stake_usdc: float = field(default_factory=lambda: _float("MIN_STAKE_USDC", 5.0))

    # --- Fees (Polymarket is ~0 today, keep configurable) ---
    taker_fee: float = field(default_factory=lambda: _float("TAKER_FEE", 0.0))

    # --- API model ---
    estimator_model: str = field(
        default_factory=lambda: os.getenv("ESTIMATOR_MODEL", "claude-sonnet-4-6")
    )

    # --- Loop ---
    loop_interval_seconds: int = field(
        default_factory=lambda: _int("LOOP_INTERVAL_SECONDS", 900)  # 15 min default
    )

    def validate(self) -> None:
        if not self.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY is required. Set it in .env")
        if not (0 < self.kelly_fraction <= 1):
            raise ValueError("KELLY_FRACTION must be in (0, 1]")
        if not (0 < self.max_position_frac <= 1):
            raise ValueError("MAX_POSITION_FRAC must be in (0, 1]")
        if not (0 < self.max_total_exposure <= 1):
            raise ValueError("MAX_TOTAL_EXPOSURE must be in (0, 1]")


# Singleton used across the whole app
cfg = Config()
