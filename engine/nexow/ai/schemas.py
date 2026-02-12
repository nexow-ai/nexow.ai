"""Pydantic schemas for AI-generated strategy configurations."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────────────────

class AgentType(str, Enum):
    SYSTEMATIC = "systematic"
    DISCRETIONARY = "discretionary"


class LLMProvider(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"


class Personality(str, Enum):
    AGGRESSIVE = "aggressive"
    BALANCED = "balanced"
    CAUTIOUS = "cautious"
    CONSERVATIVE = "conservative"


class StopLossMode(str, Enum):
    FIXED_PIPS = "fixed_pips"
    ATR_BASED = "atr_based"
    TRAILING = "trailing"
    NONE = "none"


class TakeProfitMode(str, Enum):
    FIXED_PIPS = "fixed_pips"
    RISK_REWARD = "risk_reward"
    ATR_BASED = "atr_based"
    NONE = "none"


class StrategyName(str, Enum):
    RSI_REVERSAL = "rsi_reversal"
    MACD_CROSSOVER = "macd_crossover"
    EMA_CROSSOVER = "ema_crossover"
    BOLLINGER_BREAKOUT = "bollinger_breakout"
    RSI_MACD_CONFLUENCE = "rsi_macd_confluence"
    EMA_BOLLINGER_CONFLUENCE = "ema_bollinger_confluence"


class FocusArea(str, Enum):
    TECHNICAL_ANALYSIS = "technical_analysis"
    PRICE_ACTION = "price_action"
    NEWS_SENTIMENT = "news_sentiment"
    ECONOMIC_CALENDAR = "economic_calendar"
    VOLUME_ANALYSIS = "volume_analysis"
    CORRELATION_ANALYSIS = "correlation_analysis"


# ──────────────────────────────────────────────────────────
# Portfolio
# ──────────────────────────────────────────────────────────

class InstrumentAllocation(BaseModel):
    """A single instrument in a portfolio with its target allocation."""

    instrument: str = Field(description="Oanda instrument, e.g. 'EUR_USD', 'XAU_USD'")
    allocation_pct: float = Field(
        default=100.0, ge=1.0, le=100.0,
        description="Target allocation as % of total portfolio",
    )
    timeframe: str = Field(default="M5", description="Candle timeframe for this instrument")


class PortfolioConfig(BaseModel):
    """Multi-asset portfolio configuration."""

    instruments: list[InstrumentAllocation] = Field(
        min_length=1,
        description="List of instruments with allocations (must sum to ~100%)",
    )
    rebalance_frequency: str = Field(
        default="daily",
        description="How often to rebalance: 'never', 'hourly', 'daily', 'weekly'",
    )
    max_correlation: float = Field(
        default=0.8, ge=0.0, le=1.0,
        description="Max allowed correlation between any two positions (0.8 = 80%)",
    )
    hedge_correlated: bool = Field(
        default=False,
        description="Automatically reduce positions when correlation is too high",
    )


# ──────────────────────────────────────────────────────────
# Risk Management
# ──────────────────────────────────────────────────────────

class RiskConfig(BaseModel):
    """Comprehensive risk management parameters."""

    # Position sizing
    risk_per_trade_pct: float = Field(default=1.0, ge=0.1, le=10.0, description="Risk per trade as % of account")
    max_position_size_pct: float = Field(default=5.0, ge=0.5, le=50.0, description="Max single position as % of account")

    # Drawdown limits
    max_drawdown_pct: float = Field(default=10.0, ge=1.0, le=50.0, description="Max drawdown before kill switch activates")
    max_daily_loss_pct: float = Field(default=3.0, ge=0.5, le=20.0, description="Max loss per day as % of account")

    # Stop-loss
    stop_loss_mode: StopLossMode = Field(default=StopLossMode.FIXED_PIPS)
    stop_loss_pips: float | None = Field(default=20.0, ge=1.0, le=500.0, description="Fixed SL in pips")
    stop_loss_atr_multiplier: float = Field(default=1.5, ge=0.5, le=5.0, description="SL as multiple of ATR")
    trailing_stop_pips: float | None = Field(default=None, ge=5.0, le=200.0, description="Trailing stop distance in pips")

    # Take-profit
    take_profit_mode: TakeProfitMode = Field(default=TakeProfitMode.RISK_REWARD)
    take_profit_pips: float | None = Field(default=40.0, ge=1.0, le=1000.0, description="Fixed TP in pips")
    risk_reward_ratio: float = Field(default=2.0, ge=0.5, le=10.0, description="TP as multiple of SL distance")
    take_profit_atr_multiplier: float = Field(default=3.0, ge=1.0, le=10.0, description="TP as multiple of ATR")

    # Exposure limits
    max_concurrent_trades: int = Field(default=3, ge=1, le=20, description="Max simultaneous open trades")
    max_correlated_exposure_pct: float = Field(default=50.0, ge=10.0, le=100.0, description="Max total exposure to correlated instruments")


# ──────────────────────────────────────────────────────────
# Indicator Config
# ──────────────────────────────────────────────────────────

class IndicatorParams(BaseModel):
    """Parameters for a single indicator."""

    # RSI
    rsi_period: int = Field(default=14, ge=2, le=100)
    rsi_oversold: float = Field(default=30, ge=5, le=50)
    rsi_overbought: float = Field(default=70, ge=50, le=95)

    # MACD
    macd_fast: int = Field(default=12, ge=2, le=50)
    macd_slow: int = Field(default=26, ge=10, le=100)
    macd_signal: int = Field(default=9, ge=2, le=50)

    # EMA
    ema_fast: int = Field(default=9, ge=2, le=50)
    ema_slow: int = Field(default=21, ge=10, le=200)

    # Bollinger
    bb_period: int = Field(default=20, ge=5, le=100)
    bb_std: float = Field(default=2.0, ge=0.5, le=4.0)


# ──────────────────────────────────────────────────────────
# Strategy Configs
# ──────────────────────────────────────────────────────────

class SystematicStrategyConfig(BaseModel):
    """Full config for a systematic (rule-based) agent."""

    strategy: StrategyName = Field(description="Primary strategy")
    secondary_strategy: StrategyName | None = Field(
        default=None,
        description="Optional secondary strategy for confluence signals",
    )
    require_confluence: bool = Field(
        default=False,
        description="If true, both strategies must agree before trading",
    )
    portfolio: PortfolioConfig = Field(description="Instruments and allocations")
    indicators: IndicatorParams = Field(default_factory=IndicatorParams)
    risk: RiskConfig = Field(default_factory=RiskConfig)


class DiscretionaryStrategyConfig(BaseModel):
    """Full config for a discretionary (LLM-powered) agent."""

    llm_provider: LLMProvider = Field(default=LLMProvider.OPENAI, description="LLM to use for reasoning")
    llm_model: str = Field(default="gpt-4o-mini", description="Specific model ID")
    personality: Personality = Field(default=Personality.CAUTIOUS)
    reasoning_depth: int = Field(default=3, ge=1, le=5, description="Number of reasoning steps")
    portfolio: PortfolioConfig = Field(description="Instruments and allocations")
    focus_areas: list[FocusArea] = Field(
        default_factory=lambda: [FocusArea.TECHNICAL_ANALYSIS, FocusArea.NEWS_SENTIMENT],
        description="What the agent analyzes",
    )
    use_web_search: bool = Field(default=True, description="Allow agent to search the web via Tavily")
    use_news_feed: bool = Field(default=True, description="Allow agent to read financial news via NewsAPI")
    evaluation_schedule: str = Field(
        default="every_tick",
        description="How often to evaluate: 'every_tick', 'hourly', 'daily'",
    )
    risk: RiskConfig = Field(default_factory=RiskConfig)


# ──────────────────────────────────────────────────────────
# AI Factory Output
# ──────────────────────────────────────────────────────────

class AgentGenerationResult(BaseModel):
    """Result of the AI agent factory: the generated config + metadata."""

    agent_type: AgentType = Field(description="'systematic' or 'discretionary'")
    name: str = Field(description="Generated name for the agent")
    description: str = Field(description="Human-readable description of the strategy")
    config: dict = Field(description="The full strategy config as JSON")
    risk_summary: str = Field(
        default="",
        description="One-line summary of risk approach, e.g. 'Cautious: 1% risk, 2:1 R:R, 10% max DD'",
    )
    portfolio_summary: str = Field(
        default="",
        description="One-line summary of instruments, e.g. 'EUR/USD (60%) + GBP/USD (40%)'",
    )
