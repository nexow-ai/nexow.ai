"""PydanticAI-powered strategy factory — converts natural language to agent config."""

from __future__ import annotations

import structlog
from pydantic_ai import Agent

from nexow.ai.schemas import (
    AgentGenerationResult,
    DiscretionaryStrategyConfig,
    SystematicStrategyConfig,
)
from nexow.config import settings

logger = structlog.get_logger(__name__)

SYSTEM_PROMPT = """\
You are Nexow's Agent Factory. Your job is to convert a user's plain-English trading idea
into a precise, executable trading agent configuration.

Rules:
1. Decide if the strategy is "systematic" (rule-based indicators like RSI, MACD, EMA)
   or "discretionary" (requires LLM reasoning about news/context).
2. For systematic: pick the best indicator strategy and tune its parameters to match the user's intent.
3. For discretionary: define personality, focus areas, and reasoning depth.
4. Always set sensible risk parameters. Default to cautious if the user doesn't specify.
5. Match the instrument to what the user mentions (e.g., "Gold" = XAU_USD, "Euro" = EUR_USD).
6. Generate a creative but descriptive name for the agent.

Available instruments: EUR_USD, GBP_USD, USD_JPY, XAU_USD, USD_CAD, AUD_USD, NZD_USD, USD_CHF
Available systematic strategies: rsi_reversal, macd_crossover, ema_crossover, bollinger_breakout
Available timeframes: M1, M5, M15, M30, H1, H4, D
"""

strategy_factory = Agent(
    "openai:gpt-4o-mini",
    result_type=AgentGenerationResult,
    system_prompt=SYSTEM_PROMPT,
)


async def generate_strategy(user_prompt: str) -> AgentGenerationResult:
    """
    Take a user's natural language prompt and generate a validated strategy config.

    Args:
        user_prompt: The user's trading idea in plain English.

    Returns:
        AgentGenerationResult with type, name, description, and validated config.
    """
    logger.info("generating_strategy", prompt=user_prompt)

    result = await strategy_factory.run(user_prompt)
    generation = result.data

    # Validate the config against the appropriate schema
    if generation.agent_type == "systematic":
        validated = SystematicStrategyConfig(**generation.config)
        generation.config = validated.model_dump()
    elif generation.agent_type == "discretionary":
        validated = DiscretionaryStrategyConfig(**generation.config)
        generation.config = validated.model_dump()

    logger.info(
        "strategy_generated",
        agent_type=generation.agent_type,
        name=generation.name,
    )
    return generation
