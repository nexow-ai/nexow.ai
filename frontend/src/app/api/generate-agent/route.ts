import { NextRequest, NextResponse } from "next/server";

const ENGINE_GENERATE_URL = process.env.ENGINE_GENERATE_URL;

/**
 * POST /api/generate-agent
 * Body: { prompt: string }
 *
 * This calls the Python engine's AI factory to generate a strategy config
 * from a natural language prompt. Since PydanticAI runs in Python,
 * we forward the request to a lightweight HTTP endpoint on the engine.
 *
 * For now, we call the OpenAI API directly from Next.js as a simpler approach.
 */
export async function POST(request: NextRequest) {
  const { prompt } = await request.json();

  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
  }

  const systemPrompt = `You are Nexow's Agent Factory. Convert the user's trading idea into a JSON config.

Return a JSON object with these exact fields:
{
  "agent_type": "systematic" or "discretionary",
  "name": "Creative agent name",
  "description": "1-2 sentence description",
  "risk_summary": "e.g. Cautious: 1% risk, 2:1 R:R, 10% max DD",
  "portfolio_summary": "e.g. EUR/USD (60%) + XAU/USD (40%)",
  "config": {
    // For systematic:
    "strategy": "rsi_reversal|macd_crossover|ema_crossover|bollinger_breakout|rsi_macd_confluence|ema_bollinger_confluence",
    "portfolio": {
      "instruments": [{"instrument": "EUR_USD", "allocation_pct": 100, "timeframe": "M5"}],
      "max_correlation": 0.8,
      "rebalance_frequency": "daily"
    },
    "indicators": {
      "rsi_period": 14, "rsi_oversold": 30, "rsi_overbought": 70,
      "macd_fast": 12, "macd_slow": 26, "macd_signal": 9,
      "ema_fast": 9, "ema_slow": 21,
      "bb_period": 20, "bb_std": 2.0
    },
    "risk": {
      "risk_per_trade_pct": 1.0,
      "max_drawdown_pct": 10.0,
      "max_daily_loss_pct": 3.0,
      "stop_loss_mode": "fixed_pips",
      "stop_loss_pips": 20,
      "take_profit_mode": "risk_reward",
      "risk_reward_ratio": 2.0,
      "max_concurrent_trades": 3
    }
    
    // For discretionary, also include:
    "llm_provider": "openai",
    "llm_model": "gpt-4o-mini",
    "personality": "cautious|balanced|aggressive",
    "focus_areas": ["technical_analysis", "news_sentiment"],
    "use_web_search": true,
    "use_news_feed": true,
    "evaluation_schedule": "every_tick|hourly|daily"
  }
}

Available instruments: EUR_USD, GBP_USD, USD_JPY, XAU_USD, USD_CAD, AUD_USD, NZD_USD, USD_CHF
Only return valid JSON, nothing else.`;

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return NextResponse.json({ error: errText }, { status: resp.status });
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }

    const generated = JSON.parse(content);
    return NextResponse.json(generated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
