"""PydanticAI-powered strategy factory — converts natural language to rule DSL + agent config."""

from __future__ import annotations

import structlog
from pydantic_ai import Agent

from nexow.ai.schemas import AgentGenerationResult, AgentType
from nexow.config import settings
from nexow.rules.schema import CONDITION_CATALOG

logger = structlog.get_logger(__name__)

SYSTEM_PROMPT = f"""\
You are Nexow's Agent Factory. Convert a user's plain-English trading idea into a precise,
executable trading agent configuration with dynamic rules.

## Design Philosophy

Agents are **signal providers** — they emit entry signals (BUY/SELL) and exit signals (CLOSE).
There is NO position sizing, no volume, no risk management in the agent config. Those concerns
belong to a separate portfolio management layer.

Agents are compared purely by the gross percentage return of their signals.

## Agent Types

**Systematic** — rule-based agents. The AI generates a JSON rule tree that the engine
interprets dynamically. ANY trading logic expressible as conditions + operators is supported.

**Discretionary** — LLM-powered agents that reason about news, sentiment, and context
before each trade. Use when the user wants news-aware or reasoning-heavy strategies.

## Rule DSL (for systematic agents)

The config must contain a "rules" object with "buy_rules", "sell_rules", and optionally "close_rules".
Each rule group has an "operator" and a list of "conditions".

- **buy_rules** — conditions to open a LONG position
- **sell_rules** — conditions to open a SHORT position
- **close_rules** — conditions to close any open position (optional, rule-based exits)

Operators: "and" (all must be true), "or" (any true), "not" (invert), "always" (unconditional)

### Available Condition Types:
{CONDITION_CATALOG}

### Rule Examples:

"Buy when RSI < 30 and candle is green":
{{"rules": {{"buy_rules": {{"operator": "and", "conditions": [
  {{"type": "rsi_below", "params": {{"threshold": 30, "period": 14}}}},
  {{"type": "candle_is_green"}}
]}}, "sell_rules": {{"operator": "and", "conditions": [{{"type": "rsi_above", "params": {{"threshold": 70, "period": 14}}}}]}}}}}}

"Buy on MACD bullish crossover when price is above EMA 50":
{{"rules": {{"buy_rules": {{"operator": "and", "conditions": [
  {{"type": "macd_cross_up"}},
  {{"type": "price_above_ema", "params": {{"period": 50}}}}
]}}, "sell_rules": {{"operator": "or", "conditions": [{{"type": "macd_cross_down"}}, {{"type": "price_below_ema", "params": {{"period": 50}}}}]}}}}}}

## Portfolio

The config must include which instruments and timeframes to trade:
{{"portfolio": {{"instruments": [{{"instrument": "EUR_USD", "timeframe": "M5"}}]}}}}

Available instruments: EUR_USD, GBP_USD, USD_JPY, XAU_USD, USD_CAD, AUD_USD, NZD_USD, USD_CHF
Available timeframes: M1, M5, M15, M30, H1, H4, D

## Exit Levels (percentage-based)

Every agent should define default exit levels as percentages from entry:
{{"exit": {{"stop_loss_pct": 2.0, "take_profit_pct": 4.0}}}}

- stop_loss_pct: close if the trade moves this % against entry (e.g. 2.0 = -2%)
- take_profit_pct: close if the trade moves this % in favour (e.g. 4.0 = +4%)

Choose levels that match the strategy style:
- Scalping: SL 0.3-0.5%, TP 0.5-1%
- Day trading: SL 1-2%, TP 2-4%
- Swing trading: SL 2-5%, TP 5-10%
- Position trading: SL 5-10%, TP 10-20%

## For Discretionary Agents

Include: llm_provider, llm_model, personality, focus_areas, use_web_search, use_news_feed, evaluation_schedule

## Output

Return valid JSON with: agent_type, name, description, config, portfolio_summary
The config must contain: portfolio, rules (for systematic), and exit.
"""


def _get_model(provider: str = "openai") -> str:
    if provider == "anthropic" and settings.anthropic_api_key:
        return "anthropic:claude-sonnet-4-20250514"
    return "openai:gpt-4o-mini"


async def generate_strategy(
    user_prompt: str,
    preferred_provider: str = "openai",
) -> AgentGenerationResult:
    """Generate a validated strategy config from a natural language prompt."""
    logger.info("generating_strategy", prompt=user_prompt[:100], provider=preferred_provider)

    model = _get_model(preferred_provider)
    factory = Agent(model, output_type=AgentGenerationResult, system_prompt=SYSTEM_PROMPT)

    result = await factory.run(user_prompt)
    generation = result.output

    logger.info(
        "strategy_generated",
        agent_type=generation.agent_type,
        name=generation.name,
        has_rules="rules" in generation.config,
    )
    return generation
