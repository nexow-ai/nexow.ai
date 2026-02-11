"""Pydantic models for broker data."""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel


class OrderSide(str, Enum):
    BUY = "buy"
    SELL = "sell"


class Candle(BaseModel):
    """OHLCV candle."""

    instrument: str
    time: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int


class OrderRequest(BaseModel):
    """Request to place an order on Oanda."""

    instrument: str
    units: int  # positive = buy, negative = sell
    type: str = "MARKET"
    time_in_force: str = "FOK"
    stop_loss_price: float | None = None
    take_profit_price: float | None = None


class OrderResponse(BaseModel):
    """Response after placing an order."""

    order_id: str
    trade_id: str | None = None
    instrument: str
    units: int
    price: float
    time: datetime


class AccountSummary(BaseModel):
    """Basic account info from Oanda."""

    account_id: str
    balance: float
    unrealized_pnl: float
    nav: float
    open_trade_count: int
    margin_used: float
    margin_available: float
