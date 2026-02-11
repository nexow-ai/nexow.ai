"""Oanda v20 REST API client."""

from __future__ import annotations

from datetime import datetime, timezone

import httpx
import structlog

from nexow.broker.models import AccountSummary, Candle, OrderRequest, OrderResponse
from nexow.config import settings

logger = structlog.get_logger(__name__)


class OandaClient:
    """Async HTTP client for the Oanda v20 REST API."""

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
    # Orders
    # ------------------------------------------------------------------

    async def place_order(self, order: OrderRequest) -> OrderResponse:
        """Place a market order on Oanda."""
        url = f"{self.account_url}/orders"
        body: dict = {
            "order": {
                "type": order.type,
                "instrument": order.instrument,
                "units": str(order.units),
                "timeInForce": order.time_in_force,
            }
        }
        if order.stop_loss_price is not None:
            body["order"]["stopLossOnFill"] = {"price": f"{order.stop_loss_price:.5f}"}
        if order.take_profit_price is not None:
            body["order"]["takeProfitOnFill"] = {"price": f"{order.take_profit_price:.5f}"}

        logger.info("placing_order", instrument=order.instrument, units=order.units)
        resp = await self._http.post(url, json=body)
        resp.raise_for_status()
        data = resp.json()

        fill = data.get("orderFillTransaction", {})
        return OrderResponse(
            order_id=fill.get("orderID", ""),
            trade_id=fill.get("tradeOpened", {}).get("tradeID"),
            instrument=order.instrument,
            units=order.units,
            price=float(fill.get("price", 0)),
            time=datetime.now(timezone.utc),
        )

    # ------------------------------------------------------------------
    # Account
    # ------------------------------------------------------------------

    async def get_account_summary(self) -> AccountSummary:
        """Fetch account summary."""
        url = f"{self.account_url}/summary"
        resp = await self._http.get(url)
        resp.raise_for_status()
        data = resp.json()["account"]
        return AccountSummary(
            account_id=data["id"],
            balance=float(data["balance"]),
            unrealized_pnl=float(data["unrealizedPL"]),
            nav=float(data["NAV"]),
            open_trade_count=int(data["openTradeCount"]),
            margin_used=float(data["marginUsed"]),
            margin_available=float(data["marginAvailable"]),
        )

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._http.aclose()
