/**
 * Pre-built agent templates for common trading strategies.
 * Users can one-click deploy or customize these.
 */

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  agent_type: "systematic" | "discretionary";
  difficulty: "beginner" | "intermediate" | "advanced";
  tags: string[];
  prompt: string;
  config: Record<string, unknown>;
}

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: "conservative-gold-rsi",
    name: "Conservative Gold RSI",
    description: "A cautious Gold trader that buys oversold dips and sells overbought peaks using RSI 14. Low risk with tight stop-losses.",
    agent_type: "systematic",
    difficulty: "beginner",
    tags: ["Gold", "RSI", "Conservative", "Single Asset"],
    prompt: "Conservative Gold trader using RSI on H1 with 1% risk and 2:1 reward ratio",
    config: {
      strategy: "rsi_reversal",
      portfolio: {
        instruments: [{ instrument: "XAU_USD", allocation_pct: 100, timeframe: "H1" }],
        max_correlation: 0.8,
        rebalance_frequency: "never",
      },
      indicators: { rsi_period: 14, rsi_oversold: 30, rsi_overbought: 70 },
      risk: {
        risk_per_trade_pct: 1.0,
        max_drawdown_pct: 8.0,
        max_daily_loss_pct: 2.0,
        stop_loss_mode: "fixed_pips",
        stop_loss_pips: 30,
        take_profit_mode: "risk_reward",
        risk_reward_ratio: 2.0,
        max_concurrent_trades: 2,
      },
    },
  },
  {
    id: "eur-usd-macd-scalper",
    name: "EUR/USD MACD Scalper",
    description: "Fast M5 scalper on EUR/USD using MACD crossovers. Moderate risk with quick entries and exits.",
    agent_type: "systematic",
    difficulty: "intermediate",
    tags: ["EUR/USD", "MACD", "Scalping", "M5"],
    prompt: "EUR/USD scalper using MACD crossovers on M5 with moderate risk",
    config: {
      strategy: "macd_crossover",
      portfolio: {
        instruments: [{ instrument: "EUR_USD", allocation_pct: 100, timeframe: "M5" }],
        max_correlation: 0.8,
        rebalance_frequency: "never",
      },
      indicators: { macd_fast: 12, macd_slow: 26, macd_signal: 9 },
      risk: {
        risk_per_trade_pct: 1.5,
        max_drawdown_pct: 12.0,
        max_daily_loss_pct: 3.0,
        stop_loss_mode: "fixed_pips",
        stop_loss_pips: 15,
        take_profit_mode: "risk_reward",
        risk_reward_ratio: 1.5,
        max_concurrent_trades: 3,
      },
    },
  },
  {
    id: "forex-duo-ema-bb",
    name: "Forex Duo: EMA + Bollinger",
    description: "Trades EUR/USD and GBP/USD with EMA crossover confirmed by Bollinger Bands. Correlation-aware portfolio.",
    agent_type: "systematic",
    difficulty: "intermediate",
    tags: ["Portfolio", "EMA", "Bollinger", "Correlation"],
    prompt: "EUR/USD 60% and GBP/USD 40% portfolio using EMA crossover with Bollinger Band confirmation",
    config: {
      strategy: "ema_bollinger_confluence",
      require_confluence: true,
      portfolio: {
        instruments: [
          { instrument: "EUR_USD", allocation_pct: 60, timeframe: "M15" },
          { instrument: "GBP_USD", allocation_pct: 40, timeframe: "M15" },
        ],
        max_correlation: 0.75,
        hedge_correlated: true,
        rebalance_frequency: "daily",
      },
      indicators: {
        ema_fast: 9, ema_slow: 21,
        bb_period: 20, bb_std: 2.0,
      },
      risk: {
        risk_per_trade_pct: 1.0,
        max_drawdown_pct: 15.0,
        max_daily_loss_pct: 3.0,
        stop_loss_mode: "atr_based",
        stop_loss_atr_multiplier: 1.5,
        take_profit_mode: "risk_reward",
        risk_reward_ratio: 2.5,
        max_concurrent_trades: 4,
        max_correlated_exposure_pct: 50.0,
      },
    },
  },
  {
    id: "news-trader-gold",
    name: "News-Aware Gold Trader",
    description: "A discretionary agent that reads financial news and market analysis before deciding on Gold trades. Uses GPT-4o-mini.",
    agent_type: "discretionary",
    difficulty: "advanced",
    tags: ["Gold", "News", "AI", "Discretionary"],
    prompt: "Smart news-aware Gold trader that analyzes market sentiment before trading on H1",
    config: {
      llm_provider: "openai",
      llm_model: "gpt-4o-mini",
      personality: "cautious",
      reasoning_depth: 3,
      portfolio: {
        instruments: [{ instrument: "XAU_USD", allocation_pct: 100, timeframe: "H1" }],
        max_correlation: 0.8,
        rebalance_frequency: "never",
      },
      focus_areas: ["technical_analysis", "news_sentiment", "economic_calendar"],
      use_web_search: true,
      use_news_feed: true,
      evaluation_schedule: "hourly",
      risk: {
        risk_per_trade_pct: 1.0,
        max_drawdown_pct: 10.0,
        max_daily_loss_pct: 2.5,
        stop_loss_mode: "atr_based",
        stop_loss_atr_multiplier: 2.0,
        take_profit_mode: "risk_reward",
        risk_reward_ratio: 3.0,
        max_concurrent_trades: 2,
      },
    },
  },
  {
    id: "multi-asset-balanced",
    name: "Balanced Multi-Asset Portfolio",
    description: "Diversified portfolio across 4 instruments with RSI+MACD confluence. Correlation-aware with daily rebalancing.",
    agent_type: "systematic",
    difficulty: "advanced",
    tags: ["Portfolio", "Diversified", "Confluence", "Balanced"],
    prompt: "Balanced portfolio: EUR/USD 30%, XAU/USD 30%, GBP/USD 20%, USD/JPY 20% with RSI+MACD confluence on H1",
    config: {
      strategy: "rsi_macd_confluence",
      require_confluence: true,
      portfolio: {
        instruments: [
          { instrument: "EUR_USD", allocation_pct: 30, timeframe: "H1" },
          { instrument: "XAU_USD", allocation_pct: 30, timeframe: "H1" },
          { instrument: "GBP_USD", allocation_pct: 20, timeframe: "H1" },
          { instrument: "USD_JPY", allocation_pct: 20, timeframe: "H1" },
        ],
        max_correlation: 0.7,
        hedge_correlated: true,
        rebalance_frequency: "daily",
      },
      indicators: {
        rsi_period: 14, rsi_oversold: 35, rsi_overbought: 65,
        macd_fast: 12, macd_slow: 26, macd_signal: 9,
      },
      risk: {
        risk_per_trade_pct: 0.75,
        max_drawdown_pct: 12.0,
        max_daily_loss_pct: 2.0,
        stop_loss_mode: "atr_based",
        stop_loss_atr_multiplier: 1.5,
        take_profit_mode: "risk_reward",
        risk_reward_ratio: 2.0,
        max_concurrent_trades: 6,
        max_correlated_exposure_pct: 40.0,
      },
    },
  },
];
