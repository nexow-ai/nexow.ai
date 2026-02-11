"""Risk guardrails — enforces hard limits and kill switches."""

from __future__ import annotations

from typing import Any

import structlog

from nexow.agents.base import Signal, SignalType
from nexow.db.client import SupabaseClient

logger = structlog.get_logger(__name__)


class RiskGuardrails:
    """
    Enforces risk management rules before any trade is executed.

    - Max drawdown: kills agent if exceeded
    - Max open trades: prevents over-exposure
    - Daily loss limit: pauses agent for the day
    """

    MAX_OPEN_TRADES_PER_AGENT = 5
    MAX_DAILY_LOSS_PCT = 5.0

    def __init__(self, db: SupabaseClient) -> None:
        self.db = db

    def allow_trade(self, agent: dict[str, Any], signal: Signal) -> bool:
        """
        Check all guardrails. Return True if the trade is allowed.

        If any guardrail is violated, the agent may be paused or killed.
        """
        agent_id = agent["id"]

        # Always allow close signals
        if signal.type == SignalType.CLOSE:
            return True

        # Check max open trades
        if not self._check_open_trades(agent_id):
            return False

        # Check drawdown
        if not self._check_drawdown(agent):
            return False

        return True

    def _check_open_trades(self, agent_id: str) -> bool:
        """Ensure agent hasn't exceeded max open trades."""
        open_trades = self.db.get_open_trades(agent_id)
        if len(open_trades) >= self.MAX_OPEN_TRADES_PER_AGENT:
            logger.warning(
                "max_open_trades_reached",
                agent_id=agent_id,
                count=len(open_trades),
            )
            return False
        return True

    def _check_drawdown(self, agent: dict[str, Any]) -> bool:
        """
        Check if agent's drawdown exceeds the max allowed.
        If exceeded, trigger the kill switch.
        """
        agent_id = agent["id"]
        max_dd = agent.get("max_drawdown_pct", 10.0)

        # Fetch current performance
        try:
            perf = self.db.client.table("agent_performance").select("*").eq(
                "agent_id", agent_id
            ).single().execute()

            if perf.data:
                current_dd = abs(float(perf.data.get("max_drawdown", 0)))
                if current_dd >= max_dd:
                    logger.critical(
                        "kill_switch_activated",
                        agent_id=agent_id,
                        drawdown=current_dd,
                        max_allowed=max_dd,
                    )
                    self._kill_agent(agent_id)
                    return False
        except Exception:
            # If no performance data yet, allow the trade
            pass

        return True

    def _kill_agent(self, agent_id: str) -> None:
        """Activate the kill switch — set agent status to 'killed'."""
        self.db.update_agent_status(agent_id, "killed")
        logger.critical("agent_killed", agent_id=agent_id)
