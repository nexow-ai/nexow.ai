"""Discretionary (LLM-powered) trading agents that reason about market context."""

from __future__ import annotations

from typing import Any

import structlog

from nexow.agents.base import AgentStrategy, Signal, SignalType
from nexow.broker.models import Candle

logger = structlog.get_logger(__name__)


class DiscretionaryAgent(AgentStrategy):
    """
    Smart agent that uses an LLM to reason about market conditions,
    news sentiment, and technical context before making a decision.

    Powered by LangGraph reasoning chains.
    """

    def __init__(self, agent_id: str, config: dict[str, Any]) -> None:
        super().__init__(agent_id, config)
        self.personality: str = config.get("personality", "cautious")
        self.reasoning_depth: int = config.get("reasoning_depth", 2)

    async def evaluate(self, candles: list[Candle], current_price: float) -> Signal:
        """
        Use the LangGraph reasoning engine to analyze market context
        and produce a trading signal.
        """
        instrument = candles[0].instrument if candles else "UNKNOWN"

        try:
            from nexow.ai.reasoning import run_reasoning_chain

            market_context = self._build_market_context(candles, current_price)
            result = await run_reasoning_chain(
                agent_config=self.config,
                market_context=market_context,
                personality=self.personality,
            )

            signal_type = SignalType(result.get("action", "hold"))
            return Signal(
                type=signal_type,
                instrument=instrument,
                confidence=result.get("confidence", 0.5),
                stop_loss=result.get("stop_loss"),
                take_profit=result.get("take_profit"),
                reason=result.get("reasoning", "LLM decision"),
            )
        except Exception as e:
            logger.error("discretionary_agent_error", agent_id=self.agent_id, error=str(e))
            return Signal(
                type=SignalType.HOLD,
                instrument=instrument,
                reason=f"Error in reasoning: {e}",
            )

    def _build_market_context(self, candles: list[Candle], current_price: float) -> dict[str, Any]:
        """Build a market context dict for the LLM reasoning chain."""
        if not candles:
            return {"current_price": current_price}

        recent = candles[-20:] if len(candles) >= 20 else candles
        prices = [c.close for c in recent]
        high = max(c.high for c in recent)
        low = min(c.low for c in recent)

        return {
            "instrument": candles[0].instrument,
            "current_price": current_price,
            "recent_high": high,
            "recent_low": low,
            "price_change_pct": ((prices[-1] - prices[0]) / prices[0]) * 100 if prices[0] else 0,
            "avg_volume": sum(c.volume for c in recent) / len(recent),
            "num_candles": len(candles),
            "latest_candles": [
                {"time": str(c.time), "o": c.open, "h": c.high, "l": c.low, "c": c.close}
                for c in candles[-5:]
            ],
        }
