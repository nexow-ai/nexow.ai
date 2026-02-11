"""Nexow Engine — main entry point."""

from __future__ import annotations

import asyncio
import signal
import sys

import structlog
from dotenv import load_dotenv

load_dotenv()

from nexow.ai.factory import generate_strategy
from nexow.config import settings
from nexow.db.client import SupabaseClient
from nexow.worker.loop import WorkerLoop

structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)

logger = structlog.get_logger(__name__)


async def process_pending_agents(db: SupabaseClient) -> None:
    """Check for agents with prompts that need AI-generated configs."""
    pending = db.get_pending_agents()
    for agent in pending:
        prompt = agent.get("prompt", "")
        if not prompt:
            continue

        logger.info("processing_pending_agent", agent_id=agent["id"], prompt=prompt)
        try:
            result = await generate_strategy(prompt)
            db.update_agent_config(agent["id"], result.config)
            db.client.table("agents").update({
                "name": result.name,
                "description": result.description,
                "type": result.agent_type,
                "status": "active",
            }).eq("id", agent["id"]).execute()
            logger.info("agent_configured", agent_id=agent["id"], name=result.name)
        except Exception as e:
            logger.error("agent_generation_failed", agent_id=agent["id"], error=str(e))


async def main() -> None:
    """Start the Nexow engine."""
    logger.info("nexow_engine_starting", env=settings.oanda_api_url)

    db = SupabaseClient()
    worker = WorkerLoop()

    # Handle shutdown gracefully
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda: asyncio.create_task(worker.stop()))

    # Process any pending AI generations before starting the loop
    await process_pending_agents(db)

    # Start the main worker loop
    await worker.start()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("nexow_engine_shutdown")
        sys.exit(0)
