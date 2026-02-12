import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { prompt } = await request.json();

  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
  }

  const systemPrompt = `You are Nexow's Agent Factory. Convert the user's trading idea into a JSON config with dynamic trading rules.

Agents are SIGNAL PROVIDERS — they emit entry signals (BUY/SELL) and exit signals (CLOSE).
There is NO position sizing, no volume, no risk management. Agents are compared purely by gross return %.

Return a JSON object with these exact fields:
{
  "agent_type": "systematic" or "discretionary",
  "name": "Creative agent name",
  "description": "1-2 sentence description",
  "portfolio_summary": "e.g. EUR/USD + XAU/USD on H1",
  "config": { ... }
}

## For SYSTEMATIC agents, config must contain "rules" with buy_rules and sell_rules:

Each rule group has "operator" ("and", "or", "not", "always", "never") and "conditions".
Each condition has "type" and optional "params".

Available condition types:
- Price: "price_above", "price_below", "price_change_pct_up", "price_change_pct_down", "price_dropped_pct", "price_near_high", "price_near_low"
- Candle: "candle_is_green", "candle_is_red", "candle_body_gt", "consecutive_green", "consecutive_red", "doji", "engulfing_bullish", "engulfing_bearish"
- Indicators: "rsi_above", "rsi_below", "macd_cross_up", "macd_cross_down", "macd_positive", "macd_negative", "ema_cross_up", "ema_cross_down", "price_above_ema", "price_below_ema", "price_above_bb_upper", "price_below_bb_lower", "bb_squeeze"
- Volume: "volume_above_avg", "volume_below_avg", "volume_spike"
- Time: "every_candle" (DCA), "every_n_candles"
- Meta: "has_no_open_trades", "has_open_trades"

## Config structure:

{
  "portfolio": {"instruments": [{"instrument": "EUR_USD", "timeframe": "M5"}]},
  "rules": {
    "buy_rules": {"operator": "and", "conditions": [...]},
    "sell_rules": {"operator": "and", "conditions": [...]}
  },
  "exit": {"stop_loss_pct": 2.0, "take_profit_pct": 4.0}
}

Exit levels are percentages from entry price:
- Scalping: SL 0.3-0.5%, TP 0.5-1%
- Day trading: SL 1-2%, TP 2-4%
- Swing trading: SL 2-5%, TP 5-10%

## For DISCRETIONARY agents, config includes: llm_provider, llm_model, personality, focus_areas, use_web_search, use_news_feed, evaluation_schedule, portfolio, exit

Available instruments: EUR_USD, GBP_USD, USD_JPY, XAU_USD, USD_CAD, AUD_USD, NZD_USD, USD_CHF
Available timeframes: M1, M5, M15, M30, H1, H4, D

IMPORTANT: Always generate both buy_rules AND sell_rules. Always include an "exit" object. Only return valid JSON.`;

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
