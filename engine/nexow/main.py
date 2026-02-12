"""Nexow Engine — main entry point."""

from __future__ import annotations

import asyncio
import signal
import sys

import structlog
from dotenv import load_dotenv

load_dotenv()

from nexow.config import settings
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


async def main() -> None:
    """Start the Nexow engine."""
    logger.info(
        "nexow_engine_starting",
        oanda_url=settings.oanda_api_url,
        tick_interval=settings.tick_interval_seconds,
    )

    worker = WorkerLoop()

    # Handle shutdown gracefully
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda: asyncio.create_task(worker.stop()))

    # Start the main worker loop (handles pending agents + active agents)
    await worker.start()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("nexow_engine_shutdown")
        sys.exit(0)
