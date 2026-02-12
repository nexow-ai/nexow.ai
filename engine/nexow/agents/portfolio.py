"""Portfolio agent — manages multi-asset trading with correlation awareness."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
import structlog

from nexow.agents.base import AgentStrategy, Signal, SignalType
from nexow.agents.discretionary import DiscretionaryAgent
from nexow.agents.systematic import SystematicAgent
from nexow.broker.models import Candle

logger = structlog.get_logger(__name__)


def compute_correlation_matrix(
    price_data: dict[str, list[float]],
) -> dict[tuple[str, str], float]:
    """
    Compute pairwise correlation between instruments from close prices.

    Args:
        price_data: {instrument: [close_prices]} — must be aligned in time.

    Returns:
        Dict mapping (inst_a, inst_b) -> correlation coefficient.
    """
    if len(price_data) < 2:
        return {}

    instruments = list(price_data.keys())
    min_len = min(len(v) for v in price_data.values())
    if min_len < 20:
        return {}

    # Build returns DataFrame
    returns = {}
    for inst, prices in price_data.items():
        arr = np.array(prices[-min_len:])
        ret = np.diff(arr) / arr[:-1]
        returns[inst] = ret

    df = pd.DataFrame(returns)
    corr = df.corr()

    result: dict[tuple[str, str], float] = {}
    for i, a in enumerate(instruments):
        for b in instruments[i + 1:]:
            result[(a, b)] = float(corr.loc[a, b])

    return result


class PortfolioAgent:
    """
    Manages a portfolio of instruments for a single agent.

    Handles:
    - Per-instrument strategy evaluation
    - Correlation-aware position management
    - Allocation-weighted position sizing
    - Rebalancing
    """

    def __init__(self, agent: dict[str, Any]) -> None:
        self.agent = agent
        self.agent_id = agent["id"]
        self.config = agent.get("config", {})
        self.agent_type = agent.get("type", "systematic")

        # Parse portfolio from config or agent columns
        portfolio = self.config.get("portfolio", {})
        self.instruments_config: list[dict[str, Any]] = portfolio.get(
            "instruments",
            agent.get("instruments", [{"instrument": agent.get("instrument", "EUR_USD"), "allocation_pct": 100, "timeframe": "M5"}]),
        )
        self.max_correlation = portfolio.get("max_correlation", 0.8)
        self.hedge_correlated = portfolio.get("hedge_correlated", False)

    @property
    def instruments(self) -> list[str]:
        """List of instrument names in the portfolio."""
        return [ic["instrument"] for ic in self.instruments_config]

    def get_allocation(self, instrument: str) -> float:
        """Get the target allocation % for an instrument."""
        for ic in self.instruments_config:
            if ic["instrument"] == instrument:
                return ic.get("allocation_pct", 100.0) / 100.0
        return 1.0

    def get_timeframe(self, instrument: str) -> str:
        """Get the timeframe for an instrument."""
        for ic in self.instruments_config:
            if ic["instrument"] == instrument:
                return ic.get("timeframe", "M5")
        return "M5"

    def _create_strategy(self, instrument: str) -> AgentStrategy:
        """Create the appropriate strategy for an instrument."""
        if self.agent_type == "discretionary":
            return DiscretionaryAgent(self.agent_id, self.config)
        return SystematicAgent(self.agent_id, self.config)

    async def evaluate_instrument(
        self,
        instrument: str,
        candles: list[Candle],
        current_price: float,
    ) -> Signal:
        """Evaluate a single instrument and return its signal."""
        strategy = self._create_strategy(instrument)
        signal = await strategy.evaluate(candles, current_price)
        return signal

    def check_correlation_exposure(
        self,
        instrument: str,
        action: str,
        open_positions: dict[str, str],
        correlations: dict[tuple[str, str], float],
    ) -> bool:
        """
        Check if opening a position would create too much correlated exposure.

        Args:
            instrument: The instrument to trade.
            action: "buy" or "sell".
            open_positions: {instrument: "buy"|"sell"} of currently open positions.
            correlations: Pairwise correlation coefficients.

        Returns:
            True if the trade is safe, False if it would exceed correlation limits.
        """
        if not open_positions or not correlations:
            return True

        for open_inst, open_dir in open_positions.items():
            if open_inst == instrument:
                continue

            pair = (instrument, open_inst) if (instrument, open_inst) in correlations else (open_inst, instrument)
            corr = correlations.get(pair, 0.0)

            # High positive correlation + same direction = concentrated risk
            if abs(corr) > self.max_correlation:
                same_direction = (action == open_dir and corr > 0) or (action != open_dir and corr < 0)
                if same_direction:
                    logger.warning(
                        "correlation_block",
                        instrument=instrument,
                        correlated_with=open_inst,
                        correlation=f"{corr:.2f}",
                    )
                    return False

        return True

    def scale_units_by_allocation(self, base_units: int, instrument: str) -> int:
        """Scale position size by the instrument's portfolio allocation."""
        allocation = self.get_allocation(instrument)
        return max(int(base_units * allocation), 1)
