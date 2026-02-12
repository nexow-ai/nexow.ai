"""Systematic trading agent — powered by the dynamic Rule DSL interpreter."""

from __future__ import annotations

from typing import Any

import structlog

from nexow.agents.base import AgentStrategy, Signal, SignalType
from nexow.broker.models import Candle
from nexow.rules.interpreter import MarketSnapshot, evaluate_rules

logger = structlog.get_logger(__name__)


class SystematicAgent(AgentStrategy):
    """
    Dynamic rule-based agent.

    The AI generates a JSON rule tree (buy_rules, sell_rules, close_rules).
    This agent feeds live market data into the rule interpreter
    and returns the resulting signal.

    IMPORTANT: The agent tracks the last candle time so that rules like
    "every_candle" or "always" only fire ONCE per new candle, not on
    every engine tick.
    """

    # Class-level cache: {agent_id: last_candle_time}
    _last_candle_times: dict[str, float] = {}

    def __init__(self, agent_id: str, config: dict[str, Any]) -> None:
        super().__init__(agent_id, config)
        self.rules = config.get("rules", {})

    async def evaluate(self, candles: list[Candle], current_price: float) -> Signal:
        instrument = candles[0].instrument if candles else "UNKNOWN"

        if not self.rules:
            return Signal(
                type=SignalType.HOLD,
                instrument=instrument,
                reason="No rules configured",
            )

        if len(candles) < 2:
            return Signal(
                type=SignalType.HOLD,
                instrument=instrument,
                reason="Not enough candle data",
            )

        # Only evaluate on NEW candles — skip if we already evaluated this candle
        latest_candle_time = candles[-1].time.timestamp() if hasattr(candles[-1].time, 'timestamp') else float(candles[-1].time.strftime('%s') if hasattr(candles[-1].time, 'strftime') else 0)
        
        # Use the second-to-last complete candle time as reference
        # (last candle might still be forming)
        ref_time = candles[-2].time.timestamp() if hasattr(candles[-2].time, 'timestamp') else 0
        
        prev_time = self._last_candle_times.get(self.agent_id, 0)
        
        if ref_time <= prev_time:
            # Same candle as last evaluation — skip
            return Signal(
                type=SignalType.HOLD,
                instrument=instrument,
                reason="Waiting for new candle",
            )
        
        # New candle! Update tracker and evaluate rules
        self._last_candle_times[self.agent_id] = ref_time

        # Build market snapshot
        snap = MarketSnapshot(candles, current_price)

        # Evaluate rules
        action = evaluate_rules(self.rules, snap)

        signal_map = {
            "buy": SignalType.BUY,
            "sell": SignalType.SELL,
            "close": SignalType.CLOSE,
            "hold": SignalType.HOLD,
        }

        signal_type = signal_map.get(action, SignalType.HOLD)
        reason = self._build_reason(action)

        # Attach exit levels from agent config (percentage-based SL/TP)
        exit_config = self.config.get("exit", {})
        sl_pct = exit_config.get("stop_loss_pct")
        tp_pct = exit_config.get("take_profit_pct")

        return Signal(
            type=signal_type,
            instrument=instrument,
            confidence=0.8 if signal_type != SignalType.HOLD else 0.0,
            stop_loss_pct=sl_pct if signal_type in (SignalType.BUY, SignalType.SELL) else None,
            take_profit_pct=tp_pct if signal_type in (SignalType.BUY, SignalType.SELL) else None,
            reason=reason,
        )

    def _build_reason(self, action: str) -> str:
        """Generate a human-readable reason based on which rules triggered."""
        if action == "hold":
            return "No rules triggered"

        rule_key = f"{action}_rules"
        rules = self.rules.get(rule_key, {})

        if not rules:
            return f"Rule matched: {action}"

        conditions = rules.get("conditions", [])
        operator = rules.get("operator", "and")

        if operator == "always":
            return f"Always {action} (every new candle)"

        parts = []
        for c in conditions[:3]:
            ctype = c.get("type", "?")
            params = c.get("params", {})
            param_str = ", ".join(f"{k}={v}" for k, v in params.items()) if params else ""
            parts.append(f"{ctype}({param_str})" if param_str else ctype)

        joiner = " AND " if operator == "and" else " OR "
        return f"Rule: {joiner.join(parts)}"
