"""Main worker loop — polls agents every tick and evaluates them."""

from __future__ import annotations

import asyncio

import structlog

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
    1. Fetch all active agents from Supabase
    2. Group them by instrument to minimize API calls
    3. Fetch candles + price for each instrument
    4. Evaluate each agent and execute signals
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

    async def _tick(self) -> None:
        """Execute one tick of the worker loop."""
        agents = self.db.get_active_agents()
        if not agents:
            return

        # Group agents by instrument to batch market data calls
        instruments: dict[str, list[dict]] = {}
        for agent in agents:
            inst = agent.get("instrument", "EUR_USD")
            instruments.setdefault(inst, []).append(agent)

        # Process each instrument group
        for instrument, agent_group in instruments.items():
            try:
                candles = await self.broker.get_candles(
                    instrument=instrument,
                    granularity=agent_group[0].get("timeframe", "M5"),
                )
                current_price = await self.broker.get_price(instrument)

                for agent in agent_group:
                    await self.executor.execute(agent, candles, current_price)

            except Exception as e:
                logger.error(
                    "instrument_processing_error",
                    instrument=instrument,
                    error=str(e),
                )
