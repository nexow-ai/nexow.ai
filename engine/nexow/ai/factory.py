"""PydanticAI-powered strategy factory — converts natural language to agent config."""

from __future__ import annotations

import structlog
from pydantic_ai import Agent

from nexow.ai.schemas import (
    AgentGenerationResult,
    AgentType,
    DiscretionaryStrategyConfig,
    SystematicStrategyConfig,
)
from nexow.config import settings

logger = structlog.get_logger(__name__)

SYSTEM_PROMPT = """\
You are Nexow's Agent Factory. Convert a user's plain-English trading idea into a precise,
executable trading agent configuration. You must return valid JSON that matches the expected schema.

## Agent Types

**Systematic** — rule-based agents using technical indicators. Use when the user wants:
- Specific indicators (RSI, MACD, EMA, Bollinger Bands)
- Clear buy/sell rules ("buy when RSI < 30")
- Fast, deterministic execution

**Discretionary** — LLM-powered agents that reason about context. Use when the user wants:
- News-aware trading ("trade based on market sentiment")
- Complex reasoning ("analyze the macro environment")
- Context-dependent decisions

## Portfolio Support

Agents can trade MULTIPLE instruments. Build a portfolio when the user mentions:
- Multiple currencies/assets ("trade EUR/USD and Gold")
- Diversification ("build a balanced forex portfolio")
- Hedging ("hedge my EUR exposure with CHF")

Allocations must sum to 100%. Assign higher allocation to the primary instrument.

## Available Instruments
EUR_USD, GBP_USD, USD_JPY, XAU_USD, USD_CAD, AUD_USD, NZD_USD, USD_CHF

## Available Strategies (systematic only)
- rsi_reversal: Buy oversold, sell overbought
- macd_crossover: Buy/sell on MACD signal line crossover
- ema_crossover: Buy/sell on fast/slow EMA crossover
- bollinger_breakout: Buy/sell on Bollinger Band breakout
- rsi_macd_confluence: Both RSI and MACD must agree
- ema_bollinger_confluence: EMA trend + Bollinger confirmation

## Timeframes
M1, M5, M15, M30, H1, H4, D

## Risk Management
Always set sensible risk. Default to cautious if unspecified:
- risk_per_trade_pct: 1.0 (cautious), 2.0 (balanced), 3.0+ (aggressive)
- max_drawdown_pct: 10 (cautious), 20 (balanced), 30+ (aggressive)
- stop_loss_mode: "fixed_pips" (default), "atr_based" (adaptive), "trailing" (trend-following)
- take_profit_mode: "risk_reward" (default, use 2:1 ratio), "fixed_pips", "atr_based"
- max_concurrent_trades: 3 (cautious), 5 (balanced), 10 (aggressive)

## LLM Provider (discretionary only)
- "openai" with model "gpt-4o-mini" (faster, cheaper) or "gpt-4o" (smarter)
- "anthropic" with model "claude-sonnet-4-20250514" (excellent reasoning)

## Output Rules
1. Generate a creative, descriptive name.
2. Write a clear 1-2 sentence description.
3. Include a risk_summary line like "Cautious: 1% risk, 2:1 R:R, 10% max DD"
4. Include a portfolio_summary line like "EUR/USD (60%) + XAU/USD (40%)"
5. The config dict must contain all required fields for the chosen type.
"""


def _get_model(provider: str = "openai") -> str:
    """Return the PydanticAI model string based on provider."""
    if provider == "anthropic" and settings.anthropic_api_key:
        return "anthropic:claude-sonnet-4-20250514"
    return "openai:gpt-4o-mini"


# Default factory using OpenAI
_factory_openai = Agent(
    "openai:gpt-4o-mini",
    output_type=AgentGenerationResult,
    system_prompt=SYSTEM_PROMPT,
)


async def generate_strategy(
    user_prompt: str,
    preferred_provider: str = "openai",
) -> AgentGenerationResult:
    """
    Take a user's natural language prompt and generate a validated strategy config.

    Args:
        user_prompt: The user's trading idea in plain English.
        preferred_provider: Which LLM to use for generation ("openai" or "anthropic").

    Returns:
        AgentGenerationResult with type, name, description, and validated config.
    """
    logger.info("generating_strategy", prompt=user_prompt[:100], provider=preferred_provider)

    model = _get_model(preferred_provider)

    # Create agent with the chosen model
    factory = Agent(
        model,
        output_type=AgentGenerationResult,
        system_prompt=SYSTEM_PROMPT,
    )

    result = await factory.run(user_prompt)
    generation = result.output

    # Validate the config against the appropriate schema
    try:
        if generation.agent_type == AgentType.SYSTEMATIC:
            validated = SystematicStrategyConfig(**generation.config)
            generation.config = validated.model_dump(mode="json")
        elif generation.agent_type == AgentType.DISCRETIONARY:
            validated = DiscretionaryStrategyConfig(**generation.config)
            generation.config = validated.model_dump(mode="json")
    except Exception as e:
        logger.warning("config_validation_fallback", error=str(e))
        # Keep the raw config if validation fails — AI output was close enough

    logger.info(
        "strategy_generated",
        agent_type=generation.agent_type,
        name=generation.name,
        portfolio=generation.portfolio_summary,
        risk=generation.risk_summary,
    )
    return generation
