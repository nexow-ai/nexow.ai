"""Copy trading manager — detects master trades and replicates them for copiers."""

from __future__ import annotations

from typing import Any

import structlog

from nexow.broker.models import OrderRequest
from nexow.broker.oanda import OandaClient
from nexow.db.client import SupabaseClient

logger = structlog.get_logger(__name__)


class CopyManager:
    """
    Manages copy-trading replication.

    When a master agent executes a trade, this manager:
    1. Finds all active copiers for that agent
    2. Calculates proportional position sizes
    3. Executes matching trades
    4. Records them as copy trades in the DB
    """

    def __init__(self, db: SupabaseClient, broker: OandaClient) -> None:
        self.db = db
        self.broker = broker

    async def replicate_trade(self, agent_id: str, master_trade: dict[str, Any]) -> None:
        """
        Replicate a master trade to all active copiers.

        Args:
            agent_id: The master agent ID.
            master_trade: The trade record from the master agent.
        """
        copiers = self.db.get_active_copiers(agent_id)
        if not copiers:
            return

        logger.info("replicating_trade", agent_id=agent_id, copier_count=len(copiers))

        for subscription in copiers:
            try:
                await self._execute_copy_trade(subscription, master_trade)
            except Exception as e:
                logger.error(
                    "copy_trade_error",
                    copier_id=subscription["copier_id"],
                    error=str(e),
                )

    async def _execute_copy_trade(
        self,
        subscription: dict[str, Any],
        master_trade: dict[str, Any],
    ) -> None:
        """Execute a single copy trade for one subscriber."""
        allocation_pct = subscription.get("allocation_pct", 10.0)
        master_units = int(master_trade["quantity"])
        direction = master_trade["direction"]

        # Calculate proportional size
        copy_units = max(int(master_units * (allocation_pct / 100)), 1)
        if direction == "sell":
            copy_units = -copy_units

        order = OrderRequest(
            instrument=master_trade["instrument"],
            units=copy_units,
        )

        response = await self.broker.place_order(order)

        # Record as copy trade
        copy_trade = {
            "agent_id": master_trade["agent_id"],
            "instrument": master_trade["instrument"],
            "direction": direction,
            "entry_price": response.price,
            "quantity": abs(copy_units),
            "status": "open",
            "oanda_trade_id": response.trade_id,
            "is_copy": True,
            "master_trade_id": master_trade["id"],
        }
        self.db.insert_trade(copy_trade)

        logger.info(
            "copy_trade_executed",
            copier_id=subscription["copier_id"],
            units=copy_units,
            price=response.price,
        )
