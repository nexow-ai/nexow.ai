"""Oanda v20 REST API client — market data provider."""

from __future__ import annotations

from datetime import datetime

import httpx
import structlog

from nexow.broker.models import Candle
from nexow.config import settings

logger = structlog.get_logger(__name__)


class OandaClient:
    """
    Async HTTP client for the Oanda v20 REST API.

    Used exclusively as a **market data provider** (candles + live prices).
    Agents do not place orders — they are pure signal providers.
    """

    def __init__(self) -> None:
        self._base_url = settings.oanda_api_url
        self._account_id = settings.oanda_account_id
        self._headers = {
            "Authorization": f"Bearer {settings.oanda_api_token}",
            "Content-Type": "application/json",
        }
        self._http = httpx.AsyncClient(
            base_url=self._base_url,
            headers=self._headers,
            timeout=10.0,
        )

    @property
    def account_url(self) -> str:
        return f"/v3/accounts/{self._account_id}"

    # ------------------------------------------------------------------
    # Market Data
    # ------------------------------------------------------------------

    async def get_candles(
        self,
        instrument: str,
        granularity: str = "M5",
        count: int = 100,
    ) -> list[Candle]:
        """Fetch recent candles for an instrument."""
        url = f"{self.account_url}/instruments/{instrument}/candles"
        params = {
            "granularity": granularity,
            "count": count,
            "price": "M",  # midpoint
        }
        resp = await self._http.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

        candles: list[Candle] = []
        for c in data.get("candles", []):
            if not c.get("complete", False):
                continue
            mid = c["mid"]
            candles.append(
                Candle(
                    instrument=instrument,
                    time=datetime.fromisoformat(c["time"].replace("Z", "+00:00")),
                    open=float(mid["o"]),
                    high=float(mid["h"]),
                    low=float(mid["l"]),
                    close=float(mid["c"]),
                    volume=int(c["volume"]),
                )
            )
        return candles

    async def get_price(self, instrument: str) -> float:
        """Get the current midpoint price for an instrument."""
        url = f"{self.account_url}/pricing"
        params = {"instruments": instrument}
        resp = await self._http.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
        price_data = data["prices"][0]
        bid = float(price_data["bids"][0]["price"])
        ask = float(price_data["asks"][0]["price"])
        return (bid + ask) / 2

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._http.aclose()
