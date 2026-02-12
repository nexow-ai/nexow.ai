"""Copy trading manager — placeholder for future signal subscription layer."""

from __future__ import annotations

import structlog

logger = structlog.get_logger(__name__)

# Copy trading is intentionally disabled in the signal-only model.
# In the future, the portfolio management layer will allow users to
# subscribe to agent signals and apply their own risk/sizing rules.
