"""Nexow Engine — main entry point.

Runs two concurrent tasks:
1. WorkerLoop  — polls agents every tick and evaluates them (live trading)
2. FastAPI     — HTTP API for backtest requests
"""

from __future__ import annotations

import asyncio
import signal
import sys

import structlog
import uvicorn
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


async def run_api() -> None:
    """Start the FastAPI server for backtest endpoints."""
    try:
        config = uvicorn.Config(
            "nexow.api:app",
            host=settings.api_host,
            port=settings.api_port,
            log_level="info",
        )
        server = uvicorn.Server(config)
        await server.serve()
    except (OSError, SystemExit) as e:
        logger.error(
            "api_server_failed",
            port=settings.api_port,
            error=str(e),
            hint="Port may already be in use. Kill the stale process or change API_PORT.",
        )


async def main() -> None:
    """Start the Nexow engine (worker loop + API server)."""
    logger.info(
        "nexow_engine_starting",
        oanda_url=settings.oanda_api_url,
        tick_interval=settings.tick_interval_seconds,
        api_port=settings.api_port,
    )

    worker = WorkerLoop()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda: asyncio.create_task(worker.stop()))

    # Run both the worker loop and the API server concurrently.
    # If the API server fails (e.g. port in use), the worker loop keeps running.
    await asyncio.gather(
        worker.start(),
        run_api(),
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("nexow_engine_shutdown")
        sys.exit(0)
