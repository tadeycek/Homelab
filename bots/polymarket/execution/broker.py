"""Abstract Broker interface.

Both PaperBroker and LiveBroker implement this interface, so the rest of the
pipeline never needs to know which mode it's in. Swap by changing one line in
main.py.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Literal

from engine.decision import TradeSignal


Side = Literal["BUY_YES", "BUY_NO"]


@dataclass
class Fill:
    condition_id: str
    question: str
    side: Side
    token_id: str
    requested_price: float   # limit price we wanted
    fill_price: float        # actual simulated/real fill price
    shares: float            # number of outcome shares acquired
    stake_usdc: float        # USDC spent
    order_id: str            # paper: synthetic ID; live: CLOB order ID


class Broker(ABC):
    @abstractmethod
    def open_position(self, signal: TradeSignal, stake_usdc: float) -> Fill | None:
        """Attempt to fill an opening order. Returns Fill or None if rejected."""
        ...

    @abstractmethod
    def close_position(self, fill: Fill) -> Fill | None:
        """Attempt to sell back an open position at current market price."""
        ...
