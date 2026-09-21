"""CLOB API wrapper — live order book reads (public) and order placement (auth).

Two usage modes:
  1. Read-only (paper trading): no credentials needed. Use fetch_mid_price()
     and fetch_orderbook() freely.
  2. Live trading: initialise with PK + funder, call setup_creds() once to
     derive L2 credentials, then place_order() works.

Docs: https://docs.polymarket.com/developers/CLOB/clients
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

CLOB_BASE = "https://clob.polymarket.com"


# ---------------------------------------------------------------------------
# Public read helpers (no auth)
# ---------------------------------------------------------------------------

@dataclass
class OrderLevel:
    price: float
    size: float


@dataclass
class OrderBook:
    token_id: str
    bids: list[OrderLevel]   # sorted descending by price
    asks: list[OrderLevel]   # sorted ascending by price

    @property
    def best_bid(self) -> float | None:
        return self.bids[0].price if self.bids else None

    @property
    def best_ask(self) -> float | None:
        return self.asks[0].price if self.asks else None

    @property
    def mid(self) -> float | None:
        if self.best_bid is None or self.best_ask is None:
            return None
        return (self.best_bid + self.best_ask) / 2

    def vwap_to_fill(self, size_usdc: float) -> float | None:
        """Estimated average fill price (USDC per share) for buying `size_usdc`.

        Walks the ask side of the book. Returns None if book is too thin.
        VWAP = total_usdc_spent / total_shares_acquired = size_usdc / total_shares.
        """
        remaining_usdc = size_usdc
        total_shares = 0.0
        for level in self.asks:
            # How many shares are available at this ask level?
            shares_available = level.size
            usdc_needed = level.price * shares_available
            if usdc_needed >= remaining_usdc:
                # This level fills the rest
                total_shares += remaining_usdc / level.price
                remaining_usdc = 0.0
                break
            else:
                total_shares += shares_available
                remaining_usdc -= usdc_needed
        if remaining_usdc > 0 or total_shares == 0:
            return None  # book too thin
        return size_usdc / total_shares  # average price per share


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
def fetch_orderbook(token_id: str) -> OrderBook:
    """Fetch the live order book for a single CLOB token (public endpoint)."""
    with httpx.Client(timeout=15) as c:
        r = c.get(f"{CLOB_BASE}/book", params={"token_id": token_id})
        r.raise_for_status()
        data = r.json()

    bids = sorted(
        [OrderLevel(float(b["price"]), float(b["size"])) for b in data.get("bids", [])],
        key=lambda x: -x.price,
    )
    asks = sorted(
        [OrderLevel(float(a["price"]), float(a["size"])) for a in data.get("asks", [])],
        key=lambda x: x.price,
    )
    return OrderBook(token_id=token_id, bids=bids, asks=asks)


def fetch_mid_price(token_id: str) -> float | None:
    """Convenience: return mid-price for a token, or None if market is dead."""
    try:
        book = fetch_orderbook(token_id)
        return book.mid
    except Exception as exc:
        logger.warning("fetch_mid_price failed for %s: %s", token_id, exc)
        return None


# ---------------------------------------------------------------------------
# Authenticated live client (Phase 7)
# ---------------------------------------------------------------------------

class LiveClobClient:
    """Thin wrapper around py-clob-client for authenticated order placement.

    Usage:
        client = LiveClobClient(pk=cfg.pk, funder=cfg.funder, signature_type=1)
        client.setup_creds()         # derive L2 API creds (call once per session)
        resp = client.place_order(token_id, price=0.40, size=10, side="BUY")
    """

    def __init__(
        self,
        pk: str,
        funder: str = "",
        signature_type: int = 0,   # 0=EOA, 1=email/Magic, 2=browser-proxy
        chain_id: int = 137,       # Polygon
    ) -> None:
        self._pk = pk
        self._funder = funder
        self._sig_type = signature_type
        self._chain_id = chain_id
        self._client = None   # initialised in setup_creds()

    def setup_creds(self) -> None:
        """Import py-clob-client, connect, derive L2 credentials.

        Called once at startup. Requires PK and optionally FUNDER to be set.
        Raises ImportError if py-clob-client is not installed.
        """
        try:
            from py_clob_client.client import ClobClient  # type: ignore
        except ImportError as exc:
            raise ImportError(
                "py-clob-client is required for live trading. "
                "Install it: pip install py-clob-client"
            ) from exc

        kwargs: dict = dict(
            host=CLOB_BASE,
            key=self._pk,
            chain_id=self._chain_id,
            signature_type=self._sig_type,
        )
        if self._funder:
            kwargs["funder"] = self._funder

        # L1 client → derive L2 creds
        bootstrap = ClobClient(**kwargs)
        creds = bootstrap.create_or_derive_api_creds()
        kwargs["creds"] = creds
        self._client = ClobClient(**kwargs)
        logger.info("LiveClobClient: L2 credentials derived and set.")

    def place_order(
        self,
        token_id: str,
        price: float,
        size: float,
        side: Literal["BUY", "SELL"],
    ) -> dict:
        """Create and post a GTC limit order.

        Args:
            token_id: YES or NO token ID from CLOB.
            price:    Limit price (0–1, two decimal places for 0.01 tick markets).
            size:     Number of outcome shares (1 share pays $1 on resolution).
            side:     "BUY" or "SELL".

        Returns:
            Raw response dict from the CLOB API.

        Raises:
            RuntimeError: if setup_creds() was not called first.
        """
        if self._client is None:
            raise RuntimeError("Call setup_creds() before placing orders.")

        from py_clob_client.clob_types import OrderArgs, OrderType  # type: ignore
        from py_clob_client.order_builder.constants import BUY, SELL  # type: ignore

        clob_side = BUY if side == "BUY" else SELL
        order_args = OrderArgs(token_id=token_id, price=price, size=size, side=clob_side)
        order = self._client.create_order(order_args)
        resp = self._client.post_order(order, OrderType.GTC)
        logger.info("Order placed: %s %.4f x %.2f → %s", side, price, size, resp)
        return resp

    def cancel_order(self, order_id: str) -> dict:
        if self._client is None:
            raise RuntimeError("Call setup_creds() before cancelling orders.")
        resp = self._client.cancel({"orderID": order_id})
        logger.info("Order cancelled: %s → %s", order_id, resp)
        return resp

    def get_positions(self) -> list[dict]:
        if self._client is None:
            raise RuntimeError("Call setup_creds() before fetching positions.")
        return self._client.get_positions() or []
