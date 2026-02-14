"""Lightweight FastAPI app exposing the backtest endpoint via SSE."""

from __future__ import annotations

import json
from dataclasses import asdict
from datetime import datetime, timedelta, timezone

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from nexow.backtest.engine import BacktestEngine, ProgressUpdate

logger = structlog.get_logger(__name__)

app = FastAPI(title="Nexow Engine API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------------
# Request / response models
# ------------------------------------------------------------------

class InstrumentConfig(BaseModel):
    instrument: str
    timeframe: str = "M5"


class ExitConfigRequest(BaseModel):
    stop_loss_pct: float | None = None
    take_profit_pct: float | None = None


class BacktestRequest(BaseModel):
    config: dict = Field(description="Agent config JSON containing 'rules'")
    instruments: list[InstrumentConfig]
    exit_config: ExitConfigRequest = Field(default_factory=ExitConfigRequest)
    period_days: int = Field(default=365, ge=30, le=730)


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _progress_to_dict(update: ProgressUpdate) -> dict:
    """Convert a ProgressUpdate dataclass to a JSON-serializable dict."""
    d: dict = {
        "phase": update.phase,
        "progress_pct": update.progress_pct,
        "message": update.message,
    }
    # Stream partial equity curve during simulation for real-time charting
    if update.equity_curve:
        d["equity_curve"] = [asdict(p) for p in update.equity_curve]
    if update.result is not None:
        result = update.result
        d["result"] = {
            "stats": asdict(result.stats),
            "trades": [asdict(t) for t in result.trades],
            "equity_curve": [asdict(p) for p in result.equity_curve],
        }
    return d


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/backtest")
async def run_backtest(request: BacktestRequest):
    """
    Run a backtest and stream progress via Server-Sent Events.

    Each SSE event is a JSON object with:
      - phase: "fetching" | "simulating" | "complete" | "error"
      - progress_pct: 0-100
      - message: human-readable status
      - result: (only on "complete") full backtest results
    """
    engine = BacktestEngine()
    period_end = datetime.now(timezone.utc)
    period_start = period_end - timedelta(days=request.period_days)

    instruments = [i.model_dump() for i in request.instruments]
    exit_cfg = request.exit_config.model_dump()

    logger.info(
        "backtest_requested",
        instruments=[i["instrument"] for i in instruments],
        period_days=request.period_days,
    )

    async def event_generator():
        try:
            async for update in engine.run(
                config=request.config,
                instruments=instruments,
                exit_config=exit_cfg,
                period_start=period_start,
                period_end=period_end,
            ):
                data = json.dumps(_progress_to_dict(update))
                yield {"event": "progress", "data": data}
        except Exception as e:
            logger.error("backtest_stream_error", error=str(e))
            error_data = json.dumps({
                "phase": "error",
                "progress_pct": 0,
                "message": f"Backtest failed: {e}",
            })
            yield {"event": "progress", "data": error_data}
        finally:
            await engine.market.close()

    return EventSourceResponse(event_generator())
