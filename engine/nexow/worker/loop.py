"""Main worker loop — polls agents every tick and evaluates them."""

from __future__ import annotations

import asyncio

import structlog

from nexow.ai.factory import generate_strategy
from nexow.agents.portfolio import PortfolioAgent
from nexow.broker.oanda import OandaClient
from nexow.config import settings
from nexow.copy.manager import CopyManager
from nexow.db.client import SupabaseClient
from nexow.risk.guardrails import RiskGuardrails
from nexow.worker.executor import AgentExecutor

logger = structlog.get_logger(__name__)


class WorkerLoop:
    """
    The main engine loop.

    Every tick:
    1. Process pending agents (generate config from prompt)
    2. Fetch all active agents from Supabase
    3. For each agent, build a PortfolioAgent and evaluate each instrument
    4. Execute signals through the AgentExecutor
    """

    def __init__(self) -> None:
        self.db = SupabaseClient()
        self.broker = OandaClient()
        self.copy_manager = CopyManager(self.db, self.broker)
        self.risk = RiskGuardrails(self.db)
        self.executor = AgentExecutor(self.db, self.broker, self.copy_manager, self.risk)
        self._running = False

    async def start(self) -> None:
        """Start the infinite worker loop."""
        self._running = True
        logger.info("worker_started", tick_interval=settings.tick_interval_seconds)

        while self._running:
            try:
                await self._tick()
            except Exception as e:
                logger.error("tick_error", error=str(e))

            await asyncio.sleep(settings.tick_interval_seconds)

    async def stop(self) -> None:
        """Gracefully stop the worker loop."""
        logger.info("worker_stopping")
        self._running = False
        await self.broker.close()

    async def _process_pending(self) -> None:
        """Check for newly created agents that need AI config generation."""
        try:
            pending = self.db.get_pending_agents()
        except Exception:
            return

        for agent in pending:
            prompt = agent.get("prompt", "")
            if not prompt:
                continue

            logger.info("generating_agent_config", agent_id=agent["id"], prompt=prompt[:80])
            try:
                result = await generate_strategy(prompt)

                # Extract portfolio instruments for the DB
                config = result.config
                portfolio = config.get("portfolio", {})
                instruments = portfolio.get("instruments", [])
                risk = config.get("risk", {})

                update_data: dict = {
                    "name": result.name,
                    "description": result.description,
                    "type": result.agent_type.value if hasattr(result.agent_type, "value") else result.agent_type,
                    "config": config,
                    "status": "active",
                }

                if instruments:
                    update_data["instruments"] = instruments
                    update_data["instrument"] = instruments[0].get("instrument", "EUR_USD")
                    update_data["timeframe"] = instruments[0].get("timeframe", "M5")

                if risk:
                    update_data["risk_config"] = risk
                    update_data["max_drawdown_pct"] = risk.get("max_drawdown_pct", 10.0)
                    update_data["risk_per_trade_pct"] = risk.get("risk_per_trade_pct", 1.0)

                self.db.update_agent_config(agent["id"], config)
                self.db.client.table("agents").update(update_data).eq("id", agent["id"]).execute()
                logger.info("agent_activated", agent_id=agent["id"], name=result.name)
            except Exception as e:
                logger.error("agent_generation_failed", agent_id=agent["id"], error=str(e))

    async def _tick(self) -> None:
        """Execute one tick of the worker loop."""
        await self._process_pending()

        agents = self.db.get_active_agents()
        if not agents:
            return

        logger.debug("tick", active_agents=len(agents))

        for agent in agents:
            try:
                portfolio = PortfolioAgent(agent)

                for inst_config in portfolio.instruments_config:
                    instrument = inst_config["instrument"]
                    timeframe = inst_config.get("timeframe", "M5")

                    # Check evaluation schedule for discretionary agents
                    schedule = agent.get("evaluation_schedule", "every_tick")
                    if schedule != "every_tick" and agent.get("type") == "discretionary":
                        # Skip this tick for scheduled agents (simplified; needs time tracking)
                        continue

                    candles = await self.broker.get_candles(
                        instrument=instrument,
                        granularity=timeframe,
                    )
                    current_price = await self.broker.get_price(instrument)

                    await self.executor.execute(
                        agent, candles, current_price, portfolio
                    )

            except Exception as e:
                logger.error(
                    "agent_processing_error",
                    agent_id=agent.get("id", "?"),
                    error=str(e),
                )
