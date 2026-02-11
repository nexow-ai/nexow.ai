"""Systematic (rule-based) trading agents — RSI, MACD, EMA crossover, etc."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
import structlog
import ta

from nexow.agents.base import AgentStrategy, Signal, SignalType
from nexow.broker.models import Candle

logger = structlog.get_logger(__name__)


def _candles_to_df(candles: list[Candle]) -> pd.DataFrame:
    """Convert a list of Candle objects to a pandas DataFrame."""
    df = pd.DataFrame([c.model_dump() for c in candles])
    df.set_index("time", inplace=True)
    df.sort_index(inplace=True)
    return df


class SystematicAgent(AgentStrategy):
    """
    Rule-based agent that evaluates technical indicators.

    Supported strategies (selected via config["strategy"]):
        - rsi_reversal
        - macd_crossover
        - ema_crossover
        - bollinger_breakout
    """

    def __init__(self, agent_id: str, config: dict[str, Any]) -> None:
        super().__init__(agent_id, config)
        self.strategy_name: str = config.get("strategy", "rsi_reversal")

    async def evaluate(self, candles: list[Candle], current_price: float) -> Signal:
        if len(candles) < 30:
            return Signal(type=SignalType.HOLD, instrument=candles[0].instrument, reason="not enough data")

        df = _candles_to_df(candles)
        instrument = candles[0].instrument

        strategy_map = {
            "rsi_reversal": self._rsi_reversal,
            "macd_crossover": self._macd_crossover,
            "ema_crossover": self._ema_crossover,
            "bollinger_breakout": self._bollinger_breakout,
        }

        handler = strategy_map.get(self.strategy_name, self._rsi_reversal)
        return handler(df, instrument, current_price)

    # ------------------------------------------------------------------
    # Strategy implementations
    # ------------------------------------------------------------------

    def _rsi_reversal(self, df: pd.DataFrame, instrument: str, price: float) -> Signal:
        """Buy when RSI < oversold, sell when RSI > overbought."""
        period = self.get_param("rsi_period", 14)
        oversold = self.get_param("rsi_oversold", 30)
        overbought = self.get_param("rsi_overbought", 70)

        rsi = ta.momentum.RSIIndicator(df["close"], window=period).rsi()
        latest_rsi = rsi.iloc[-1]

        if np.isnan(latest_rsi):
            return Signal(type=SignalType.HOLD, instrument=instrument, reason="RSI not ready")

        if latest_rsi < oversold:
            return Signal(
                type=SignalType.BUY, instrument=instrument,
                confidence=min((oversold - latest_rsi) / oversold, 1.0),
                reason=f"RSI={latest_rsi:.1f} < {oversold}",
            )
        elif latest_rsi > overbought:
            return Signal(
                type=SignalType.SELL, instrument=instrument,
                confidence=min((latest_rsi - overbought) / (100 - overbought), 1.0),
                reason=f"RSI={latest_rsi:.1f} > {overbought}",
            )
        return Signal(type=SignalType.HOLD, instrument=instrument, reason=f"RSI={latest_rsi:.1f}")

    def _macd_crossover(self, df: pd.DataFrame, instrument: str, price: float) -> Signal:
        """Buy on bullish MACD crossover, sell on bearish."""
        fast = self.get_param("macd_fast", 12)
        slow = self.get_param("macd_slow", 26)
        signal_period = self.get_param("macd_signal", 9)

        macd_ind = ta.trend.MACD(df["close"], window_fast=fast, window_slow=slow, window_sign=signal_period)
        macd_line = macd_ind.macd()
        signal_line = macd_ind.macd_signal()

        if len(macd_line) < 2:
            return Signal(type=SignalType.HOLD, instrument=instrument, reason="MACD not ready")

        prev_diff = macd_line.iloc[-2] - signal_line.iloc[-2]
        curr_diff = macd_line.iloc[-1] - signal_line.iloc[-1]

        if prev_diff <= 0 and curr_diff > 0:
            return Signal(type=SignalType.BUY, instrument=instrument, reason="MACD bullish crossover")
        elif prev_diff >= 0 and curr_diff < 0:
            return Signal(type=SignalType.SELL, instrument=instrument, reason="MACD bearish crossover")
        return Signal(type=SignalType.HOLD, instrument=instrument, reason="MACD no crossover")

    def _ema_crossover(self, df: pd.DataFrame, instrument: str, price: float) -> Signal:
        """Buy when fast EMA crosses above slow EMA, sell on reverse."""
        fast_period = self.get_param("ema_fast", 9)
        slow_period = self.get_param("ema_slow", 21)

        ema_fast = df["close"].ewm(span=fast_period).mean()
        ema_slow = df["close"].ewm(span=slow_period).mean()

        prev_diff = ema_fast.iloc[-2] - ema_slow.iloc[-2]
        curr_diff = ema_fast.iloc[-1] - ema_slow.iloc[-1]

        if prev_diff <= 0 and curr_diff > 0:
            return Signal(type=SignalType.BUY, instrument=instrument, reason="EMA bullish crossover")
        elif prev_diff >= 0 and curr_diff < 0:
            return Signal(type=SignalType.SELL, instrument=instrument, reason="EMA bearish crossover")
        return Signal(type=SignalType.HOLD, instrument=instrument, reason="EMA no crossover")

    def _bollinger_breakout(self, df: pd.DataFrame, instrument: str, price: float) -> Signal:
        """Buy when price breaks below lower band, sell above upper band."""
        period = self.get_param("bb_period", 20)
        std_dev = self.get_param("bb_std", 2.0)

        bb = ta.volatility.BollingerBands(df["close"], window=period, window_dev=std_dev)
        upper = bb.bollinger_hband().iloc[-1]
        lower = bb.bollinger_lband().iloc[-1]

        if price < lower:
            return Signal(type=SignalType.BUY, instrument=instrument, reason=f"Price below BB lower ({lower:.5f})")
        elif price > upper:
            return Signal(type=SignalType.SELL, instrument=instrument, reason=f"Price above BB upper ({upper:.5f})")
        return Signal(type=SignalType.HOLD, instrument=instrument, reason="Within Bollinger Bands")
