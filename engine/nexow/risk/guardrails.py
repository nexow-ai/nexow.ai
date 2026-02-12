"""Risk guardrails — placeholder for future portfolio management layer."""

from __future__ import annotations

import structlog

logger = structlog.get_logger(__name__)

# Risk management is intentionally NOT part of the agent/signal layer.
# Agents are pure signal providers (entry/exit) compared by gross return %.
#
# A separate portfolio management layer will be built in the future
# that consumes agent signals and applies:
# - Position sizing
# - Max drawdown kill switches
# - Correlation-based exposure limits
# - Daily loss limits
# - Margin / leverage management
