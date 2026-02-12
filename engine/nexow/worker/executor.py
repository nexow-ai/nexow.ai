"""Agent executor — evaluates a single agent and acts on its signal."""

from __future__ import annotations

from typing import Any

import structlog

from nexow.agents.base import AgentStrategy, Signal, SignalType
from nexow.agents.discretionary import DiscretionaryAgent
from nexow.agents.portfolio import PortfolioAgent
from nexow.agents.systematic import SystematicAgent
from nexow.broker.models import Candle, OrderRequest
from nexow.broker.oanda import OandaClient
from nexow.copy.manager import CopyManager
from nexow.db.client import SupabaseClient
from nexow.risk.guardrails import RiskGuardrails

logger = structlog.get_logger(__name__)


class AgentExecutor:
    """Evaluates agent logic against market data and executes trades."""

    def __init__(
        self,
        db: SupabaseClient,
        broker: OandaClient,
        copy_manager: CopyManager,
        risk: RiskGuardrails,
    ) -> None:
        self.db = db
        self.broker = broker
        self.copy_manager = copy_manager
        self.risk = risk

    def _create_strategy(self, agent: dict[str, Any]) -> AgentStrategy:
        """Instantiate the correct strategy class based on agent type."""
        agent_id = agent["id"]
        config = agent.get("config", {})
        agent_type = agent.get("type", "systematic")

        if agent_type == "discretionary":
            return DiscretionaryAgent(agent_id, config)
        return SystematicAgent(agent_id, config)

    async def execute(
        self,
        agent: dict[str, Any],
        candles: list[Candle],
        current_price: float,
        portfolio: PortfolioAgent | None = None,
    ) -> None:
        """
        Run one evaluation cycle for a single agent on one instrument.

        1. Create strategy instance
        2. Evaluate candles -> get Signal
        3. If actionable, check risk guardrails + correlation
        4. Execute order on broker (scaled by portfolio allocation)
        5. Record trade in DB
        6. Trigger copy trades
        """
        agent_id = agent["id"]
        instrument = candles[0].instrument if candles else agent.get("instrument", "EUR_USD")

        try:
            strategy = self._create_strategy(agent)
            signal: Signal = await strategy.evaluate(candles, current_price)

            logger.info(
                "agent_signal",
                agent_id=agent_id[:8],
                name=agent.get("name", "?"),
                instrument=instrument,
                signal=signal.type.value,
                reason=signal.reason,
                confidence=f"{signal.confidence:.2f}",
            )

            if signal.type == SignalType.HOLD:
                return

            # Check risk guardrails
            if not self.risk.allow_trade(agent, signal):
                logger.warning("trade_blocked_by_risk", agent_id=agent_id, reason="guardrail")
                return

            # Check portfolio correlation if applicable
            if portfolio and signal.type in (SignalType.BUY, SignalType.SELL):
                open_trades = self.db.get_open_trades(agent_id)
                open_positions = {
                    t["instrument"]: t["direction"]
                    for t in open_trades
                }
                if not portfolio.check_correlation_exposure(
                    instrument, signal.type.value, open_positions, {}
                ):
                    logger.warning("trade_blocked_by_correlation", agent_id=agent_id, instrument=instrument)
                    return

            if signal.type == SignalType.CLOSE:
                await self._close_positions(agent_id, instrument, current_price)
                return

            # Calculate position size
            account = await self.broker.get_account_summary()
            risk_config = agent.get("config", {}).get("risk", {})
            risk_pct = risk_config.get("risk_per_trade_pct", agent.get("risk_per_trade_pct", 1.0))
            units = self._calculate_units(account.balance, risk_pct, signal)

            # Scale by portfolio allocation
            if portfolio:
                units = portfolio.scale_units_by_allocation(units, instrument)

            if units == 0:
                return

            # Use signal's SL/TP or fall back to config-based defaults
            sl = signal.stop_loss
            tp = signal.take_profit

            if sl is None and risk_config.get("stop_loss_mode") != "none":
                pip = self._get_pip_value(instrument)
                sl_pips = risk_config.get("stop_loss_pips", 20)
                if signal.type == SignalType.BUY:
                    sl = current_price - sl_pips * pip
                else:
                    sl = current_price + sl_pips * pip

            if tp is None and risk_config.get("take_profit_mode") != "none":
                pip = self._get_pip_value(instrument)
                rr = risk_config.get("risk_reward_ratio", 2.0)
                sl_pips = risk_config.get("stop_loss_pips", 20)
                if signal.type == SignalType.BUY:
                    tp = current_price + sl_pips * rr * pip
                else:
                    tp = current_price - sl_pips * rr * pip

            # Place order
            order = OrderRequest(
                instrument=instrument,
                units=units if signal.type == SignalType.BUY else -units,
                stop_loss_price=sl,
                take_profit_price=tp,
            )
            response = await self.broker.place_order(order)

            # Record trade
            trade_record = {
                "agent_id": agent_id,
                "instrument": instrument,
                "direction": signal.type.value,
                "entry_price": response.price,
                "quantity": abs(units),
                "status": "open",
                "oanda_trade_id": response.trade_id,
                "is_copy": False,
            }
            saved_trade = self.db.insert_trade(trade_record)

            logger.info(
                "trade_executed",
                agent_id=agent_id[:8],
                instrument=instrument,
                direction=signal.type.value,
                price=response.price,
                units=units,
                sl=sl,
                tp=tp,
            )

            # Trigger copy trading
            await self.copy_manager.replicate_trade(agent_id, saved_trade)

        except Exception as e:
            logger.error("agent_execution_error", agent_id=agent_id, instrument=instrument, error=str(e))

    async def _close_positions(self, agent_id: str, instrument: str, current_price: float) -> None:
        """Close all open trades for an agent on a specific instrument."""
        open_trades = self.db.get_open_trades(agent_id)
        for trade in open_trades:
            if trade.get("instrument") != instrument:
                continue

            entry = float(trade["entry_price"])
            qty = float(trade["quantity"])
            direction = trade["direction"]

            if direction == "buy":
                pnl = (current_price - entry) * qty
            else:
                pnl = (entry - current_price) * qty

            self.db.close_trade(trade["id"], current_price, pnl)

        logger.info("positions_closed", agent_id=agent_id, instrument=instrument)

    def _calculate_units(self, balance: float, risk_pct: float, signal: Signal) -> int:
        """Calculate position size based on account balance and risk percentage."""
        risk_amount = balance * (risk_pct / 100)
        units = int(risk_amount * 10)
        return max(units, 0)

    def _get_pip_value(self, instrument: str) -> float:
        """Get the pip value for an instrument."""
        if "JPY" in instrument:
            return 0.01
        if "XAU" in instrument:
            return 0.1
        return 0.0001
