"""Gamma Markets API client — public REST, no auth required.

Fetches and parses binary Yes/No prediction markets from Polymarket.
Fields like outcomes/outcomePrices/clobTokenIds come back as JSON-encoded
strings (Polymarket quirk), so we parse them here and return clean dataclasses.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterator

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

GAMMA_BASE = "https://gamma-api.polymarket.com"
_PAGE_SIZE = 500


@dataclass
class Market:
    condition_id: str
    question: str
    # YES token is index 0, NO token is index 1 (Polymarket convention)
    token_ids: list[str]    # [yes_token_id, no_token_id]
    outcomes: list[str]     # ["Yes", "No"]
    prices: list[float]     # [yes_price, no_price]  — implied probabilities
    volume: float           # total traded volume in USDC
    liquidity: float        # current liquidity in USDC
    end_date: str           # ISO 8601 string
    market_slug: str = ""
    description: str = ""

    @property
    def yes_price(self) -> float:
        return self.prices[0]

    @property
    def no_price(self) -> float:
        return self.prices[1]

    @property
    def yes_token_id(self) -> str:
        return self.token_ids[0]

    @property
    def no_token_id(self) -> str:
        return self.token_ids[1]

    @property
    def days_to_resolve(self) -> float:
        """Calendar days until end_date. Returns inf if end_date is unparseable."""
        if not self.end_date:
            return float("inf")
        try:
            end = datetime.fromisoformat(self.end_date.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            return max(0.0, (end - now).total_seconds() / 86400)
        except ValueError:
            return float("inf")


def _parse_market(raw: dict) -> Market | None:
    """Parse one raw Gamma API market object into a Market dataclass.

    Returns None if the market is not a clean binary Yes/No market or if
    required fields are missing/malformed.
    """
    try:
        token_ids: list[str] = json.loads(raw["clobTokenIds"])
        outcomes: list[str] = json.loads(raw["outcomes"])
        prices_raw: list[str] = json.loads(raw["outcomePrices"])

        if len(token_ids) != 2 or len(outcomes) != 2 or len(prices_raw) != 2:
            return None  # not a binary market

        prices = [float(p) for p in prices_raw]

        # Sanity-check: prices should be probabilities (roughly sum to 1)
        if not (0.8 < sum(prices) < 1.2):
            return None

        return Market(
            condition_id=raw["conditionId"],
            question=raw.get("question", "").strip(),
            token_ids=token_ids,
            outcomes=outcomes,
            prices=prices,
            volume=float(raw.get("volume") or 0),
            liquidity=float(raw.get("liquidity") or 0),
            end_date=raw.get("endDate", ""),
            market_slug=raw.get("slug", ""),
            description=raw.get("description", ""),
        )
    except (KeyError, ValueError, TypeError, json.JSONDecodeError):
        return None


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
def _fetch_page(client: httpx.Client, offset: int) -> list[dict]:
    r = client.get(
        f"{GAMMA_BASE}/markets",
        params={
            "active": "true",
            "closed": "false",
            "limit": _PAGE_SIZE,
            "offset": offset,
            "order": "volume",     # highest volume first — most liquid markets
            "ascending": "false",
        },
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def _iter_raw_markets() -> Iterator[dict]:
    """Paginate through all active markets on Gamma."""
    with httpx.Client() as c:
        offset = 0
        while True:
            batch = _fetch_page(c, offset)
            if not batch:
                break
            yield from batch
            offset += _PAGE_SIZE
            if len(batch) < _PAGE_SIZE:
                break


def fetch_markets(max_markets: int = 5000) -> list[Market]:
    """Fetch and parse all active binary markets, ordered by volume descending.

    Args:
        max_markets: Hard cap — stop after this many raw markets are fetched
                     (before filtering). Keeps run time predictable.

    Returns:
        List of parsed Market objects. Malformed/non-binary markets are dropped.
    """
    markets: list[Market] = []
    fetched = 0

    for raw in _iter_raw_markets():
        fetched += 1
        if fetched > max_markets:
            break
        m = _parse_market(raw)
        if m is not None and m.question:
            markets.append(m)

    logger.info("Gamma: fetched %d raw → %d binary markets", fetched, len(markets))
    return markets


if __name__ == "__main__":
    # Quick smoke-test: python -m data.gamma
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    mkt = fetch_markets(max_markets=500)
    print(f"\nParsed {len(mkt)} binary markets\n")
    for m in mkt[:10]:
        price_check = f"YES={m.yes_price:.2f}  NO={m.no_price:.2f}  sum={sum(m.prices):.2f}"
        print(f"  [{m.days_to_resolve:5.1f}d]  liq=${m.liquidity:>8,.0f}  {price_check}  {m.question[:80]}")
