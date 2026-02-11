"""Pydantic schemas for AI-generated strategy configurations."""

from __future__ import annotations

from pydantic import BaseModel, Field


class IndicatorConfig(BaseModel):
    """Configuration for a single technical indicator."""

    name: str = Field(description="Indicator name, e.g. 'rsi', 'macd', 'ema_crossover', 'bollinger'")
    params: dict[str, float | int] = Field(
        default_factory=dict,
        description="Indicator parameters, e.g. {'period': 14, 'oversold': 30}",
    )


class RiskConfig(BaseModel):
    """Risk management parameters."""

    max_drawdown_pct: float = Field(default=10.0, ge=1.0, le=50.0, description="Max drawdown before kill switch activates")
    risk_per_trade_pct: float = Field(default=1.0, ge=0.1, le=10.0, description="Risk per trade as % of account")
    stop_loss_pips: float | None = Field(default=None, description="Fixed stop-loss in pips")
    take_profit_pips: float | None = Field(default=None, description="Fixed take-profit in pips")


class SystematicStrategyConfig(BaseModel):
    """Full config for a systematic (rule-based) agent."""

    strategy: str = Field(description="Strategy type: 'rsi_reversal', 'macd_crossover', 'ema_crossover', 'bollinger_breakout'")
    instrument: str = Field(default="EUR_USD", description="Trading instrument")
    timeframe: str = Field(default="M5", description="Candle timeframe")
    indicators: list[IndicatorConfig] = Field(default_factory=list)
    risk: RiskConfig = Field(default_factory=RiskConfig)

    # Indicator-specific params (flattened for convenience)
    rsi_period: int = Field(default=14, ge=2, le=100)
    rsi_oversold: float = Field(default=30, ge=5, le=50)
    rsi_overbought: float = Field(default=70, ge=50, le=95)
    macd_fast: int = Field(default=12, ge=2, le=50)
    macd_slow: int = Field(default=26, ge=10, le=100)
    macd_signal: int = Field(default=9, ge=2, le=50)
    ema_fast: int = Field(default=9, ge=2, le=50)
    ema_slow: int = Field(default=21, ge=10, le=200)
    bb_period: int = Field(default=20, ge=5, le=100)
    bb_std: float = Field(default=2.0, ge=0.5, le=4.0)


class DiscretionaryStrategyConfig(BaseModel):
    """Full config for a discretionary (LLM-powered) agent."""

    instrument: str = Field(default="EUR_USD", description="Trading instrument")
    timeframe: str = Field(default="H1", description="Candle timeframe")
    personality: str = Field(default="cautious", description="Agent personality: 'aggressive', 'cautious', 'balanced'")
    reasoning_depth: int = Field(default=2, ge=1, le=5, description="How many reasoning steps the LLM performs")
    risk: RiskConfig = Field(default_factory=RiskConfig)
    focus_areas: list[str] = Field(
        default_factory=lambda: ["technical_analysis", "price_action"],
        description="What the agent focuses on: technical_analysis, news_sentiment, price_action, volume_analysis",
    )


class AgentGenerationResult(BaseModel):
    """Result of the AI agent factory: the generated config + metadata."""

    agent_type: str = Field(description="'systematic' or 'discretionary'")
    name: str = Field(description="Generated name for the agent")
    description: str = Field(description="Human-readable description of the strategy")
    config: dict = Field(description="The full strategy config as JSON")
